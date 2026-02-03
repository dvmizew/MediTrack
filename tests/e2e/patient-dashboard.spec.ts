import { test, expect } from '@playwright/test';

test.describe('Patient Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		// Login as patient
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should display dashboard KPIs', async ({ page }) => {
		await expect(page.locator('h1')).toContainText(/Dashboard/);
		
		// Check for key metrics
		await expect(page.locator('text=/Total|Confirmate|În așteptare/i')).toBeVisible();
	});

	test('should display streak information', async ({ page }) => {
		// Streak circle or banner should be visible
		await expect(page.locator('text=/streak|zile consecutive/i')).toBeVisible();
	});

	test('should display XP and badge information', async ({ page }) => {
		await expect(page.locator('text=/XP|Badge|Nivel/i')).toBeVisible();
	});

	test('should show medications list', async ({ page }) => {
		// Wait for medications to load
		await page.waitForTimeout(1000);
		
		// Check if medications section exists
		const medicationsSection = page.locator('text=/Medicamente|Tratamente/i');
		await expect(medicationsSection.first()).toBeVisible();
	});

	test('should navigate to treatments page', async ({ page }) => {
		await page.click('a[href="/treatments"]');
		await page.waitForURL('/treatments');
		await expect(page.locator('h1')).toContainText(/Tratamente/);
	});

	test('should navigate to leaderboard', async ({ page }) => {
		await page.click('a[href="/leaderboard"]');
		await page.waitForURL('/leaderboard');
		await expect(page.locator('h1')).toContainText(/Leaderboard/);
	});

	test('should navigate to profile', async ({ page }) => {
		await page.click('a[href="/profile"]');
		await page.waitForURL('/profile');
		await expect(page.locator('h1')).toContainText(/Profil/);
	});

	test('should navigate to settings', async ({ page }) => {
		await page.click('a[href="/settings"]');
		await page.waitForURL('/settings');
		await expect(page.locator('h1')).toContainText(/Setări/);
	});
});

test.describe('Patient Dashboard - Responsive', () => {
	test('should work on mobile viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		await expect(page.locator('h1')).toBeVisible();
	});

	test('should work on tablet viewport', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 }); // iPad

		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		await expect(page.locator('h1')).toBeVisible();
	});
});

test.describe('Patient Dashboard - Dark Mode', () => {
	test('should toggle dark mode', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Find and click dark mode toggle
		const darkModeToggle = page.locator('[aria-label*="theme" i], button:has-text("🌙"), button:has-text("☀")').first();
		if (await darkModeToggle.isVisible()) {
			await darkModeToggle.click();
			
			// Check if dark class is applied
			const html = page.locator('html');
			const hasClass = await html.evaluate(el => el.classList.contains('dark'));
			expect(hasClass).toBeTruthy();
		}
	});
});
