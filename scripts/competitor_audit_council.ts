import * as fs from 'fs';
import * as path from 'path';

// Read API Key natively
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const envMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
const OPENROUTER_API_KEY = envMatch ? envMatch[1].trim() : null;

if (!OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY in environment variables.");
    process.exit(1);
}

// Extract Bucket A (Competitors)
const triagePath = '/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/frontier_triage.md';
const content = fs.readFileSync(triagePath, 'utf-8');
const bucketAStart = content.indexOf('## 🚨 BUCKET A: Potential Competitors');
const bucketBStart = content.indexOf('## 🎯 BUCKET B: Prime Targets');
const bucketAContent = content.substring(bucketAStart, bucketBStart);

const MODELS = [
    { id: "x-ai/grok-4.3", name: "Grok 4.3" },
    { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1" }
];

async function queryModel(modelId: string, systemPrompt: string, userPrompt: string) {
    const body = JSON.stringify({
        model: modelId,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
    });

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://aegis12.dev",
                "X-Title": "Aegis-12 Competitor Audit",
                "Content-Type": "application/json"
            },
            body: body
        });

        if (!response.ok) {
            console.error(`[${modelId}] API Error: ${response.status} ${response.statusText}`);
            return `[FAILED: ${response.status}]`;
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error(`[${modelId}] Fetch error:`, error);
        return `[FAILED: Network Error]`;
    }
}

async function runAudit() {
    console.log(`\n================================`);
    console.log(`🚀 Initiating Brutal Competitor Audit...`);
    
    const systemPrompt = `You are the Lead Architect and Head of Product Strategy at Berlin AI Studio. You are famously brutal, sycophancy-free, and focus entirely on engineering moats and defensibility.
We are building Aegis-12: an x402 Active Policy Engine running inside a hardware-isolated Phala TEE on Solana. We intercept agent payments and block bad transactions before they hit the chain.

Right now, we are a high-friction "nice-to-have". We lose on Developer Experience to RPC firewalls (which are easy to integrate) and Smart Contract firewalls. 

Read the following list of 20 direct competitors from the Colosseum Hackathon.
Your Goal: Identify exactly 1 or 2 killer technical features or architectural pivots we must make IMMEDIATELY to turn Aegis-12 into an absolute "must-have" that annihilates these competitors. 
Think about things they CANNOT copy because they don't have our TEE hardware moat. 
Do not suggest generic marketing. Suggest hard engineering features.`;

    // MAP PHASE: Query all 3 models in parallel
    console.log(`[Map] Dispatching Bucket A to Grok, Claude, and DeepSeek...`);
    const results = await Promise.all(MODELS.map(m => 
        queryModel(m.id, systemPrompt, `Here are the 20 competitors:\n${bucketAContent}`)
    ));

    const grokOutput = results[0];
    const claudeOutput = results[1];
    const deepseekOutput = results[2];

    // REDUCE PHASE: Consolidate
    console.log(`[Reduce] Synthesizing the Ultimate Feature Roadmap with GPT-4o...`);
    const consolidatorPrompt = `You are the ultimate arbiter of Product Strategy. Read the three brutal audits from Grok, Claude, and DeepSeek regarding our 20 competitors.
Synthesize their insights into a single, devastatingly clear "Execution Roadmap". 
Identify the top 2 "Killer Features" we must build to achieve absolute dominance. 
Format as a clean, highly technical markdown document. No fluff.`;

    const userPayload = `
    === GROK 4.3 OUTPUT ===
    ${grokOutput}
    
    === CLAUDE OPUS 4.7 OUTPUT ===
    ${claudeOutput}
    
    === DEEPSEEK R1 OUTPUT ===
    ${deepseekOutput}
    `;

    const finalRoadmap = await queryModel("openai/gpt-4o", consolidatorPrompt, userPayload);

    let outputMd = `# Aegis-12: Brutal Competitor Audit & Feature Roadmap\n\n`;
    outputMd += `*Synthesized from Grok 4.3, Claude Opus 4.7, and DeepSeek R1.*\n\n---\n\n`;
    outputMd += `## 👑 THE KILLER FEATURES (Synthesized)\n\n${finalRoadmap}\n\n`;
    outputMd += `<details>\n<summary>View Raw Audits (Grok, Claude, DeepSeek)</summary>\n\n`;
    outputMd += `#### Grok 4.3\n${grokOutput}\n\n`;
    outputMd += `#### Claude Opus 4.7\n${claudeOutput}\n\n`;
    outputMd += `#### DeepSeek R1\n${deepseekOutput}\n\n`;
    outputMd += `</details>\n`;

    const outputPath = '/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/competitor_audit_results.md';
    fs.writeFileSync(outputPath, outputMd);
    console.log(`\n✅ Audit complete. Saved to: ${outputPath}`);
}

runAudit();
