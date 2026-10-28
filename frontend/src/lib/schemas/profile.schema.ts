import { z } from 'zod';
import { channelIdSchema } from './catalog.schema';
import { settingsSchema } from './settings.schema';

export const lineupEntrySchema = z.object({
	channelId: channelIdSchema,
	favorite: z.boolean().default(false)
});

export const localProfileSchema = z
	.object({
		schemaVersion: z.literal(1),
		name: z.string().min(1).max(120).default('My Cable TV'),
		lineup: z.array(lineupEntrySchema).max(200),
		settings: settingsSchema
	})
	.superRefine((profile, ctx) => {
		const seen = new Set<string>();
		for (const [index, entry] of profile.lineup.entries()) {
			if (seen.has(entry.channelId)) {
				ctx.addIssue({
					code: 'custom',
					path: ['lineup', index, 'channelId'],
					message: `Duplicate channel in lineup: ${entry.channelId}`
				});
			}
			seen.add(entry.channelId);
		}
	});

export const profileFileSchema = z
	.object({
		schemaVersion: z.literal(1),
		type: z.literal('cable-tv-profile'),
		name: z.string().min(1).max(120),
		exportedAt: z.string().datetime({ offset: true }),
		lineup: z.array(lineupEntrySchema).max(200),
		settings: settingsSchema.nullable().default(null)
	})
	.superRefine((profile, ctx) => {
		const seen = new Set<string>();
		for (const [index, entry] of profile.lineup.entries()) {
			if (seen.has(entry.channelId)) {
				ctx.addIssue({
					code: 'custom',
					path: ['lineup', index, 'channelId'],
					message: `Duplicate channel in file: ${entry.channelId}`
				});
			}
			seen.add(entry.channelId);
		}
	});

export type LineupEntry = z.infer<typeof lineupEntrySchema>;
export type LocalProfile = z.infer<typeof localProfileSchema>;
export type ProfileFile = z.infer<typeof profileFileSchema>;
