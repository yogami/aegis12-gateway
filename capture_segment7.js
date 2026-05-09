const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const filePath = `file://${path.resolve('/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/scratch/segment7_terminal.html')}`;
  
  console.log("Navigating to HTML file...");
  await page.goto(filePath);
  await page.waitForTimeout(1000); // Wait for rendering

  console.log("Capturing Segment 7 Frame...");
  await page.screenshot({ path: '/tmp/screenshots/segment_7_compliance.png', fullPage: true });

  console.log("Done! Saved to /tmp/screenshots/segment_7_compliance.png");
  await browser.close();
})();
