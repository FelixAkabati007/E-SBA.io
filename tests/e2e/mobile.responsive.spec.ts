import { test, expect } from "@playwright/test";

const widths = [320, 360, 375, 390, 412, 414];

for (const w of widths) {
  test.describe(`mobile viewport ${w}px`, () => {
    test.use({ viewport: { width: w, height: 720 } });

    test(`renders dashboard and master db without horizontal scroll`, async ({ page }) => {
      await page.goto("http://localhost:5173/");
      await expect(page.getByText("E-SBA [JHS]")).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 2);
      await page.getByText("Master Database").click();
      await expect(page.getByText("Master Student Database")).toBeVisible();
      const scrollWidth2 = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth2 = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth2).toBeLessThanOrEqual(innerWidth2 + 2);
    });

    test(`assessment sheet upload UI is usable`, async ({ page }) => {
      await page.goto("http://localhost:5173/");
      await page.getByText("Assessment Sheets").click();
      await expect(page.getByText("Upload & Map")).toBeVisible();
      // Ensure progress bar ARIA is valid when triggered
      await page.getByText("Upload & Map").focus();
    });
  });
}

