export interface PlayerCallbacks {
	onReady: () => void;
	onStateChange: (state: number) => void;
	onError: (code: number) => void;
}

type YouTubeApi = typeof YT;

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('YouTube is only available in the browser'));
	}
	if ((window as unknown as { YT?: YouTubeApi }).YT?.Player) {
		return Promise.resolve((window as unknown as { YT: YouTubeApi }).YT);
	}
	if (apiPromise) return apiPromise;

	apiPromise = new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			apiPromise = null;
			reject(new Error('The YouTube player API did not load. It may be blocked by a browser extension or network.'));
		}, 20_000);

		const previous = (window as unknown as { onYouTubeIframeAPIReady?: () => void })
			.onYouTubeIframeAPIReady;
		(window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
			previous?.();
			clearTimeout(timeout);
			const api = (window as unknown as { YT?: YouTubeApi }).YT;
			if (api) resolve(api);
			else reject(new Error('The YouTube player API loaded without a YT namespace.'));
		};

		const existing = document.querySelector<HTMLScriptElement>('script[data-cable-tv-youtube]');
		if (existing) return;
		const script = document.createElement('script');
		script.src = 'https://www.youtube.com/iframe_api';
		script.async = true;
		script.dataset.cableTvYoutube = 'true';
		script.onerror = () => {
			clearTimeout(timeout);
			apiPromise = null;
			reject(new Error('The YouTube player API script could not be loaded.'));
		};
		document.head.appendChild(script);
	});

	return apiPromise;
}

export class YouTubePlayerService {
	private player: YT.Player | null = null;
	private containerId: string | null = null;
	private callbacks: PlayerCallbacks | null = null;
	private ready = false;
	private pendingVideo: { videoId: string; startSeconds: number; autoplay: boolean } | null = null;
	private initPromise: Promise<void> | null = null;
	private destroyed = false;

	async init(containerId: string, callbacks: PlayerCallbacks): Promise<void> {
		if (this.initPromise) return this.initPromise;
		if (this.player && this.containerId === containerId) return;

		if (this.player && this.containerId !== containerId) {
			await this.destroy();
		}

		this.containerId = containerId;
		this.callbacks = callbacks;
		this.destroyed = false;

		this.initPromise = (async () => {
			const YT = await loadYouTubeApi();
			if (this.destroyed) return;

			await new Promise<void>((resolve) => {
				this.player = new YT.Player(containerId, {
					width: '100%',
					height: '100%',
					playerVars: {
						autoplay: 0,
						controls: 0,
						disablekb: 1,
						enablejsapi: 1,
						fs: 0,
						iv_load_policy: 3,
						modestbranding: 1,
						playsinline: 1,
						rel: 0,
						origin: window.location.origin
					},
					events: {
						onReady: () => {
							this.ready = true;
							this.callbacks?.onReady();
							if (this.pendingVideo) {
								const pending = this.pendingVideo;
								this.pendingVideo = null;
								this.load(pending.videoId, pending.startSeconds, pending.autoplay);
							}
							resolve();
						},
						onStateChange: (event) => {
							this.callbacks?.onStateChange(event.data);
						},
						onError: (event) => {
							this.callbacks?.onError(event.data);
						}
					}
				});
			});
		})();

		try {
			await this.initPromise;
		} finally {
			this.initPromise = null;
		}
	}

	load(videoId: string, startSeconds = 0, autoplay = true): void {
		if (!this.player || !this.ready || typeof this.player.loadVideoById !== 'function') {
			this.pendingVideo = { videoId, startSeconds, autoplay };
			return;
		}
		if (autoplay) {
			this.player.loadVideoById({ videoId, startSeconds });
		} else {
			this.player.cueVideoById({ videoId, startSeconds });
		}
	}

	play(): void {
		if (typeof this.player?.playVideo === 'function') this.player.playVideo();
	}

	pause(): void {
		if (typeof this.player?.pauseVideo === 'function') this.player.pauseVideo();
	}

	mute(): void {
		if (typeof this.player?.mute === 'function') this.player.mute();
	}

	unMute(): void {
		if (typeof this.player?.unMute === 'function') this.player.unMute();
	}

	setVolume(volume: number): void {
		if (typeof this.player?.setVolume === 'function') {
			this.player.setVolume(Math.max(0, Math.min(100, Math.round(volume))));
		}
	}

	getVolume(): number {
		return typeof this.player?.getVolume === 'function' ? this.player.getVolume() : 0;
	}

	isMuted(): boolean {
		return typeof this.player?.isMuted === 'function' ? this.player.isMuted() : true;
	}

	getCurrentTime(): number {
		return typeof this.player?.getCurrentTime === 'function' ? this.player.getCurrentTime() : 0;
	}

	getDuration(): number {
		return typeof this.player?.getDuration === 'function' ? this.player.getDuration() : 0;
	}

	seekTo(seconds: number): void {
		if (typeof this.player?.seekTo === 'function') {
			this.player.seekTo(Math.max(0, seconds), true);
		}
	}

	stop(): void {
		if (typeof this.player?.stopVideo === 'function') this.player.stopVideo();
	}

	async destroy(): Promise<void> {
		this.destroyed = true;
		this.ready = false;
		this.pendingVideo = null;
		if (this.player) {
			try {
				if (typeof this.player.destroy === 'function') this.player.destroy();
			} catch {
				// The iframe may already be gone after navigation.
			}
			this.player = null;
		}
		this.containerId = null;
		this.initPromise = null;
	}
}
