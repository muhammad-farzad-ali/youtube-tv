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
	thumbnailUrl: z
		.string()
		.url()
		.regex(/^https:\/\//)
		.optional(),
	publishedAt: z.string().datetime({ offset: true }),
	durationSeconds: z.number().int().nonnegative().nullable().optional()
});

export const categorySchema = z.string().min(1).max(48);

export const catalogChannelSchema = z.object({
	id: channelIdSchema,
	name: z.string().min(1).max(120),
	channelUrl: z
		.string()
		.url()
		.regex(/^https:\/\/(www\.)?youtube\.com\//),
	description: z.string().max(600).default(''),
	category: categorySchema,
	logoUrl: z.string().min(1).optional(),
	snapshotAt: z.string().datetime({ offset: true }),
	videos: z.array(videoSchema).max(60),
	shortVideoIds: z.array(videoIdSchema).max(60).default([])
});

export const catalogSchema = z
	.object({
		schemaVersion: z.literal(2),
		type: z.literal('cable-tv-catalog'),
		name: z.string().min(1).max(120),
		updatedAt: z.string().datetime({ offset: true }),
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

			const longIds = new Set(channel.videos.map((video) => video.videoId));
			const shortIds = new Set<string>();
			for (const [shortIndex, videoId] of channel.shortVideoIds.entries()) {
				if (shortIds.has(videoId)) {
					ctx.addIssue({
						code: 'custom',
						path: ['channels', index, 'shortVideoIds', shortIndex],
						message: `Duplicate Short video ID: ${videoId}`
					});
				}
				shortIds.add(videoId);
				if (longIds.has(videoId)) {
					ctx.addIssue({
						code: 'custom',
						path: ['channels', index, 'shortVideoIds', shortIndex],
						message: `Video appears as both long-form and Short: ${videoId}`
					});
				}
			}
		}
	});

export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogChannel = z.infer<typeof catalogChannelSchema>;
export type CatalogVideo = z.infer<typeof videoSchema>;
