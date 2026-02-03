import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('should display login page', async ({ page }) => {
		await expect(page).toHaveTitle(/MediTrack/);
		await expect(page.locator('h1')).toContainText(/MediTrack/);
	});

	test('should login as patient', async ({ page }) => {
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');

		// Wait for navigation to dashboard
		await page.waitForURL('/dashboard');
		await expect(page.locator('h1')).toContainText(/Dashboard/);
	});

	test('should login as doctor', async ({ page }) => {
		await page.fill('input[type="email"]', 'dr.ionescu@meditrack.com');
		await page.fill('input[type="password"]', 'medic123');
		await page.click('button[type="submit"]');

		await page.waitForURL('/dashboard');
		await expect(page.locator('h1')).toContainText(/Dashboard/);
	});

	test('should login as admin', async ({ page }) => {
		await page.fill('input[type="email"]', 'admin@meditrack.com');
		await page.fill('input[type="password"]', 'admin123');
		await page.click('button[type="submit"]');

		await page.waitForURL('/dashboard');
		await expect(page.locator('h1')).toContainText(/Dashboard/);
	});

	test('should show error on invalid credentials', async ({ page }) => {
		await page.fill('input[type="email"]', 'invalid@test.com');
		await page.fill('input[type="password"]', 'wrongpassword');
		await page.click('button[type="submit"]');

		// Should stay on login page and show error
		await expect(page).toHaveURL('/');
		await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
	});

	test('should validate email format', async ({ page }) => {
		await page.fill('input[type="email"]', 'invalid-email');
		await page.fill('input[type="password"]', 'password123');
		await page.click('button[type="submit"]');

		// HTML5 validation should prevent submission
		const emailInput = page.locator('input[type="email"]');
		await expect(emailInput).toHaveJSProperty('validity.valid', false);
	});
});

test.describe('Authentication - Logout', () => {
	test('should logout successfully', async ({ page }) => {
		// Login first
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Logout
		await page.click('[aria-label="Deconectare"], button:has-text("Deconectare")');
		await page.waitForURL('/');
		await expect(page.locator('h1')).toContainText(/MediTrack/);
	});
});

test.describe('Authentication - Accessibility', () => {
	test('should be keyboard navigable', async ({ page }) => {
		await page.goto('/');
		
		// Tab through form fields
		await page.keyboard.press('Tab');
		await expect(page.locator('input[type="email"]')).toBeFocused();
		
		await page.keyboard.press('Tab');
		await expect(page.locator('input[type="password"]')).toBeFocused();
		
		await page.keyboard.press('Tab');
		await expect(page.locator('button[type="submit"]')).toBeFocused();
	});

	test('should have proper ARIA labels', async ({ page }) => {
		await page.goto('/');
		
		const emailInput = page.locator('input[type="email"]');
		const passwordInput = page.locator('input[type="password"]');
		
		await expect(emailInput).toHaveAttribute('aria-label', /.+/);
		await expect(passwordInput).toHaveAttribute('aria-label', /.+/);
	});
});
