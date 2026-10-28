import {
	getVideosForChannel,
	setVideoAvailability,
	setVideoDuration,
	type VideoRecord
} from '#lib/storage/database';
import { profile } from './profile.svelte';
import { YouTubePlayerService } from '#lib/services/youtubePlayer';
import {
	firstEligibleIndex,
	isEligible,
	nextEligibleIndex,
	sortQueue
} from '#lib/features/playback/queue';

export type PlaybackStatus =
	'idle' | 'loading' | 'playing' | 'paused' | 'cued' | 'ended' | 'error' | 'empty';

const PLAYER_STATES = {
	UNSTARTED: -1,
	ENDED: 0,
	PLAYING: 1,
	PAUSED: 2,
	BUFFERING: 3,
	CUED: 5
} as const;

function errorMessage(code: number): string {
	switch (code) {
		case 2:
			return 'The video ID was rejected by YouTube.';
		case 5:
			return 'The HTML5 player encountered an error.';
		case 100:
			return 'This video is unavailable, private, or has been removed.';
		case 101:
		case 150:
			return 'The owner does not allow this video to be embedded.';
		default:
			return 'YouTube could not play this video.';
	}
}

function isPermanentError(code: number): boolean {
	return code === 100 || code === 101 || code === 150;
}

class PlaybackStore {
	channelId = $state<string | null>(null);
	queue = $state<VideoRecord[]>([]);
	index = $state(-1);
	current = $state<VideoRecord | null>(null);
	status = $state<PlaybackStatus>('idle');
	error = $state<string | null>(null);
	errorCode = $state<number | null>(null);
	playerReady = $state(false);
	autoplayBlocked = $state(false);
	muted = $state(profile.settings.muted);
	volume = $state(profile.settings.volume);
	currentTime = $state(0);
	duration = $state(0);
	lastSkipped = $state<string | null>(null);
	newVideosAvailable = $state(0);
	attached = $state(false);

	progress = $derived(this.duration > 0 ? Math.min(1, this.currentTime / this.duration) : 0);
	hasNext = $derived(this.findNextIndex() !== null);
	queuePosition = $derived(this.index >= 0 ? this.index + 1 : 0);

	private service = new YouTubePlayerService();
	private ticker: ReturnType<typeof setInterval> | null = null;
	private watchdog: ReturnType<typeof setTimeout> | null = null;
	private blockTimer: ReturnType<typeof setTimeout> | null = null;
	private advanceTimer: ReturnType<typeof setTimeout> | null = null;
	private autoplayRequested = false;
	private retries = 0;
	private savedDurationFor: string | null = null;
	private initToken = 0;
	private tuneToken = 0;

	async attach(containerId: string): Promise<void> {
		if (this.attached) return;
		this.attached = true;
		this.muted = profile.settings.startMuted ? true : profile.settings.muted;
		this.volume = profile.settings.volume;
		const token = ++this.initToken;
		await this.service.init(containerId, {
			onReady: () => {
				if (token !== this.initToken) return;
				this.playerReady = true;
				this.service.setVolume(this.volume);
				if (this.muted) this.service.mute();
				else this.service.unMute();
			},
			onStateChange: (state) => this.handleState(state),
			onError: (code) => this.handleError(code)
		});
	}

	async detach(): Promise<void> {
		this.clearTimers();
		this.stopTicker();
		this.tuneToken++;
		this.attached = false;
		this.playerReady = false;
		this.initToken++;
		this.status = 'idle';
		this.current = null;
		this.queue = [];
		this.index = -1;
		this.channelId = null;
		await this.service.destroy();
	}

	async tune(
		channelId: string,
		options: { forceNewest?: boolean; forcePlay?: boolean } = {}
	): Promise<void> {
		const token = ++this.tuneToken;
		this.channelId = channelId;
		this.newVideosAvailable = 0;
		this.lastSkipped = null;
		this.error = null;
		this.errorCode = null;
		const queue = await getVideosForChannel(channelId);
		if (token !== this.tuneToken || this.channelId !== channelId) return;
		this.queue = queue;
		if (this.queue.length === 0) {
			this.status = 'empty';
			this.index = -1;
			this.current = null;
			this.currentTime = 0;
			this.duration = 0;
			return;
		}

		this.queue = sortQueue(this.queue, this.settings.sortOrder);
		let start = this.firstEligibleIndex();
		if (this.settings.resumeLastVideo && !options.forceNewest) {
			const lastPlayed = profile.settings.lastPlayed[channelId];
			const resumeIndex = lastPlayed
				? this.queue.findIndex((video) => video.videoId === lastPlayed)
				: -1;
			const resumeVideo = resumeIndex >= 0 ? this.queue[resumeIndex] : undefined;
			if (resumeVideo && isEligible(resumeVideo, this.settings.skipUnavailable)) {
				start = resumeIndex;
			}
		}

		if (start < 0) {
			this.status = 'empty';
			this.index = -1;
			this.current = null;
			return;
		}

		this.loadIndex(start, options.forcePlay ? true : this.settings.startOnSelect);
	}

	restartChannel(): void {
		if (this.channelId) void this.tune(this.channelId, { forceNewest: true, forcePlay: true });
	}

	private get settings() {
		return profile.settings;
	}

	private firstEligibleIndex(): number {
		return firstEligibleIndex(this.queue, this.settings.skipUnavailable);
	}

	private findNextIndex(from = this.index): number | null {
		return nextEligibleIndex(this.queue, from, {
			skipUnavailable: this.settings.skipUnavailable,
			loop: this.settings.loopQueue
		});
	}

	private loadIndex(index: number, autoplay: boolean): void {
		const video = this.queue[index];
		if (!video) {
			this.status = 'empty';
			return;
		}

		this.clearTimers();
		this.index = index;
		this.current = video;
		this.error = null;
		this.errorCode = null;
		this.autoplayBlocked = false;
		this.autoplayRequested = autoplay;
		this.retries = 0;
		this.currentTime = 0;
		this.duration = video.durationSeconds ?? 0;
		this.savedDurationFor = null;
		this.status = autoplay ? 'loading' : 'cued';

		profile.recordLastPlayed(video.channelId, video.videoId);
		this.service.setVolume(this.volume);
		if (this.muted) this.service.mute();
		else this.service.unMute();
		this.service.load(video.videoId, 0, autoplay);
		this.startTicker();

		if (autoplay) {
			this.blockTimer = setTimeout(() => {
				if (this.status !== 'playing' && this.status !== 'paused') {
					this.autoplayBlocked = true;
				}
			}, 4200);
			this.watchdog = setTimeout(() => {
				if (this.status === 'loading' || this.status === 'cued') {
					this.error =
						'The player did not start. Autoplay may be blocked, or the connection may be slow.';
					this.status = 'error';
					this.autoplayBlocked = true;
				}
			}, 25_000);
		}
	}

	private handleState(state: number): void {
		switch (state) {
			case PLAYER_STATES.PLAYING:
				this.clearTimers();
				this.status = 'playing';
				this.autoplayBlocked = false;
				this.error = null;
				this.startTicker();
				break;
			case PLAYER_STATES.PAUSED:
				this.status = 'paused';
				this.autoplayBlocked = false;
				this.syncTime();
				this.stopTicker();
				break;
			case PLAYER_STATES.BUFFERING:
				if (this.status !== 'paused') this.status = 'loading';
				break;
			case PLAYER_STATES.CUED:
				if (this.autoplayRequested) this.autoplayBlocked = true;
				else this.status = 'cued';
				break;
			case PLAYER_STATES.ENDED:
				this.handleEnded();
				break;
			case PLAYER_STATES.UNSTARTED:
				break;
		}
	}

	private handleEnded(): void {
		this.stopTicker();
		this.syncTime();
		if (!this.settings.autoplayNext) {
			this.status = 'ended';
			return;
		}
		this.next();
	}

	private handleError(code: number): void {
		this.clearTimers();
		this.error = errorMessage(code);
		this.errorCode = code;
		this.status = 'error';

		const video = this.current;
		if (video && isPermanentError(code)) {
			this.queue = this.queue.map((item) =>
				item.videoId === video.videoId ? { ...item, availabilityStatus: 'unavailable' } : item
			);
			void setVideoAvailability(video.videoId, 'unavailable');
		}

		if (this.settings.skipUnavailable) {
			if (!isPermanentError(code) && this.retries < 1) {
				this.retries++;
				setTimeout(() => {
					if (video && this.current?.videoId === video.videoId) {
						this.service.load(video.videoId, 0, true);
						this.status = 'loading';
					}
				}, 1200);
				return;
			}

			this.lastSkipped = video ? `${video.title} — ${this.error}` : this.error;
			this.advanceTimer = setTimeout(() => {
				this.advanceTimer = null;
				this.next();
			}, 2400);
		}
	}

	next(): void {
		const nextIndex = this.findNextIndex();
		if (nextIndex === null) {
			this.status = 'ended';
			this.stopTicker();
			return;
		}
		this.loadIndex(nextIndex, true);
	}

	playIndex(index: number): void {
		if (index < 0 || index >= this.queue.length) return;
		this.loadIndex(index, true);
	}

	play(): void {
		if (!this.current) return;
		if (this.status === 'ended' || this.status === 'error') {
			this.loadIndex(this.index, true);
			return;
		}
		this.autoplayRequested = true;
		this.autoplayBlocked = false;
		this.status = 'loading';
		this.service.play();
		this.startTicker();
	}

	pause(): void {
		this.service.pause();
		this.status = 'paused';
		this.syncTime();
		this.stopTicker();
	}

	togglePause(): void {
		if (this.status === 'playing' || this.status === 'loading') this.pause();
		else this.play();
	}

	retry(): void {
		if (!this.current) return;
		this.loadIndex(this.index, true);
	}

	toggleMute(): void {
		this.muted = !this.muted;
		if (this.muted) this.service.mute();
		else {
			this.service.unMute();
			this.service.setVolume(this.volume || 70);
		}
		profile.setSetting('muted', this.muted);
	}

	setVolume(value: number): void {
		this.volume = Math.max(0, Math.min(100, Math.round(value)));
		this.service.setVolume(this.volume);
		if (this.volume === 0) {
			this.muted = true;
			this.service.mute();
		} else if (this.muted) {
			this.muted = false;
			this.service.unMute();
			this.service.setVolume(this.volume);
		}
		profile.setSetting('volume', this.volume);
		profile.setSetting('muted', this.muted);
	}

	seekToFraction(fraction: number): void {
		if (!this.duration) return;
		const seconds = Math.max(0, Math.min(1, fraction)) * this.duration;
		this.currentTime = seconds;
		this.service.seekTo(seconds);
	}

	async checkForNewVideos(channelId: string): Promise<void> {
		if (this.channelId !== channelId) return;
		const latest = await getVideosForChannel(channelId);
		if (this.channelId !== channelId) return;
		const known = new Set(this.queue.map((video) => video.videoId));
		this.newVideosAvailable = latest.filter((video) => !known.has(video.videoId)).length;
	}

	private startTicker(): void {
		this.stopTicker();
		this.syncTime();
		this.ticker = setInterval(() => this.syncTime(), 500);
	}

	private stopTicker(): void {
		if (this.ticker) clearInterval(this.ticker);
		this.ticker = null;
	}

	private syncTime(): void {
		const time = this.service.getCurrentTime();
		const duration = this.service.getDuration();
		if (Number.isFinite(time) && time >= 0) this.currentTime = time;
		if (Number.isFinite(duration) && duration > 0) {
			this.duration = duration;
			if (this.current && this.savedDurationFor !== this.current.videoId) {
				this.savedDurationFor = this.current.videoId;
				void setVideoDuration(this.current.videoId, duration);
			}
		}
	}

	private clearTimers(): void {
		if (this.watchdog) clearTimeout(this.watchdog);
		if (this.blockTimer) clearTimeout(this.blockTimer);
		if (this.advanceTimer) clearTimeout(this.advanceTimer);
		this.watchdog = null;
		this.blockTimer = null;
		this.advanceTimer = null;
	}
}

export const playback = new PlaybackStore();
