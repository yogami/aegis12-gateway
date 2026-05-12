/**
 * Segment 4 v2: Killswitch Demo with scroll-aware highlights
 */
import { chromium } from 'playwright';
import path from 'path';

const OUTPUT_DIR = path.resolve(__dirname);

async function injectHighlight(page: any, selector: string, label: string, duration: number, color = '#00ffaa') {
    await page.evaluate(({ sel }: { sel: string }) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return new Promise(r => setTimeout(r, 300));
    }, { sel: selector });
    await page.waitForTimeout(400);
    
    await page.evaluate(({ sel, lbl, clr }: { sel: string; lbl: string; clr: string }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
        if (!document.getElementById('aegis-highlight-style')) {
            const s = document.createElement('style'); s.id = 'aegis-highlight-style';
            s.textContent = `@keyframes highlightPulse{0%,100%{opacity:1}50%{opacity:0.7}}`;
            document.head.appendChild(s);
        }
        const o = document.createElement('div'); o.id = 'aegis-highlight';
        o.style.cssText = `position:fixed;left:${rect.left-6}px;top:${Math.max(rect.top-6,10)}px;width:${rect.width+12}px;height:${Math.min(rect.height+12,680)}px;border:3px solid ${clr};border-radius:8px;box-shadow:0 0 25px ${clr}66;z-index:99999;pointer-events:none;animation:highlightPulse 1.5s ease-in-out infinite;`;
        const l = document.createElement('div'); l.id = 'aegis-highlight-label';
        l.style.cssText = `position:fixed;left:${rect.left-6}px;top:${Math.max(rect.top-34,4)}px;background:${clr}22;backdrop-filter:blur(8px);border:1px solid ${clr}88;color:${clr};font-family:'Inter',monospace;font-size:13px;font-weight:600;padding:3px 10px;border-radius:4px;z-index:99999;pointer-events:none;`;
        l.textContent = lbl;
        document.body.appendChild(o); document.body.appendChild(l);
    }, { sel: selector, lbl: label, clr: color });
    await page.waitForTimeout(duration);
    await page.evaluate(() => { document.getElementById('aegis-highlight')?.remove(); document.getElementById('aegis-highlight-label')?.remove(); });
}

async function scrollAndHighlightLog(page: any, text: string, label: string, duration: number, color = '#ff4444') {
    const found = await page.evaluate(({ txt }: { txt: string }) => {
        const entries = document.querySelectorAll('[class*="logLine"]');
        for (const e of entries) { if (e.textContent?.includes(txt)) { e.scrollIntoView({ behavior:'smooth', block:'center' }); return true; } }
        return false;
    }, { txt: text });
    if (!found) { console.log(`  ⚠️ "${text}" not found`); return; }
    await page.waitForTimeout(500);
    
    await page.evaluate(({ txt, lbl, clr }: { txt: string; lbl: string; clr: string }) => {
        const entries = document.querySelectorAll('[class*="logLine"]');
        let el: Element | null = null;
        for (const e of entries) { if (e.textContent?.includes(txt)) { el = e; break; } }
        if (!el) return;
        const rect = el.getBoundingClientRect();
        document.getElementById('aegis-highlight')?.remove();
        document.getElementById('aegis-highlight-label')?.remove();
        const o = document.createElement('div'); o.id = 'aegis-highlight';
        o.style.cssText = `position:fixed;left:${rect.left-4}px;top:${Math.max(rect.top-4,10)}px;width:${rect.width+8}px;height:${rect.height+8}px;border:3px solid ${clr};border-radius:6px;box-shadow:0 0 25px ${clr}88;z-index:99999;pointer-events:none;`;
        const l = document.createElement('div'); l.id = 'aegis-highlight-label';
        l.style.cssText = `position:fixed;right:20px;top:${Math.max(rect.top-2,10)}px;background:${clr}33;border:1px solid ${clr}; color:${clr};font-family:'Inter',monospace;font-size:13px;font-weight:700;padding:5px 12px;border-radius:4px;z-index:99999;pointer-events:none;white-space:nowrap;text-transform:uppercase;letter-spacing:1px;`;
        l.textContent = lbl;
        document.body.appendChild(o); document.body.appendChild(l);
    }, { txt: text, lbl: label, clr: color });
    await page.waitForTimeout(duration);
    await page.evaluate(() => { document.getElementById('aegis-highlight')?.remove(); document.getElementById('aegis-highlight-label')?.remove(); });
}

async function main() {
    console.log('[Seg4] Starting killswitch recording v2...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    
    // Select attack vector
    console.log('[Seg4] Selecting attack...');
    await injectHighlight(page, 'select', '▶ SELECT ATTACK VECTOR', 2000, '#ff8800');
    await page.selectOption('select', 'IDENTITY_SPOOF');
    await page.waitForTimeout(800);
    await injectHighlight(page, 'select', '⚠️ SPOOF AGENT TIER (CRIT-01)', 2500, '#ff4444');
    
    // Fire
    console.log('[Seg4] Firing attack...');
    await injectHighlight(page, 'button[class*="executeBtn"]', '▶ FIRE MALICIOUS PAYLOAD', 1500, '#ff4444');
    await page.click('button[class*="executeBtn"]');
    
    // Wait for error response
    try {
        await page.waitForSelector('[class*="logError"]', { timeout: 20000 });
        console.log('[Seg4] ✅ BLOCK response received!');
    } catch { console.log('[Seg4] Timeout...'); }
    await page.waitForTimeout(1500);
    
    // Scroll to and highlight results
    await scrollAndHighlightLog(page, 'BLOCK', '⛔ KILLSWITCH ENGAGED', 3500, '#ff4444');
    await scrollAndHighlightLog(page, 'Reason', '⚠️ POLICY VIOLATION DETECTED', 3000, '#ff8800');
    await scrollAndHighlightLog(page, 'LOCKDOWN', '🔒 HARDWARE-ENFORCED DENIAL', 3500, '#ff4444');
    
    await page.waitForTimeout(2000);
    
    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();
    console.log(`[Seg4] ✅ Video saved: ${videoPath}`);
}

main().catch(err => { console.error('[Seg4] Fatal:', err); process.exit(1); });
