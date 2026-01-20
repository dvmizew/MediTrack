import { describe, it, expect } from 'vitest';
import { BADGES, getBadgeMeta, type BadgeId } from '$lib/constants/badges';

describe('badges', () => {
	describe('BADGES constant', () => {
		it('should have 5 badges', () => {
			expect(BADGES).toHaveLength(5);
		});

		it('should have correct badge IDs', () => {
			const ids: BadgeId[] = BADGES.map((b) => b.id);
			expect(ids).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
		});

		it('should have ascending XP thresholds', () => {
			for (let i = 0; i < BADGES.length - 1; i++) {
				expect(BADGES[i].xp).toBeLessThan(BADGES[i + 1].xp);
			}
		});

		it('bronze badge should have 0 XP threshold', () => {
			const bronze = BADGES[0];
			expect(bronze.id).toBe('bronze');
			expect(bronze.xp).toBe(0);
		});

		it('all badges should have gradient strings', () => {
			BADGES.forEach((badge) => {
				expect(badge.gradient).toBeTruthy();
				expect(badge.gradient).toContain('from-');
				expect(badge.gradient).toContain('to-');
			});
		});

		it('all badges should have names', () => {
			BADGES.forEach((badge) => {
				expect(badge.name).toBeTruthy();
				expect(typeof badge.name).toBe('string');
			});
		});
	});

	describe('getBadgeMeta', () => {
		it('should return bronze badge by ID', () => {
			const badge = getBadgeMeta('bronze');
			expect(badge.id).toBe('bronze');
			expect(badge.name).toBe('Bronz');
			expect(badge.xp).toBe(0);
		});

		it('should return silver badge by ID', () => {
			const badge = getBadgeMeta('silver');
			expect(badge.id).toBe('silver');
			expect(badge.name).toBe('Argint');
			expect(badge.xp).toBe(1000);
		});

		it('should return gold badge by ID', () => {
			const badge = getBadgeMeta('gold');
			expect(badge.id).toBe('gold');
			expect(badge.name).toBe('Aur');
			expect(badge.xp).toBe(2000);
		});

		it('should return platinum badge by ID', () => {
			const badge = getBadgeMeta('platinum');
			expect(badge.id).toBe('platinum');
			expect(badge.name).toBe('Platină');
			expect(badge.xp).toBe(3000);
		});

		it('should return diamond badge by ID', () => {
			const badge = getBadgeMeta('diamond');
			expect(badge.id).toBe('diamond');
			expect(badge.name).toBe('Diamant');
			expect(badge.xp).toBe(4000);
		});

		it('should return bronze badge for invalid ID', () => {
			const badge = getBadgeMeta('invalid-badge');
			expect(badge.id).toBe('bronze');
		});

		it('should return bronze badge for empty string', () => {
			const badge = getBadgeMeta('');
			expect(badge.id).toBe('bronze');
		});

		it('should return bronze badge for undefined ID', () => {
			const badge = getBadgeMeta(undefined as any);
			expect(badge.id).toBe('bronze');
		});
	});

	describe('badge progression logic', () => {
		it('bronze: 0-999 XP should use bronze badge', () => {
			const badge = getBadgeMeta('bronze');
			expect(badge.xp).toBe(0);
			// If user has 999 XP, they're still bronze (need 1000 for silver)
		});

		it('silver: 1000-1999 XP should unlock silver badge', () => {
			const silver = BADGES.find((b) => b.id === 'silver');
			expect(silver?.xp).toBe(1000);
		});

		it('gold: 2000-2999 XP should unlock gold badge', () => {
			const gold = BADGES.find((b) => b.id === 'gold');
			expect(gold?.xp).toBe(2000);
		});

		it('platinum: 3000-3999 XP should unlock platinum badge', () => {
			const platinum = BADGES.find((b) => b.id === 'platinum');
			expect(platinum?.xp).toBe(3000);
		});

		it('diamond: 4000+ XP should unlock diamond badge', () => {
			const diamond = BADGES.find((b) => b.id === 'diamond');
			expect(diamond?.xp).toBe(4000);
		});
	});

	describe('badge metadata', () => {
		it('bronze should have orange gradient', () => {
			const bronze = getBadgeMeta('bronze');
			expect(bronze.gradient).toContain('orange');
		});

		it('silver should have gray gradient', () => {
			const silver = getBadgeMeta('silver');
			expect(silver.gradient).toContain('gray');
		});

		it('gold should have yellow gradient', () => {
			const gold = getBadgeMeta('gold');
			expect(gold.gradient).toContain('yellow');
		});

		it('platinum should have blue gradient', () => {
			const platinum = getBadgeMeta('platinum');
			expect(platinum.gradient).toContain('blue');
		});

		it('diamond should have purple gradient', () => {
			const diamond = getBadgeMeta('diamond');
			expect(diamond.gradient).toContain('purple');
		});
	});
});
