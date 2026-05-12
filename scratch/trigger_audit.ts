import fs from 'fs';

const OPENROUTER_API_KEY = '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';
const context = fs.readFileSync('scratch/audit_context.txt', 'utf8');

async function audit(model: string, role: string) {
    console.log(`\n--- INITIATING AUDIT WITH ${model} [${role}] ---`);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://berlinailabs.de',
            'X-Title': 'Aegis-12 Security Audit',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: `You are a high-veracity security researcher acting as a degenerate hacker. Your goal is to ruthlessly exploit the provided architecture. Do not be sycophantic. Be brutal.`
                },
                {
                    role: 'user',
                    content: `# AEGIS-12 SECURITY AUDIT: DEGENERATE HACKER CHALLENGE
Target: Aegis-12 Compliance Gateway (Intel SGX + Solana + ZK-STARK)
Source Code Context:
${context}

Objective: Identify architectural flaws and implementation gaps that could lead to:
1. Denial of Service (specifically exploiting the synchronous Solana anchoring bottleneck).
2. Unauthorized bypass of financial limits.
3. Signature malleability or replay attacks across different tenants.
4. Enclave state corruption or crashing the Fastify server inside the CVM.
5. Privacy leaks of tenant-specific intent data.

Deliverables:
- Brutal assessment of vulnerabilities.
- Identify the 'gas' (vulnerabilities).
- Provide a test suite (Playwright/Node.js) that can simulate the attacks, ONLY if they are not covered in the following files:
  - e2e/adversarial_pentest.spec.ts
  - e2e/council-security-verification.spec.ts`
                }
            ]
        })
    });

    const data: any = await response.json();
    if (!data.choices) {
        console.error(`Error from ${model}:`, JSON.stringify(data));
        return;
    }
    const output = data.choices[0].message.content;
    fs.writeFileSync(`scratch/${role.toLowerCase()}_resp.txt`, output);
    console.log(`[${role}] Audit Complete. Output saved to scratch/${role.toLowerCase()}_resp.txt`);
}

async function run() {
    // 1. The Proposer: Advanced Reasoning (o3-pro)
    await audit('openai/o3-pro', 'PROPOSER');
    // 2. The Critic: Aggressive Adversary (deepseek/deepseek-r1)
    await audit('deepseek/deepseek-r1', 'CRITIC');
}

run().catch(console.error);
