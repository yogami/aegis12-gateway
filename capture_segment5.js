const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to live dashboard...");
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Wait for animations

  console.log("Triggering Segment 5 Simulation...");
  await page.click('#btn-trigger-segment5');

  // Wait 3.5 seconds for all the setTimeouts to finish and logs to populate
  console.log("Waiting for telemetry logs to stream...");
  await page.waitForTimeout(3500); 

  console.log("Highlighting Telemetry Terminal...");
  // Highlight the terminal block
  const terminalBlock = page.locator('#telemetry-terminal').locator('..'); // get parent container
  
  await terminalBlock.evaluate(node => {
      node.style.border = '4px solid #a855f7'; // purple border to match the script intensity
      node.style.boxShadow = '0 0 50px rgba(168, 85, 247, 0.4)';
      node.style.transform = 'scale(1.02)';
      node.style.transition = 'all 0.5s ease';
      node.style.zIndex = '50';
      node.style.position = 'relative';
  });
  
  // Wait for the transition
  await page.waitForTimeout(1000);

  console.log("Capturing full 1920x1080 frame for Segment 5...");
  await page.screenshot({ path: '/tmp/screenshots/segment_5_escalation.png', fullPage: true });

  console.log("Done! Saved to /tmp/screenshots/segment_5_escalation.png");
  await browser.close();
})();
