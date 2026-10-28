import { z } from 'zod';

export const channelIdSchema = z
	.string()
	.regex(/^UC[A-Za-z0-9_-]{22}$/, 'Channel IDs must be 24 characters and start with UC');

export const videoIdSchema = z
	.string()
	.regex(/^[A-Za-z0-9_-]{11}$/, 'Video IDs must be 11 URL-safe characters');

export const videoSchema = z.object({
	videoId: videoIdSchema,
	title: z.string().min(1).max(500),
	thumbnailUrl: z.string().url().optional(),
	publishedAt: z.string().datetime({ offset: true }),
	durationSeconds: z.number().int().nonnegative().nullable().optional()
});

export const categorySchema = z.string().min(1).max(48);

export const catalogChannelSchema = z.object({
	id: channelIdSchema,
	name: z.string().min(1).max(120),
	channelUrl: z.string().url().regex(/^https:\/\/(www\.)?youtube\.com\//),
	description: z.string().max(600).default(''),
	category: categorySchema,
	logoUrl: z.string().min(1).optional(),
	snapshotAt: z.string().datetime({ offset: true }),
	videos: z.array(videoSchema).max(60)
});

export const catalogPackSchema = z.object({
	id: z.string().min(1).max(64),
	name: z.string().min(1).max(120),
	description: z.string().max(600).default(''),
	channelIds: z.array(channelIdSchema).min(1)
});

export const catalogSchema = z
	.object({
		schemaVersion: z.literal(1),
		type: z.literal('cable-tv-catalog'),
		name: z.string().min(1).max(120),
		updatedAt: z.string().datetime({ offset: true }),
		starterChannelIds: z.array(channelIdSchema).min(1),
		packs: z.array(catalogPackSchema),
		channels: z.array(catalogChannelSchema).min(1)
	})
	.superRefine((catalog, ctx) => {
		const channelIds = new Set<string>();
		for (const [index, channel] of catalog.channels.entries()) {
			if (channelIds.has(channel.id)) {
				ctx.addIssue({
					code: 'custom',
					path: ['channels', index, 'id'],
					message: `Duplicate channel ID: ${channel.id}`
				});
			}
			channelIds.add(channel.id);
		}

		const packIds = new Set<string>();
		for (const [index, pack] of catalog.packs.entries()) {
			if (packIds.has(pack.id)) {
				ctx.addIssue({
					code: 'custom',
					path: ['packs', index, 'id'],
					message: `Duplicate pack ID: ${pack.id}`
				});
			}
			packIds.add(pack.id);

			for (const channelId of pack.channelIds) {
				if (!channelIds.has(channelId)) {
					ctx.addIssue({
						code: 'custom',
						path: ['packs', index, 'channelIds'],
						message: `Pack references unknown channel: ${channelId}`
					});
				}
			}
		}

		for (const channelId of catalog.starterChannelIds) {
			if (!channelIds.has(channelId)) {
				ctx.addIssue({
					code: 'custom',
					path: ['starterChannelIds'],
					message: `Starter lineup references unknown channel: ${channelId}`
				});
			}
		}
	});

export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogChannel = z.infer<typeof catalogChannelSchema>;
export type CatalogPack = z.infer<typeof catalogPackSchema>;
export type CatalogVideo = z.infer<typeof videoSchema>;
