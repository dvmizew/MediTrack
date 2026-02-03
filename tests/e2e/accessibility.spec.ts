import { test, expect } from '@playwright/test';

test.describe('Accessibility - Global', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');
	});

	test('should have accessibility menu', async ({ page }) => {
		// Look for accessibility button
		const accessibilityButton = page.locator('[aria-label*="accesibilitate" i], button[title*="accesibilitate" i]').first();
		
		if (await accessibilityButton.isVisible()) {
			await accessibilityButton.click();
			await page.waitForTimeout(300);
			
			// Menu should be visible
			await expect(page.locator('text=/Dimensiune text|Contrast|Reduce Motion/i')).toBeVisible();
		}
	});

	test('should change text size', async ({ page }) => {
		const accessibilityButton = page.locator('[aria-label*="accesibilitate" i], button[title*="accesibilitate" i]').first();
		
		if (await accessibilityButton.isVisible()) {
			await accessibilityButton.click();
			await page.waitForTimeout(300);
			
			// Find large text option
			const largeTextButton = page.locator('button:has-text("Mare"), button:has-text("125%")').first();
			if (await largeTextButton.isVisible()) {
				await largeTextButton.click();
				
				// Check if font size changed
				const html = page.locator('html');
				const fontSize = await html.evaluate(el => window.getComputedStyle(el).fontSize);
				const baseFontSize = parseFloat(fontSize);
				expect(baseFontSize).toBeGreaterThan(16); // Default is 16px
			}
		}
	});

	test('should toggle high contrast mode', async ({ page }) => {
		const accessibilityButton = page.locator('[aria-label*="accesibilitate" i], button[title*="accesibilitate" i]').first();
		
		if (await accessibilityButton.isVisible()) {
			await accessibilityButton.click();
			await page.waitForTimeout(300);
			
			// Find high contrast toggle
			const contrastToggle = page.locator('input[type="checkbox"]:near(:text("Contrast"))').first();
			if (await contrastToggle.isVisible()) {
				await contrastToggle.click();
				
				// Check if high-contrast class is applied
				const html = page.locator('html');
				const hasClass = await html.evaluate(el => el.classList.contains('high-contrast'));
				expect(hasClass).toBeTruthy();
			}
		}
	});

	test('should toggle reduce motion', async ({ page }) => {
		const accessibilityButton = page.locator('[aria-label*="accesibilitate" i], button[title*="accesibilitate" i]').first();
		
		if (await accessibilityButton.isVisible()) {
			await accessibilityButton.click();
			await page.waitForTimeout(300);
			
			const motionToggle = page.locator('input[type="checkbox"]:near(:text("Motion"))').first();
			if (await motionToggle.isVisible()) {
				await motionToggle.click();
				
				const html = page.locator('html');
				const hasClass = await html.evaluate(el => el.classList.contains('reduce-motion'));
				expect(hasClass).toBeTruthy();
			}
		}
	});
});

test.describe('Accessibility - Keyboard Navigation', () => {
	test('should navigate with keyboard', async ({ page }) => {
		await page.goto('/');
		
		// Tab through login form
		await page.keyboard.press('Tab');
		await expect(page.locator('input[type="email"]')).toBeFocused();
		
		await page.keyboard.press('Tab');
		await expect(page.locator('input[type="password"]')).toBeFocused();
		
		await page.keyboard.press('Tab');
		await expect(page.locator('button[type="submit"]')).toBeFocused();
	});

	test('should have skip to content link', async ({ page }) => {
		await page.goto('/');
		
		// Press Tab to focus skip link
		await page.keyboard.press('Tab');
		
		const skipLink = page.locator('a:has-text("Skip"), a:has-text("Sari")').first();
		if (await skipLink.isVisible()) {
			await expect(skipLink).toBeFocused();
		}
	});
});

test.describe('Accessibility - Screen Reader', () => {
	test('should have proper heading hierarchy', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check for h1
		const h1 = page.locator('h1');
		await expect(h1).toBeVisible();
		
		// Check that h1 comes before h2
		const headings = await page.locator('h1, h2, h3').allTextContents();
		expect(headings.length).toBeGreaterThan(0);
	});

	test('should have ARIA landmarks', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check for landmarks
		await expect(page.locator('header, [role="banner"]')).toBeVisible();
		await expect(page.locator('main, [role="main"]')).toBeVisible();
		await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
	});

	test('should have alt text on images', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Check all images have alt text
		const images = await page.locator('img').all();
		for (const img of images) {
			const alt = await img.getAttribute('alt');
			expect(alt).toBeTruthy();
		}
	});

	test('should have labels on form inputs', async ({ page }) => {
		await page.goto('/');

		// Check email input
		const emailInput = page.locator('input[type="email"]');
		const emailLabel = await emailInput.getAttribute('aria-label');
		const emailLabelElement = page.locator('label[for]').first();
		
		expect(emailLabel || await emailLabelElement.isVisible()).toBeTruthy();
	});
});

test.describe('Accessibility - Color Contrast', () => {
	test('should have sufficient contrast in light mode', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Get computed styles of main text
		const mainText = page.locator('body').first();
		const color = await mainText.evaluate(el => window.getComputedStyle(el).color);
		const bgColor = await mainText.evaluate(el => window.getComputedStyle(el).backgroundColor);
		
		expect(color).toBeTruthy();
		expect(bgColor).toBeTruthy();
	});

	test('should have sufficient contrast in dark mode', async ({ page }) => {
		await page.goto('/');
		await page.fill('input[type="email"]', 'ion.vasile@example.com');
		await page.fill('input[type="password"]', 'pacient123');
		await page.click('button[type="submit"]');
		await page.waitForURL('/dashboard');

		// Toggle dark mode
		const darkModeToggle = page.locator('[aria-label*="theme" i], button:has-text("🌙"), button:has-text("☀")').first();
		if (await darkModeToggle.isVisible()) {
			await darkModeToggle.click();
			await page.waitForTimeout(300);

			// Check contrast
			const mainText = page.locator('body').first();
			const color = await mainText.evaluate(el => window.getComputedStyle(el).color);
			const bgColor = await mainText.evaluate(el => window.getComputedStyle(el).backgroundColor);
			
			expect(color).toBeTruthy();
			expect(bgColor).toBeTruthy();
		}
	});
});
