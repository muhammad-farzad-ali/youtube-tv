export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	message: string;
	tone: ToastTone;
}

class ToastStore {
	items = $state<Toast[]>([]);

	show(message: string, tone: ToastTone = 'info', timeout = 5200): string {
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random()}`;
		this.items = [...this.items, { id, message, tone }];
		if (typeof window !== 'undefined' && timeout > 0) {
			setTimeout(() => this.dismiss(id), timeout);
		}
		return id;
	}

	success(message: string): string {
		return this.show(message, 'success');
	}

	info(message: string): string {
		return this.show(message, 'info');
	}

	error(message: string): string {
		return this.show(message, 'error', 8000);
	}

	warning(message: string): string {
		return this.show(message, 'warning', 7000);
	}

	dismiss(id: string): void {
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export const toasts = new ToastStore();
