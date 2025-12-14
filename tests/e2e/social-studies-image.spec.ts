import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 667 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Social Studies image on ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test(`renders correctly and maintains layout (${vp.name})`, async ({ page }) => {
      await page.goto("http://localhost:5173/");
      const tile = page.getByRole("button", { name: "Social Studies" });
      await expect(tile).toBeVisible();
      const img = tile.locator('img[alt="Social Studies"]');
      await expect(img).toBeVisible();
      const src = await img.getAttribute("src");
      expect(src).toBe("https://www.championtutor.com/blog/wp-content/uploads/2023/04/Picture31.jpg");
      const loading = await img.getAttribute("loading");
      expect(loading).toBe("lazy");
      const decoding = await img.getAttribute("decoding");
      expect(decoding).toBe("async");
      const tileBox = await tile.boundingBox();
      const imgBox = await img.boundingBox();
      expect(tileBox?.width && tileBox?.height).toBeTruthy();
      expect(imgBox?.width && imgBox?.height).toBeTruthy();
      expect(Math.round((imgBox?.width || 0))).toBeGreaterThan(0);
      expect(Math.round((imgBox?.height || 0))).toBeGreaterThan(0);
      expect(Math.round((imgBox?.width || 0))).toBeLessThanOrEqual(Math.round((tileBox?.width || 0)));
      expect(Math.round((imgBox?.height || 0))).toBeLessThanOrEqual(Math.round((tileBox?.height || 0)));
    });
  });
}
