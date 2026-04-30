/**
 * Segment 3 Recorder v2: Live Dashboard Demo with scroll-aware highlights
 */
import { chromium } from 'playwright';
import path from 'path';

const OUTPUT_DIR = path.resolve(__dirname);

async function injectHighlight(page: any, selector: string, label: string, duration: number, color = '#00ffaa') {
    await page.evaluate(({ sel, lbl, clr }: { sel: string; lbl: string; clr: string }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        
        // Scroll element into view first
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Small delay for scroll to settle
        return new Promise(resolve => setTimeout(resolve, 300));
    }, { sel: selector, lbl: label, clr: color });
    
    await page.waitForTimeout(400);
    
    await page.evaluate(({ sel, lbl, clr }: { sel: string; lbl: string; clr: string }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
        
        if (!document.getElementById('aegis-highlight-style')) {
            const style = document.createElement('style');
            style.id = 'aegis-highlight-style';
            style.textContent = `@keyframes highlightPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`;
            document.head.appendChild(style);
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'aegis-highlight';
        overlay.style.cssText = `
            position:fixed; left:${rect.left-6}px; top:${Math.max(rect.top-6, 10)}px;
            width:${rect.width+12}px; height:${Math.min(rect.height+12, 680)}px;
            border:3px solid ${clr}; border-radius:8px;
            box-shadow:0 0 25px ${clr}66; z-index:99999; pointer-events:none;
            animation:highlightPulse 1.5s ease-in-out infinite;
        `;
        
        const labelEl = document.createElement('div');
        labelEl.id = 'aegis-highlight-label';
        labelEl.style.cssText = `
            position:fixed; left:${rect.left-6}px; top:${Math.max(rect.top-34, 4)}px;
            background:${clr}22; backdrop-filter:blur(8px); border:1px solid ${clr}88;
            color:${clr}; font-family:'Inter',monospace; font-size:13px; font-weight:600;
            padding:3px 10px; border-radius:4px; z-index:99999; pointer-events:none;
        `;
        labelEl.textContent = lbl;
        
        document.body.appendChild(overlay);
        document.body.appendChild(labelEl);
    }, { sel: selector, lbl: label, clr: color });
    
    await page.waitForTimeout(duration);
    
    await page.evaluate(() => {
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
    });
}

async function scrollAndHighlightLog(page: any, text: string, label: string, duration: number, color = '#00ffaa') {
    // First scroll the matching log entry into view
    const found = await page.evaluate(({ txt }: { txt: string }) => {
        const entries = document.querySelectorAll('[class*="logLine"]');
        for (const entry of entries) {
            if (entry.textContent?.includes(txt)) {
                entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
        }
        return false;
    }, { txt: text });
    
    if (!found) { console.log(`  ⚠️ Log "${text}" not found`); return; }
    await page.waitForTimeout(500);
    
    // Now highlight at the current position
    await page.evaluate(({ txt, lbl, clr }: { txt: string; lbl: string; clr: string }) => {
        const entries = document.querySelectorAll('[class*="logLine"]');
        let targetEl: Element | null = null;
        for (const entry of entries) {
            if (entry.textContent?.includes(txt)) { targetEl = entry; break; }
        }
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'aegis-highlight';
        overlay.style.cssText = `
            position:fixed; left:${rect.left-4}px; top:${Math.max(rect.top-4, 10)}px;
            width:${rect.width+8}px; height:${rect.height+8}px;
            border:2px solid ${clr}; border-radius:6px;
            box-shadow:0 0 20px ${clr}88; z-index:99999; pointer-events:none;
        `;
        
        const labelEl = document.createElement('div');
        labelEl.id = 'aegis-highlight-label';
        labelEl.style.cssText = `
            position:fixed; right:20px; top:${Math.max(rect.top-2, 10)}px;
            background:${clr}22; border:1px solid ${clr}88; color:${clr};
            font-family:'Inter',monospace; font-size:12px; font-weight:700;
            padding:4px 10px; border-radius:4px; z-index:99999; pointer-events:none;
            white-space:nowrap; text-transform:uppercase; letter-spacing:1px;
        `;
        labelEl.textContent = lbl;
        
        document.body.appendChild(overlay);
        document.body.appendChild(labelEl);
    }, { txt: text, lbl: label, clr: color });
    
    await page.waitForTimeout(duration);
    await page.evaluate(() => {
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
    });
}

async function main() {
    console.log('[Seg3] Starting dashboard recording v2...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    
    // Phase 1: Highlight title (2s)
    console.log('[Seg3] Highlighting title...');
    await injectHighlight(page, 'h1', '▶ AEGIS-12 SECURITY DASHBOARD', 2000);
    
    // Phase 2: Highlight scenario selector (2s)
    console.log('[Seg3] Highlighting selector...');
    await injectHighlight(page, 'select', '▶ HAPPY PATH SELECTED', 2000);
    
    // Phase 3: Click execute
    console.log('[Seg3] Clicking execute...');
    await injectHighlight(page, 'button[class*="executeBtn"]', '▶ FIRE ENFORCEMENT REQUEST', 1500);
    await page.click('button[class*="executeBtn"]');
    
    // Wait for success response
    console.log('[Seg3] Waiting for enclave response...');
    try {
        await page.waitForSelector('[class*="logSuccess"]', { timeout: 20000 });
        console.log('[Seg3] ✅ Success response received!');
    } catch {
        console.log('[Seg3] Timeout — continuing with whatever logs exist...');
    }
    await page.waitForTimeout(1500);
    
    // Scroll & highlight key log entries
    await scrollAndHighlightLog(page, 'Initializing', '▶ TEE BOOT SEQUENCE', 2000);
    await scrollAndHighlightLog(page, 'Production Gateway', '▶ ROUTING TO HARDWARE ENCLAVE', 2500);
    await scrollAndHighlightLog(page, 'Firewall Decision', '✅ POLICY ENFORCEMENT PASSED', 3000, '#00ff88');
    await scrollAndHighlightLog(page, 'Compliance Hash', '🔐 CRYPTOGRAPHIC RECEIPT', 2500, '#00ff88');
    
    // Highlight explorer panel if present
    const explorerPanel = await page.$('[class*="explorerPanel"]');
    if (explorerPanel) {
        console.log('[Seg3] Highlighting explorer panel...');
        await injectHighlight(page, '[class*="explorerPanel"]', '▶ ON-CHAIN EVIDENCE', 3000, '#00aaff');
        await injectHighlight(page, '[class*="explorerPanel"] [class*="dataGroup"]:nth-child(1)', '▶ ENCLAVE DID', 2500, '#00aaff');
    }
    
    await page.waitForTimeout(2000);
    
    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();
    console.log(`[Seg3] ✅ Video saved: ${videoPath}`);
}

main().catch(err => { console.error('[Seg3] Fatal:', err); process.exit(1); });
