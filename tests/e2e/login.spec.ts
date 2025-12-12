import { test, expect } from '@playwright/test';

test.describe('Login Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MediTrack');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.toast.error, [class*="error"]')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle between login and register', async ({ page }) => {
    const toggleButton = page.locator('button:has-text("Nu ai cont")');
    await expect(toggleButton).toBeVisible();
    
    await toggleButton.click();
    
    await expect(page.locator('input#fullName')).toBeVisible();
    await expect(page.locator('h1 + p')).toContainText('Creează');
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    // Switch to register
    await page.click('button:has-text("Nu ai cont")');

    // Try to submit with invalid email
    await page.fill('input[type="email"]', 'invalid');
    await page.fill('input[type="password"]', '12345');
    await page.fill('input#fullName', 'T');
    await page.click('button[type="submit"]');

    // Should show error (either inline or toast)
    await page.waitForTimeout(1000);
    const hasError = await page.locator('.toast, [class*="error"]').count() > 0;
    expect(hasError).toBeTruthy();
  });

  test('should enable dark mode toggle', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();
    
    await themeToggle.click();
    
    // Check if dark class is added to html or body
    const isDark = await page.locator('html.dark, body.dark').count() > 0;
    expect(isDark).toBeTruthy();
  });
});

test.describe('Dashboard Access', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');
    
    // Should redirect to root (login page)
    await expect(page).toHaveURL('http://localhost:5173/');
  });
});
