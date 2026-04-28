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
1. Hardware: Phala dStack CVM (TEE) with a hard 2GB memory limit. Node.js is capped at 1.5GB.
2. Flow: HTTP /enforce -> Payload Validation -> TEE Quote -> ZK-Seal (Async) -> Solana Batch Anchor (Async) -> Return 200.
3. Vulnerabilities/Constraints:
   - RISC Zero ZK-Prover is highly CPU/Memory intensive. Spikes can cause OOM.
   - BatchAnchorWorker runs every 30s. Solana Devnet RPC rate-limits (HTTP 429) aggressively. Airdrops can fail.
   - JSON parsing uses strict deterministic stringification but must drop undefined values to prevent parsing crashes in web standard responses.
   - CI/CD rolling deployments take 5-10 minutes (Rust compilation), leading to race conditions if the CI tests hit the proxy while the old container is draining.
`;

async function askOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
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
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function runCouncil() {
    console.log("==========================================");
    console.log("🔥 AEGIS-12 CHAOS COUNCIL INITIATED 🔥");
    console.log("==========================================\n");

    // Phase 1: Proposer (GPT-4o)
    console.log("Phase 1: Generating Initial Proposal (Proposer: openai/gpt-4o)...");
    const proposerSystem = `You are the Proposer (The Architectural Mastermind). ${CONTEXT}
Your task is to design a comprehensive Chaos & Adversarial Test Suite for Aegis-12. Be bold, target deep infrastructure flaws, and write it professionally.`;
    const proposerPrompt = "Draft the initial Aegis-12 Chaos Test Suite focusing on Memory (OOM), Network (HTTP 429), and CI/CD race conditions.";
    
    const proposal = await askOpenRouter("openai/gpt-4o", proposerSystem, proposerPrompt);
    console.log("✅ Proposal received.\n");

    // Phase 2: Critic (Claude 3.5 Sonnet)
    console.log("Phase 2: Vicious Debate (Critic: anthropic/claude-3.5-sonnet)...");
    const criticSystem = `You are the Critic (The Brutal Assessor). ${CONTEXT}
Your mandate is to ruthlessly tear apart the Proposer's idea. Hunt for hallucinations, point out tests that are physically impossible or naive, identify over-hyped assumptions, and brutally counter any sycophantic praise. You must attack the weak points of the Proposer's arguments. Do not be polite.`;
    const criticPrompt = `Here is the Proposer's Chaos Test Suite:\n\n${proposal}\n\nDestroy this proposal. Find its logical flaws, point out what tests are naive, and identify what critical edge cases they completely missed regarding the TEE limitations or Solana devnet behaviors.`;

    const critique = await askOpenRouter("anthropic/claude-3.5-sonnet", criticSystem, criticPrompt);
    console.log("✅ Critique received.\n");

    // Phase 3: Resolver (o3-mini)
    console.log("Phase 3: Synthesis (Resolver: openai/o3-mini)...");
    const resolverSystem = `You are the Resolver (The Final Judge). ${CONTEXT}
Your mandate is to synthesize the Proposer's initial idea and the Critic's brutal feedback. Filter out any hallucinated or impossible tests. Deliver the final, hyper-realistic, code-ready "Aegis-12 Chaos & Adversarial Test Suite" blueprint. Format it as a professional Markdown document.`;
    const resolverPrompt = `Proposer's Draft:\n${proposal}\n\nCritic's Attack:\n${critique}\n\nSynthesize this into the final, unassailable Aegis-12 Chaos Test Suite. Provide ONLY the final Markdown document.`;

    const finalSuite = await askOpenRouter("openai/o3-mini", resolverSystem, resolverPrompt);
    console.log("✅ Synthesis complete.\n");

    const outDir = path.join(__dirname, '../docs');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, 'AEGIS_CHAOS_TEST_SUITE.md');
    fs.writeFileSync(outFile, finalSuite);

    console.log(`🚀 Final Suite saved to ${outFile}`);
}

runCouncil().catch(err => {
    console.error("Council crashed:", err);
    process.exit(1);
});
