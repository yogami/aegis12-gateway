const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    
    console.log("Navigating to actual Phala frontend...");
    await page.goto('https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log("Capturing screenshot...");
    await page.screenshot({ path: '/tmp/screenshots/actual_phala_frontend.png', fullPage: true });
    
    console.log("Done! Saved to /tmp/screenshots/actual_phala_frontend.png");
    await browser.close();
  } catch (err) {
    console.error("Error capturing:", err);
  }
})();
