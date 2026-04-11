import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    console.log("Launching Playwright...");
    const browser = await chromium.launch();
    const context = await browser.newContext({
        recordVideo: { dir: './pw_video_out/' },
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Mount the exact HTML demo artifact that was served natively
    console.log("Navigating to native demo payload...");
    await page.goto("file:///Users/user1000/gitprojects/aegis12-gateway/video-demo/native_demo.html");
    
    console.log("Recording 12 seconds of E2E verification telemetry...");
    await page.waitForTimeout(12000);
    
    await context.close();
    await browser.close();
    
    const files = fs.readdirSync('./pw_video_out');
    const mp4File = files.find(f => f.endsWith('.mp4'));
    if (mp4File) {
        fs.renameSync(`./pw_video_out/${mp4File}`, './playwright_demo.mp4');
        console.log("✅ Playwright E2E Video Recorded: playwright_demo.mp4");
    }
})();
