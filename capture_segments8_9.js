const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to Segment 8 HTML file...");
  await page.goto(`file://${path.resolve('/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/scratch/segment8_dashboard.html')}`);
  await page.waitForTimeout(1000);
  console.log("Capturing Segment 8 Frame...");
  await page.screenshot({ path: '/tmp/screenshots/segment_8_latency.png', fullPage: true });

  console.log("Navigating to Segment 9 HTML file...");
  await page.goto(`file://${path.resolve('/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/scratch/segment9_cta.html')}`);
  await page.waitForTimeout(1000);
  console.log("Capturing Segment 9 Frame...");
  await page.screenshot({ path: '/tmp/screenshots/segment_9_cta.png', fullPage: true });

  console.log("Done! Saved Segment 8 and 9 screenshots to /tmp/screenshots/");
  await browser.close();
})();
