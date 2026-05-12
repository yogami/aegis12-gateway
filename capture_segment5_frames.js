const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log("Navigating to live dashboard...");
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Wait for initial render

  // Helper to inject a log and highlight it
  const injectLog = async (text, colorClass, isRedHighlight) => {
    await page.evaluate(({text, colorClass, isRedHighlight}) => {
      const terminal = document.getElementById('telemetry-terminal');
      
      // Remove old highlights
      document.querySelectorAll('.seg5-highlight').forEach(el => {
          el.style.backgroundColor = 'transparent';
          el.style.border = 'none';
          el.classList.remove('seg5-highlight');
      });

      const newLog = document.createElement('div');
      newLog.className = `mb-1 ${colorClass} ${isRedHighlight ? 'seg5-highlight' : ''}`;
      newLog.innerText = text;
      
      if (isRedHighlight) {
          newLog.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // Tailwind red-500 with opacity
          newLog.style.border = '1px solid #ef4444';
          newLog.style.padding = '2px 4px';
          newLog.style.borderRadius = '4px';
      }
      
      // Insert before the blinking cursor
      terminal.insertBefore(newLog, terminal.lastElementChild);
      
      // Auto-scroll
      terminal.scrollTop = terminal.scrollHeight;
    }, {text, colorClass, isRedHighlight});
    await page.waitForTimeout(300);
  };

  // --- FRAME 1: The Theory ---
  console.log("Capturing Frame 1...");
  await page.screenshot({ path: '/tmp/screenshots/seg5_f1.png', fullPage: true });

  // --- FRAME 2: The Attack ---
  console.log("Capturing Frame 2...");
  await injectLog(">>> INTERCEPTED INTENT STREAM <<<", "text-cyan-400 font-bold mt-4", false);
  await injectLog("[Eliza_Agent_01] Intent: Transfer 100 SOL to unknown address", "text-slate-300", true);
  await page.screenshot({ path: '/tmp/screenshots/seg5_f2.png', fullPage: true });

  // --- FRAME 3: The Interception ---
  console.log("Capturing Frame 3...");
  await injectLog("[TEE_Enclave] Evaluating against Fiduciary Policy (Max: 0.05 SOL)...", "text-slate-300", true);
  await page.screenshot({ path: '/tmp/screenshots/seg5_f3.png', fullPage: true });

  // --- FRAME 4: The Denial ---
  console.log("Capturing Frame 4...");
  await page.evaluate(() => {
    // Force lockdown state visually
    const statusBadge = document.getElementById('enclave-status');
    statusBadge.className = "px-4 py-2 rounded font-bold text-sm border flex items-center gap-2 bg-red-950/30 text-red-500 border-red-900/50 animate-pulse";
    statusBadge.innerHTML = `<span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>🔴 LOCKDOWN INITIATED`;
    
    // Add red overlay
    const overlay = document.createElement('div');
    overlay.className = "absolute inset-0 bg-red-950/20 pointer-events-none backdrop-blur-[1px]";
    document.getElementById('telemetry-terminal').parentElement.appendChild(overlay);
  });
  await injectLog("🔴 [DENIED] Intent exceeds maximum trade limit.", "text-red-400 font-bold", true);
  await injectLog("🔒 [CIRCUIT BREAKER] Signature mathematically refused. Transaction blocked.", "text-red-400", true);
  await page.screenshot({ path: '/tmp/screenshots/seg5_f4.png', fullPage: true });

  // --- FRAME 5: The Escalation ---
  console.log("Capturing Frame 5...");
  await injectLog("✅ [ESCALATION] Intent packaged into Squads V4 Proposal #842 for human review.", "text-green-400 font-bold", true);
  await page.screenshot({ path: '/tmp/screenshots/seg5_f5.png', fullPage: true });

  console.log("Done! All 5 frames captured.");
  await browser.close();
})();
