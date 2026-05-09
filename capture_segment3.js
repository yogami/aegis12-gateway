const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to live dashboard...");
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Wait for animations

  console.log("Highlighting Segment 3 Policy Module...");
  // The policy module is the first <section> on the page
  const policyModule = page.locator('section').first();
  
  // Highlight it for dramatic effect
  await policyModule.evaluate(node => {
      node.style.border = '4px solid #06b6d4'; // cyan border
      node.style.boxShadow = '0 0 40px #06b6d4';
      node.style.transform = 'scale(1.05)';
      node.style.transition = 'all 0.5s ease';
      node.style.zIndex = '50';
      node.style.position = 'relative';
  });
  await page.waitForTimeout(1000); // let transition finish
  
  console.log("Capturing full 1920x1080 frame...");
  // Take a full viewport screenshot instead of just the element
  await page.screenshot({ path: '/tmp/screenshots/segment_3_policy.png' });

  console.log("Done! Saved to /tmp/screenshots/segment_3_policy.png");
  await browser.close();
})();
