const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("No OpenRouter API key found in .env");
    process.exit(1);
}

const prompt = `You are a brutal, top-tier Solana Hackathon Judge for the "Frontier AI" track.

**The Problem:** Autonomous AI agents leak alpha. Every time an agent queries a Solana RPC node (like Helius or Jito) to evaluate a trade, the RPC provider can mathematically deduce the agent's intent *before* the trade is submitted. 

**Our Solution (Aegis-12):** We built an "Asynchronous Attestation + Atomic Execution" architecture. 
1. The AI agent generates an ephemeral Session Key inside a secure Intel SGX/TDX enclave.
2. We send a 4.5KB hardware quote to the Switchboard Oracle Network, which asynchronously verifies the hardware and whitelists the Session Key on-chain.
3. The AI agent executes trades locally, enforcing strict JSON policy budgets inside the enclave, and signs the transaction with the whitelisted key.
4. The Solana smart contract verifies the signature atomically, achieving 0-latency execution while guaranteeing hardware isolation.

**Your Task:**
Brutally audit this solution. 
1. Is the problem real?
2. Is the solution novel and unique?
3. Does this give us a massive edge to win the Colosseum hackathon, or is it trivial?
Do not hold back.`;

const models = [
    { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 4.7 (Sonnet)' },
    { id: 'openai/o3-mini-high', name: 'GPT 5.5 (o3-mini)' }
];

async function callOpenRouter(modelId, prompt) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return `API Error: ${error.message}`;
    }
}

async function run() {
    console.log("Starting OpenRouter Audit...");
    let resultsMd = `# Colosseum Hackathon - Brutal Audit Results\n\n`;
    
    for (const model of models) {
        console.log(`Querying ${model.name} (${model.id})...`);
        const result = await callOpenRouter(model.id, prompt);
        resultsMd += `## Verdict from ${model.name}\n\n`;
        resultsMd += `${result}\n\n---\n\n`;
    }

    const outPath = path.join(__dirname, '../hackathon_audit_results.md');
    fs.writeFileSync(outPath, resultsMd);
    console.log(`Audit saved to ${outPath}`);
}

run();
