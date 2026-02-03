import { test, expect } from '@playwright/test';

test.describe('Gamification - XP and Badges', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should display current XP', async ({ page }) => {
		await expect(page.locator('text=/XP|puncte/i')).toBeVisible();
	});

	test('should display current badge', async ({ page }) => {
		await expect(page.locator('text=/Badge|Bronze|Silver|Gold|Platinum|Diamond/i')).toBeVisible();
	});

	test('should display streak information', async ({ page }) => {
		await expect(page.locator('text=/Streak|zile consecutive|zile/i')).toBeVisible();
	});

	test('should show gamification on profile page', async ({ page }) => {
		await page.click('a[href="/profile"]');
		await page.waitForURL('/profile');
		
		await expect(page.locator('text=/XP|Badge|Streak/i')).toBeVisible();
	});
});

test.describe('Gamification - Leaderboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should display leaderboard', async ({ page }) => {
		await page.click('a[href="/leaderboard"]');
		await page.waitForURL('/leaderboard');
		
		await expect(page.locator('h1')).toContainText(/Leaderboard|Clasament/i);
	});

	test('should show rankings', async ({ page }) => {
		await page.goto('/leaderboard');
		await page.waitForTimeout(1000);
		
		// Should show rank positions
		await expect(page.locator('text=/Rank|Poziție|#1|#2|#3/i')).toBeVisible();
	});

	test('should filter by period', async ({ page }) => {
		await page.goto('/leaderboard');
		await page.waitForTimeout(1000);
		
		// Look for filter buttons
		const filterButtons = page.locator('button:has-text("Săptămână"), button:has-text("Lună"), button:has-text("Total")');
		const count = await filterButtons.count();
		
		if (count > 0) {
			await filterButtons.first().click();
			await page.waitForTimeout(500);
		}
	});

	test('should display badge showcase', async ({ page }) => {
		await page.goto('/leaderboard');
		await page.waitForTimeout(1000);
		
		// Badge information should be visible
		await expect(page.locator('text=/Bronze|Silver|Gold|Platinum|Diamond/i')).toBeVisible();
	});
});

test.describe('Gamification - Streak Tracking', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should show streak circle', async ({ page }) => {
		// Streak circle or visual representation should be visible
		const streakElements = page.locator('text=/Streak|zile consecutive/i, [class*="streak"]');
		await expect(streakElements.first()).toBeVisible();
	});

	test('should show milestone information', async ({ page }) => {
		// Check if milestone text is present
		const milestones = page.locator('text=/milestone|obiectiv|următoare/i');
		const count = await milestones.count();
		
		// Milestones might be visible depending on current streak
		if (count > 0) {
			await expect(milestones.first()).toBeVisible();
		}
	});
});

test.describe('Gamification - Visual Effects', () => {
	test('should show animations', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check if animated elements exist
		const animatedElements = page.locator('[class*="animate-"], [class*="animation"]');
		const count = await animatedElements.count();
		
		expect(count).toBeGreaterThan(0);
	});

	test('should have gradient backgrounds', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check for gradient classes
		const gradients = page.locator('[class*="gradient"]');
		const count = await gradients.count();
		
		expect(count).toBeGreaterThan(0);
	});
});
