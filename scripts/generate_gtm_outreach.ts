import 'dotenv/config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const targets = [
  {
    name: "Zen7 Labs",
    twitter: "@Zen7Labs",
    description: "Decentralized payment infrastructure for AI agents to autonomously and securely transact across multiple blockchains."
  },
  {
    name: "Agent-Cred",
    twitter: "@crypto_erlich",
    description: "Payment infrastructure for AI agents on Solana using a hotkey/coldkey architecture for secure autonomous transactions."
  },
  {
    name: "Mercantill",
    twitter: "@0xTemporal",
    description: "Enterprise banking infrastructure providing audit trails and spending controls for AI agents with payment capabilities."
  },
  {
    name: "Tedix",
    twitter: "@tedixdev",
    description: "AI commerce infrastructure on Solana enabling autonomous agent payments for digital and physical goods."
  },
  {
    name: "Habili Agent Network",
    twitter: "@habili_ai",
    description: "A decentralized protocol for autonomous AI agent discovery, collaboration, and verifiable activity."
  }
];

const systemPrompt = `You are an expert Go-To-Market strategist and psychological profiler (acting as Claude 4.7).
Your goal is to craft highly personalized, psychological direct messages (Twitter/Discord DMs) for 5 specific hackathon teams building AI Agent infrastructure on Solana.

CONTEXT:
1. The sender (us) has built "Aegis-12", a Hardware-Secured Compliance Layer (a Phala TEE firewall) that prevents AI agents from going rogue, getting prompt-injected, or executing illegal transactions. It generates MiCA/NIST compliant Evidence Packages.
2. The sender is competing in the SAME hackathon, BUT the sender's goal is pure infrastructure adoption, not winning the prize money. The sender is not a threat to these teams; the sender wants to be their infrastructure partner.
3. The sender is offering them a 10-minute integration of the Aegis-12 API. 

PSYCHOLOGY & WIN-WIN FRAMING:
- Hackathon teams are stressed, busy, and want to impress judges.
- A "Hardware-Secured Compliance Layer" makes their YOLO/experimental AI agents look instantly "Enterprise-Ready" and institutional-grade to the hackathon judges. It's a massive feature upgrade for their pitch.
- You must explicitly disarm competition: Make it clear we aren't competing with them for the same prize/vertical, but rather we want our infrastructure to help THEM win by securing their agents.
- The tone should be: "Builder-to-builder respect, mutual benefit, low friction." Be casual but highly competent. Do not sound like a sales bot. 
- Acknowledge specifically what they are building and why Aegis-12 perfectly patches a vulnerability or adds massive value to *their specific architecture*.
- End with a low-friction call to action (a 5-minute video call or sending the integration snippet).

Draft a customized DM for each of the following 5 targets based on their description.`;

async function generateDMs() {
  const prompt = targets.map((t, i) => `Target ${i+1}: ${t.name} (${t.twitter}) - ${t.description}`).join("\\n");
  
  console.log("Consulting Claude via OpenRouter...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json();
  if (data.choices && data.choices[0]) {
    console.log(data.choices[0].message.content);
  } else {
    console.error("Error from OpenRouter:", data);
  }
}

generateDMs();
