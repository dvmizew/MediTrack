import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
	test.beforeEach(async ({ page }) => {
		// Login as admin
		await page.goto('/');
		await page.fill('input[type="email"]', 'admin@meditrack.com');
		await page.fill('input[type="password"]', 'admin123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should display admin dashboard', async ({ page }) => {
		await expect(page.locator('h1')).toContainText(/Dashboard/);
		
		// Admin should see user management links
		await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
		await expect(page.locator('a[href="/admin/reports"]')).toBeVisible();
	});

	test('should navigate to users management', async ({ page }) => {
		await page.click('a[href="/admin/users"]');
		await page.waitForURL('/admin/users');
		await expect(page.locator('h1')).toContainText(/Utilizatori|Gestionare/i);
	});

	test('should display users list', async ({ page }) => {
		await page.goto('/admin/users');
		
		// Wait for users table to load
		await page.waitForTimeout(1000);
		
		// Check for table headers
		await expect(page.locator('text=/Email|Rol|Status/i')).toBeVisible();
	});

	test('should filter users by role', async ({ page }) => {
		await page.goto('/admin/users');
		await page.waitForTimeout(1000);
		
		// Select filter
		const roleFilter = page.locator('select, [aria-label*="rol" i]').first();
		if (await roleFilter.isVisible()) {
			await roleFilter.selectOption('pacient');
			await page.waitForTimeout(500);
		}
	});

	test('should search users', async ({ page }) => {
		await page.goto('/admin/users');
		await page.waitForTimeout(1000);
		
		const searchInput = page.locator('input[type="search"], input[placeholder*="căuta" i], input[placeholder*="nume" i]').first();
		if (await searchInput.isVisible()) {
			await searchInput.fill('ion');
			await page.waitForTimeout(500);
		}
	});

	test('should navigate to reports', async ({ page }) => {
		await page.click('a[href="/admin/reports"]');
		await page.waitForURL('/admin/reports');
		await expect(page.locator('h1')).toContainText(/Rapoarte/i);
	});

	test('should display statistics on reports page', async ({ page }) => {
		await page.goto('/admin/reports');
		await page.waitForTimeout(1000);
		
		// Check for statistics cards
		await expect(page.locator('text=/Utilizatori|Tratamente|Doze/i')).toBeVisible();
	});

	test('should navigate to report jobs', async ({ page }) => {
		await page.goto('/admin/reports');
		
		const jobsLink = page.locator('a[href="/admin/reports/jobs"]');
		if (await jobsLink.isVisible()) {
			await jobsLink.click();
			await page.waitForURL('/admin/reports/jobs');
		}
	});
});

test.describe('Admin Panel - User Management', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'admin@meditrack.com');
		await page.fill('input[type="password"]', 'admin123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
		await page.goto('/admin/users');
		await page.waitForTimeout(1000);
	});

	test('should open create user modal', async ({ page }) => {
		const createButton = page.locator('button:has-text("Adaugă"), button:has-text("Nou")').first();
		if (await createButton.isVisible()) {
			await createButton.click();
			await page.waitForTimeout(500);
			
			// Modal should be visible
			await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
		}
	});
});

test.describe('Admin Panel - Accessibility', () => {
	test('should have proper ARIA landmarks', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'admin@meditrack.com');
		await page.fill('input[type="password"]', 'admin123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check for main landmark
		await expect(page.locator('main, [role="main"]')).toBeVisible();
	});
});
