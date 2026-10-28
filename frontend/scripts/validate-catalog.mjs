#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data/catalog.source.json');
const catalogPath = path.join(root, 'static/catalog.json');

const errors = [];
const warnings = [];

function error(message) {
	errors.push(message);
}
function warn(message) {
	warnings.push(message);
}
function validChannelId(id) {
	return typeof id === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(id);
}
function validVideoId(id) {
	return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

async function readJson(file, label) {
	try {
		return JSON.parse(await readFile(file, 'utf8'));
	} catch (cause) {
		error(`${label} could not be parsed: ${cause.message}`);
		return null;
	}
}

function checkChannel(channel, index, seenIds, seenVideoIds) {
	const where = `channels[${index}]`;
	if (!channel || typeof channel !== 'object') {
		error(`${where} is not an object`);
		return;
	}
	if (!validChannelId(channel.id)) error(`${where}.id is not a valid YouTube channel ID`);
	if (seenIds.has(channel.id)) error(`${where}.id is duplicated: ${channel.id}`);
	seenIds.add(channel.id);
	if (!channel.name || typeof channel.name !== 'string') error(`${where}.name is missing`);
	if (!channel.category || typeof channel.category !== 'string')
		error(`${where}.category is missing`);
	if (channel.channelUrl !== `https://www.youtube.com/channel/${channel.id}`) {
		warn(`${channel.name}: channelUrl is not canonical`);
	}
	if (channel.logoUrl) {
		// checked later, async
	}
	if (!Array.isArray(channel.videos) || channel.videos.length === 0) {
		error(`${channel.name}: no videos in snapshot`);
		return;
	}
	if (channel.videos.length > 60)
		error(`${channel.name}: too many videos (${channel.videos.length})`);
	if (!channel.snapshotAt || Number.isNaN(Date.parse(channel.snapshotAt))) {
		error(`${channel.name}: invalid snapshotAt`);
	}

	const localVideos = new Set();
	for (const [videoIndex, video] of channel.videos.entries()) {
		const vWhere = `${where}.videos[${videoIndex}]`;
		if (!validVideoId(video.videoId)) error(`${vWhere}.videoId is invalid`);
		if (seenVideoIds.has(video.videoId)) {
			warn(`Duplicate video across catalog: ${video.videoId}`);
		}
		seenVideoIds.add(video.videoId);
		if (localVideos.has(video.videoId)) error(`${channel.name}: duplicate video ${video.videoId}`);
		localVideos.add(video.videoId);
		if (!video.title) error(`${vWhere}.title is missing`);
		if (!video.publishedAt || Number.isNaN(Date.parse(video.publishedAt))) {
			error(`${vWhere}.publishedAt is invalid`);
		}
		if (video.thumbnailUrl && !/^https:\/\//.test(video.thumbnailUrl)) {
			error(`${vWhere}.thumbnailUrl must be https`);
		}
	}
}

async function main() {
	const source = await readJson(sourcePath, 'catalog.source.json');
	const catalog = await readJson(catalogPath, 'static/catalog.json');
	if (!source || !catalog) return report(0);

	if (source.schemaVersion !== 1) error('Source schemaVersion must be 1');
	if (catalog.schemaVersion !== 1) error('Catalog schemaVersion must be 1');
	if (catalog.type !== 'cable-tv-catalog') error('Catalog type must be cable-tv-catalog');

	const sourceChannels = Array.isArray(source.channels) ? source.channels : [];
	const catalogChannels = Array.isArray(catalog.channels) ? catalog.channels : [];
	if (sourceChannels.length === 0) error('Source contains no channels');
	if (sourceChannels.length !== catalogChannels.length) {
		error(
			`Channel count mismatch: source=${sourceChannels.length}, catalog=${catalogChannels.length}`
		);
	}
	if (
		sourceChannels.map((channel) => channel.id).join(',') !==
		catalogChannels.map((channel) => channel.id).join(',')
	) {
		error('Channel order differs between source and generated catalog. Run npm run catalog:sync.');
	}

	const seenIds = new Set();
	const seenVideoIds = new Set();
	for (const [index, channel] of catalogChannels.entries()) {
		checkChannel(channel, index, seenIds, seenVideoIds);
	}

	for (const [index, sourceChannel] of sourceChannels.entries()) {
		const generated = catalogChannels.find((channel) => channel.id === sourceChannel.id);
		if (!generated) {
			error(`Source channel missing from catalog: ${sourceChannel.name}`);
			continue;
		}
		for (const key of ['name', 'channelUrl', 'category', 'description']) {
			if ((sourceChannel[key] ?? '') !== (generated[key] ?? '')) {
				error(`Channel ${sourceChannel.name}: ${key} differs between source and catalog`);
			}
		}
		if (sourceChannel.logoUrl && sourceChannel.logoUrl !== generated.logoUrl) {
			error(`Channel ${sourceChannel.name}: logoUrl differs between source and catalog`);
		}
	}

	if (
		JSON.stringify(source.starterChannelIds ?? []) !==
		JSON.stringify(catalog.starterChannelIds ?? [])
	) {
		error('Starter lineup differs between source and generated catalog. Run npm run catalog:sync.');
	}

	const sourcePacks = source.packs ?? [];
	const catalogPacks = catalog.packs ?? [];
	if (JSON.stringify(sourcePacks) !== JSON.stringify(catalogPacks)) {
		error('Packs differ between source and generated catalog. Run npm run catalog:sync.');
	}

	const ids = new Set(catalogChannels.map((channel) => channel.id));
	for (const channelId of catalog.starterChannelIds ?? []) {
		if (!ids.has(channelId)) error(`Starter lineup references unknown channel: ${channelId}`);
	}
	if (!Array.isArray(catalog.starterChannelIds) || catalog.starterChannelIds.length === 0) {
		error('Starter lineup is empty');
	}

	const starterSeen = new Set();
	for (const channelId of catalog.starterChannelIds ?? []) {
		if (starterSeen.has(channelId))
			error(`Starter lineup contains duplicate channel: ${channelId}`);
		starterSeen.add(channelId);
	}

	const packIds = new Set();
	for (const [index, pack] of (catalog.packs ?? []).entries()) {
		if (!pack.id) error(`packs[${index}].id is missing`);
		if (packIds.has(pack.id)) error(`Duplicate pack ID: ${pack.id}`);
		packIds.add(pack.id);
		if (!Array.isArray(pack.channelIds) || pack.channelIds.length === 0) {
			error(`Pack ${pack.id} has no channels`);
		}
		const packChannels = new Set();
		for (const channelId of pack.channelIds ?? []) {
			if (packChannels.has(channelId))
				error(`Pack ${pack.id} contains duplicate channel: ${channelId}`);
			packChannels.add(channelId);
			if (!ids.has(channelId)) error(`Pack ${pack.id} references unknown channel: ${channelId}`);
		}
	}

	for (const channel of catalogChannels) {
		if (!channel.logoUrl) continue;
		const logoPath = path.join(root, 'static', channel.logoUrl);
		try {
			await access(logoPath, constants.R_OK);
		} catch {
			error(`Logo missing for ${channel.name}: static/${channel.logoUrl}`);
		}
	}

	const newestSnapshot = Math.max(
		0,
		...catalogChannels.map((channel) => Date.parse(channel.snapshotAt) || 0)
	);
	if (newestSnapshot && Date.now() - newestSnapshot > 1000 * 60 * 60 * 24 * 60) {
		warn('Catalog snapshot is more than 60 days old. Consider running npm run catalog:sync.');
	}

	report(catalogChannels.length);
}

function report(channelCount) {
	for (const message of warnings) console.warn(`⚠ ${message}`);
	for (const message of errors) console.error(`✖ ${message}`);
	if (errors.length) {
		console.error(`\nCatalog validation failed with ${errors.length} error(s).`);
		process.exit(1);
	}
	console.log(
		`✓ Catalog valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}. ` +
			`${channelCount} channels.`
	);
}

main().catch((error) => {
	console.error(`✖ ${error.stack ?? error.message}`);
	process.exit(1);
});
