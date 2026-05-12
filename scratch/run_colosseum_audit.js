const fs = require('fs');
const path = require('path');

const API_KEY = "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";
const MODELS_USER = [
    "openai/gpt-4o", 
    "anthropic/claude-3-opus",
    "deepseek/deepseek-chat"
];

const prompt = `You are a World-Class Security Researcher, Solana Senior Software Architect, and Colosseum Hackathon Judge.
Audit the following strategic pivot for the Aegis-12 TEE Gateway codebase.

Context: 
We recently struggled with Solana 3.x and Anchor 1.0 macro compilation conflicts for our on-chain verifier feature. 
To resolve this, we downgraded anchor-lang to 0.30.1 and pinned solana-program to 1.18.17.
We then successfully implemented the \`verify_intent\` instruction in lib.rs. This instruction uses \`load_instruction_at_checked\` to cryptographically enforce that a TEE-generated Ed25519 signature is present in the transaction flow, creating a hardware-enforced security moat.
Our core offering is a "Confidential Policy Vault + Per-Decision Phala TDX Remote Attestation (with RiscZero zk-proof anchoring)". The on-chain verification gate is the newest addition.

We need you to answer the following questions brutally and without sycophancy:
1. Will downgrading versions (Anchor 0.30.1 / Solana 1.18.17) cost us points in the Colosseum hackathon, considering the emphasis on using the latest tech?
2. Can this exact on-chain Ed25519 sysvar verification be done with bleeding-edge versions (Solana 3.0 / Anchor 1.0), and if so, how?
3. Is this on-chain verification gate a Blue Ocean solution? Or is it a Red Ocean solution? If it is Red Ocean, what can we do differently to win the hackathon?
4. If this on-chain verification is combined with our core offering of hardware attestation (Phala TDX + RiscZero), does that guarantee us to qualify from a "nice to have" middleware firewall to a "must have" enterprise security standard?

Provide a ruthless, evidence-backed audit report.`;

async function runAudit(modelId) {
    console.log(`[AUDIT] Running audit with model: ${modelId}...`);
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (response.ok) {
            const result = await response.json();
            return result.choices[0].message.content;
        } else {
            const errText = await response.text();
            return `Error ${response.status}: ${errText}`;
        }
    } catch (e) {
        return `Exception: ${e.message}`;
    }
}

async function main() {
    const results = {};
    for (const model of MODELS_USER) {
        results[model] = await runAudit(model);
    }
    
    const outputPath = path.join("/Users/user1000/gitprojects/aegis12-gateway", "scratch/colosseum_audit_report.json");
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 4));
    console.log(`\\n[DONE] Multi-model audit complete. Report saved to ${outputPath}`);
}

main();
