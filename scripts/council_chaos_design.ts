import * as fs from 'fs';
import * as path from 'path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("❌ ERROR: OPENROUTER_API_KEY is not set in the environment.");
    process.exit(1);
}

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const CONTEXT = `
You are evaluating the Aegis-12 Cryptographic Gateway, a high-veracity compliance engine running inside a Trusted Execution Environment.
Architecture Context:
1. Hardware: Phala dStack CVM (TEE) with a massive 128GB memory limit. Node.js V8 engine is explicitly authorized to use up to 120GB of heap space via '--max-old-space-size=120000'.
2. Flow: HTTP /enforce -> Payload Validation -> TEE Quote -> ZK-Seal (Async) -> Solana Batch Anchor (Async) -> Return 200.
3. Vulnerabilities/Constraints:
   - Memory is NO LONGER the bottleneck. Do not write Out-of-Memory (OOM) vectors.
   - The bottleneck is now Unbounded State Contention: File Descriptor (ulimit) exhaustion, Redis locking contention at massive scale, CPU/PCIe bus thrashing from 50+ concurrent ZK-Provers, and TCP/Solana RPC rate limit collapses.
   - BatchAnchorWorker runs every 30s. Solana Devnet RPC rate-limits (HTTP 429) aggressively. Airdrops can fail.
   - CI/CD rolling deployments take 5-10 minutes (Rust compilation), leading to race conditions if the CI tests hit the proxy while the old container is draining.
`;

async function askOpenRouter(model: string, systemPrompt: string, userPrompt: string, retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://berlinailabs.com",
                    "X-Title": "Aegis-12 Chaos Council"
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 8000,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errText}`);
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0]) {
                throw new Error(`Invalid data: ${JSON.stringify(data)}`);
            }
            return data.choices[0].message.content;
        } catch (err: any) {
            console.warn(`[Attempt ${i+1}/${retries}] Failed to query ${model}: ${err.message}`);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 5000)); // wait 5s before retry
        }
    }
    return "";
}

async function runCouncil() {
    console.log("==================================================");
    console.log("🔥 ADVANCED REASONING CHAOS COUNCIL (128GB TIER) 🔥");
    console.log("==================================================\n");

    // Phase 1: Proposer
    console.log("Phase 1: Generating Initial Proposal (Proposer: openai/gpt-5.5)...");
    const proposerSystem = `You are the Proposer (The Architectural Mastermind). ${CONTEXT}
Your task is to design a comprehensive Chaos & Adversarial Test Suite for Aegis-12. Target deep infrastructure flaws at massive concurrency.`;
    const proposerPrompt = "Draft 3 highly sophisticated Chaos Test Vectors focusing on Unbounded Concurrency, File Descriptor exhaustion, and Redis/TCP collapse.";
    
    const proposal = await askOpenRouter("openai/gpt-5.5", proposerSystem, proposerPrompt);
    console.log("✅ Proposal received.\n");

    // Phase 2: Dual Critique
    console.log("Phase 2a: Structural Critique (Critic 1: anthropic/claude-opus-4.7)...");
    const critic1System = `You are Critic 1 (The Structural Assassin). ${CONTEXT}
Your mandate is to ruthlessly tear apart the Proposer's idea focusing on the Node.js event loop behavior under a 120GB memory allocation (where garbage collection pauses are massive). Hunt for edge cases in asynchronous state.`;
    const critic1Prompt = `Proposer's Draft:\n${proposal}\n\nDestroy this proposal structurally. Find the logical flaws regarding 120GB GC pauses and V8 event loop starvation.`;
    const critique1Promise = askOpenRouter("anthropic/claude-opus-4.7", critic1System, critic1Prompt);

    console.log("Phase 2b: Cryptographic Critique (Critic 2: deepseek/deepseek-v4-pro)...");
    const critic2System = `You are Critic 2 (The Cryptographic Assessor). ${CONTEXT}
Your mandate is to ruthlessly tear apart the Proposer's idea focusing on CPU/PCIe bus thrashing. What happens when 50 concurrent 1.8GB ZK-Provers thrash the CPU, stalling the parent Node.js cryptographic signatures?`;
    const critic2Prompt = `Proposer's Draft:\n${proposal}\n\nDestroy this proposal cryptographically. Find the naive assumptions regarding CPU starvation delaying TEE Quotes or Solana nonces.`;
    const critique2Promise = askOpenRouter("deepseek/deepseek-v4-pro", critic2System, critic2Prompt);

    const [critique1, critique2] = await Promise.all([critique1Promise, critique2Promise]);
    console.log("✅ Dual Critiques received.\n");

    // Phase 3: Synthesis
    console.log("Phase 3: Synthesis (Resolver: openai/o3-pro)...");
    const resolverSystem = `You are the Resolver (The Final Judge). ${CONTEXT}
Your mandate is to synthesize the Proposer's idea and both Critics' feedback into a hyper-realistic, code-ready "Aegis-12 128GB Chaos Test Suite". Provide ONLY the final Markdown document.`;
    const resolverPrompt = `Proposer's Draft:\n${proposal}\n\nCritic 1 (GC/V8):\n${critique1}\n\nCritic 2 (CPU/PCIe Thrashing):\n${critique2}\n\nSynthesize this into the final 128GB Chaos Test Suite.`;

    const finalSuite = await askOpenRouter("openai/o3-pro", resolverSystem, resolverPrompt);
    console.log("✅ Synthesis complete.\n");

    const outDir = path.join(__dirname, '../docs');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, 'COUNCIL_128GB_VECTORS.md');
    fs.writeFileSync(outFile, finalSuite);

    console.log(`🚀 Final Authentic Suite saved to ${outFile}`);
}

runCouncil().catch(err => {
    console.error("Council crashed:", err);
    process.exit(1);
});
