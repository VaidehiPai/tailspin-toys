import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('should filter games by category and publisher', async ({ page }) => {
    await page.getByTestId('category-filter-strategy').check();
    await page.getByTestId('publisher-filter').selectOption({ label: 'CodeForge Studios' });
    await page.getByTestId('apply-filters').click();

    await expect(page.getByTestId('games-grid')).toBeVisible();
    await expect(page.getByRole('link', { name: /DevOps Dominion/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pipeline Conquest/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Repo Rulers/i })).toHaveCount(0);
  });
});
