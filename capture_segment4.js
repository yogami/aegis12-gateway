const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to HTML file...");
  const htmlPath = 'file://' + path.resolve('/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/scratch/segment4_terminal.html');
  await page.goto(htmlPath);
  await page.waitForTimeout(1000); // Wait for rendering

  console.log("Capturing Segment 4 Frame...");
  await page.screenshot({ path: '/tmp/screenshots/segment_4_attestation.png', fullPage: true });

  console.log("Done! Saved to /tmp/screenshots/segment_4_attestation.png");
  await browser.close();
})();
