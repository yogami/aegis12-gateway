const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: '/Users/user1000/gitprojects/aegis12-gateway/video_out/',
      size: { width: 1920, height: 1080 }
    }
  });
  
  if (!fs.existsSync('/Users/user1000/gitprojects/aegis12-gateway/video_out/')) {
    fs.mkdirSync('/Users/user1000/gitprojects/aegis12-gateway/video_out/');
  }

  const page = await context.newPage();

  console.log("Navigating to dashboard...");
  await page.goto('https://aegis12-dashboarduprailwayapp-production.up.railway.app');

  console.log("Zooming out to 80% to fit everything on screen...");
  await page.evaluate(() => { document.body.style.zoom = "80%" });
  
  console.log("Scene 1: Overview (pause 5s)...");
  await page.waitForTimeout(5000);

  console.log("Scene 2: Triggering Intent Stream...");
  await page.click('button:has-text("Trigger Intent Stream")');
  await page.waitForTimeout(16000); // Wait for stream to finish connecting and executing

  console.log("Scene 3: Verifying Registry (pause 4s)...");
  await page.waitForTimeout(4000);
  
  console.log("Scene 4: Circuit Breaker Lockdown...");
  await page.click('button:has-text("Force Circuit Breaker Lockdown")');
  await page.waitForTimeout(5000);

  console.log("Scene 5: Recovery...");
  await page.click('button:has-text("Override Multisig Lockdown")');
  await page.waitForTimeout(3000);
  await page.click('button:has-text("Trigger Intent Stream")');
  await page.waitForTimeout(16000); // Wait for second stream

  console.log("Final pause (3s)...");
  await page.waitForTimeout(3000); 

  await context.close();
  await browser.close();
  console.log("Recording finished.");
})();
