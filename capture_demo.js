const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to live dashboard...");
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Wait for animations to settle

  console.log("Capturing Segment 1 Frame...");
  await page.screenshot({ path: '/tmp/screenshots/slide_1.png', fullPage: true });

  console.log("Done! Saved to /tmp/screenshots/slide_1.png");
  await browser.close();
})();
