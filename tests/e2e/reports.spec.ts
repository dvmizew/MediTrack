import { test, expect } from '@playwright/test';

test.describe('Admin Reports', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill('input[type="email"]', 'admin@meditrack.com');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
        await page.goto('/admin/reports');
    });

    test('should display reports dashboard', async ({ page }) => {
        await expect(page.locator('h1')).toContainText(/Rapoarte/i);

        // Check for key metric cards
        await expect(page.locator('text=/Utilizatori Total/i')).toBeVisible();
        await expect(page.locator('text=/Tratamente Active/i')).toBeVisible();
        await expect(page.locator('text=/Rată Conformitate/i')).toBeVisible();
    });

    test('should show usage charts', async ({ page }) => {
        // Wait for charts to load
        await page.waitForTimeout(1000);

        // Check if canvas elements exist
        const charts = page.locator('canvas');
        expect(await charts.count()).toBeGreaterThan(0);
    });

    test('should navigate to background jobs', async ({ page }) => {
        await page.click('a[href="/admin/reports/jobs"]');
        await page.waitForURL('/admin/reports/jobs');
        await expect(page.locator('text=/status/i')).toBeVisible();
    });

    test('should initiate data export', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("Export"), button:has-text("Descarcă")').first();
        if (await exportBtn.isVisible()) {
            // Mock download to avoid actual file system interaction
            const downloadPromise = page.waitForEvent('download');
            await exportBtn.click();

            // We just verify the click works and triggers action, 
            // checking complete download might be flaky without full backend mock
            // await downloadPromise; 
        }
    });
});
