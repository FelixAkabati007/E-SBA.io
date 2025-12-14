import { test, expect } from "@playwright/test";

test.describe("Footer layout and accessibility", () => {
  test("desktop: horizontal with dividers, fixed to bottom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:5173/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    const text = await footer.textContent();
    expect(text).toContain("Mr. Felix Akabati");
    expect(text).toContain("All Rights Reserved");
    const link = footer.getByRole("link", {
      name: "felixakabati007@gmail.com",
    });
    await expect(link).toHaveAttribute(
      "href",
      "mailto:felixakabati007@gmail.com"
    );
    const box = await footer.boundingBox();
    expect(box?.y || 0).toBeGreaterThan(700);
    const dividers = await footer.locator('text="|"').count();
    expect(dividers).toBeGreaterThanOrEqual(2);
  });

  test("mobile: stacked vertically", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("http://localhost:5173/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    const pipes = footer.locator('text="|"');
    const pipeCount = await pipes.count();
    for (let i = 0; i < pipeCount; i++) {
      await expect(pipes.nth(i)).toBeHidden();
    }
    const items = footer.locator("span, a");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
