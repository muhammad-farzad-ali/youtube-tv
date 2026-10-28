import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skillPath = '../.opencode/skills/catalog-curator/SKILL.md';

describe('catalog curator skill', () => {
	it('ships valid frontmatter and the editorial reference', () => {
		const skill = readFileSync(skillPath, 'utf8');
		expect(skill.startsWith('---\n')).toBe(true);
		expect(skill).toMatch(/^name: .+$/m);
		expect(skill).toMatch(/^description: .+$/m);
		expect(skill).toContain('references/editorial-policy.md');
		expect(
			readFileSync('../.opencode/skills/catalog-curator/references/editorial-policy.md', 'utf8')
		).toContain('Channel standards');
	});

	it('documents the read-only curation helpers', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['catalog:inspect']).toBe('node scripts/inspect-channel.mjs');
		expect(pkg.scripts['catalog:audit']).toBe('node scripts/audit-catalog.mjs');
	});
});
