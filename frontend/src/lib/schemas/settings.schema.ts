import { z } from 'zod';

export const settingsSchema = z.object({
	autoplayNext: z.boolean().default(true),
	skipUnavailable: z.boolean().default(true),
	loopQueue: z.boolean().default(false),
	startOnSelect: z.boolean().default(true),
	startMuted: z.boolean().default(true),
	resumeLastVideo: z.boolean().default(false),
	sortOrder: z.enum(['newest', 'oldest']).default('newest'),
	autoRefreshMinutes: z.number().int().min(0).max(720).default(0),
	feedProxyUrl: z.string().max(500).default(''),
	sidebarCollapsed: z.boolean().default(false),
	crtEffects: z.boolean().default(true),
	numberStart: z.number().int().min(1).max(9999).default(1),
	volume: z.number().int().min(0).max(100).default(70),
	muted: z.boolean().default(true),
	selectedChannelId: z.string().nullable().default(null),
	lastPlayed: z.record(z.string(), z.string()).default({})
});

export type Settings = z.infer<typeof settingsSchema>;

export function defaultSettings(): Settings {
	return settingsSchema.parse({});
}

export function mergeSettings(input: unknown): Settings {
	const parsed = settingsSchema.safeParse(input ?? {});
	return parsed.success ? parsed.data : defaultSettings();
}
