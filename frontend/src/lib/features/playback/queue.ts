import type { CatalogVideo } from '#lib/schemas/catalog.schema';

export function sortNewest(videos: CatalogVideo[]): CatalogVideo[] {
	return [...videos].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
