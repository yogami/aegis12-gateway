/**
 * Segment 5 v2: Closing — Local Mantle Explorer mock + Logo end card
 */
import { chromium } from 'playwright';
import path from 'path';

const OUTPUT_DIR = path.resolve(__dirname);
const MOCK_HTML = `file://${path.resolve(__dirname, 'mantle_explorer_mock.html')}`;

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
            s.textContent = `@keyframes highlightPulse{0%,100%{box-shadow:0 0 20px var(--hclr)}50%{box-shadow:0 0 40px var(--hclr)}}`;
            document.head.appendChild(s);
        }
        const o = document.createElement('div'); o.id = 'aegis-highlight';
        o.style.cssText = `position:fixed;left:${rect.left-6}px;top:${Math.max(rect.top-6,10)}px;width:${rect.width+12}px;height:${Math.min(rect.height+12,680)}px;border:3px solid ${clr};border-radius:8px;--hclr:${clr}66;box-shadow:0 0 25px ${clr}66;z-index:99999;pointer-events:none;animation:highlightPulse 1.5s ease-in-out infinite;`;
        const l = document.createElement('div'); l.id = 'aegis-highlight-label';
        l.style.cssText = `position:fixed;left:${rect.left-6}px;top:${Math.max(rect.top-34,4)}px;background:${clr}22;backdrop-filter:blur(8px);border:1px solid ${clr}88;color:${clr};font-family:'Inter',monospace;font-size:13px;font-weight:700;padding:4px 12px;border-radius:4px;z-index:99999;pointer-events:none;letter-spacing:0.5px;`;
        l.textContent = lbl;
        document.body.appendChild(o); document.body.appendChild(l);
    }, { sel: selector, lbl: label, clr: color });
    await page.waitForTimeout(duration);
    await page.evaluate(() => { document.getElementById('aegis-highlight')?.remove(); document.getElementById('aegis-highlight-label')?.remove(); });
}

async function main() {
    console.log('[Seg5] Starting closing recording v2...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    
    // Load local mock
    console.log('[Seg5] Loading Mantle explorer mock...');
    await page.goto(MOCK_HTML, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    
    // Highlight TX hash
    console.log('[Seg5] Highlighting TX hash...');
    await injectHighlight(page, '.detail-row:nth-child(1) .detail-value', '▶ LIVE MANTLE TRANSACTION HASH', 3000, '#58a6ff');
    
    // Highlight Status: Success
    console.log('[Seg5] Highlighting status...');
    await injectHighlight(page, '.badge-success', '✅ CONFIRMED ON-CHAIN', 2500, '#3fb950');
    
    // Highlight From (TEE enclave)
    console.log('[Seg5] Highlighting enclave address...');
    await injectHighlight(page, '.detail-row:nth-child(5) .detail-value', '▶ TEE ENCLAVE WALLET', 2500, '#00ffaa');
    
    // Highlight Self-memo pattern
    console.log('[Seg5] Highlighting self-memo...');
    await injectHighlight(page, '.detail-row:nth-child(6) .detail-value', '▶ SELF-SEND COMPLIANCE MEMO', 2500, '#00ffaa');
    
    // Scroll down and highlight input data
    console.log('[Seg5] Highlighting input data...');
    await injectHighlight(page, '.input-data', '▶ AEGIS-12 COMPLIANCE RECEIPT (CALLDATA)', 4000, '#7ee787');
    
    // Transition to end card
    console.log('[Seg5] Showing end card...');
    await page.evaluate(() => {
        // Fade out
        document.body.style.transition = 'opacity 0.8s';
        document.body.style.opacity = '0';
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0;padding:0;background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;opacity:0;transition:opacity 1s;';
        
        const container = document.createElement('div');
        container.style.cssText = 'text-align:center;';
        
        const title = document.createElement('h1');
        title.textContent = 'AEGIS-12';
        title.style.cssText = 'font-family:Inter,system-ui,sans-serif;font-size:72px;font-weight:800;background:linear-gradient(135deg,#00ffaa,#00aaff,#aa00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 12px 0;letter-spacing:4px;';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Hardware-Attested Compliance Gateway';
        subtitle.style.cssText = 'font-family:Inter,system-ui,sans-serif;font-size:22px;color:#8899aa;margin:0 0 30px 0;letter-spacing:2px;';
        
        const tagline = document.createElement('p');
        tagline.textContent = 'Every decision. Attested. Sealed. On-chain.';
        tagline.style.cssText = 'font-family:Inter,system-ui,sans-serif;font-size:16px;color:#556677;margin:0 0 40px 0;font-style:italic;';
        
        const badge = document.createElement('div');
        badge.style.cssText = 'display:inline-block;padding:8px 24px;border:1px solid #00ffaa44;border-radius:20px;background:#00ffaa11;';
        badge.innerHTML = '<span style="font-family:Inter,monospace;font-size:14px;color:#00ffaa;letter-spacing:1px;">Built by Berlin AI Labs</span>';
        
        container.appendChild(title);
        container.appendChild(subtitle);
        container.appendChild(tagline);
        container.appendChild(badge);
        document.body.appendChild(container);
        
        // Fade in
        requestAnimationFrame(() => { document.body.style.opacity = '1'; });
    });
    await page.waitForTimeout(5000);
    
    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();
    console.log(`[Seg5] ✅ Video saved: ${videoPath}`);
}

main().catch(err => { console.error('[Seg5] Fatal:', err); process.exit(1); });
