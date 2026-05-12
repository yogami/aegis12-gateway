import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const envMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
const OPENROUTER_API_KEY = envMatch ? envMatch[1].trim() : null;
if (!OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY in environment variables.");
    process.exit(1);
}

const triagePath = '/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/frontier_triage.md';
const content = fs.readFileSync(triagePath, 'utf-8');

const bucketBStart = content.indexOf('## 🎯 BUCKET B: Prime Targets');
if (bucketBStart === -1) {
    console.error("Could not find Bucket B in triage file.");
    process.exit(1);
}

const bucketBContent = content.substring(bucketBStart);
const targets = bucketBContent.split('### Target ').slice(1); // Drop the header part

const top5Targets = targets; // Process all targets

async function generateDM(targetDescription: string, index: number) {
    console.log(`\nCalling Council for Target ${index + 1}...`);
    
    const systemPrompt = `You are an elite, seasoned technical sales executive for Aegis-12 (an x402 Active Policy Engine and TEE firewall on Solana/Phala). 
Read the following Colosseum hackathon project description. 
Your goal:
1) Identify exactly what they are building and why they are vulnerable to agent-liability or regulatory compliance issues.
2) Formulate a short, highly-humanized Discord DM (max 4 sentences) addressed to the builder.
3) It must be a 'win-win' (e.g., integrating our endpoint makes their architecture look hardware-secured and enterprise-ready to the judges).
4) It must include a subtle 'fear factor' (e.g. asking how they handle liability if an agent goes rogue or makes a sanctioned payment).
5) No emojis. No generic 'impressed with your work' slop. Speak builder-to-builder. Be direct.
6) Start your response with a 2-3 sentence internal reasoning on why you chose this specific angle, labeled "REASONING:", followed by the actual DM labeled "DM:".`;

    const body = JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Target Project Description:\n${targetDescription}` }
        ]
    });

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://aegis12.dev",
                "X-Title": "Aegis-12 Sales Council",
                "Content-Type": "application/json"
            },
            body: body
        });

        if (!response.ok) {
            console.error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

async function main() {
    let outputMd = `# Aegis-12 Sales Council: Automated DMs\n\n`;
    
    for (let i = 0; i < top5Targets.length; i++) {
        const target = top5Targets[i];
        
        // Extract just the description part
        const lines = target.split('\\n');
        // Actually, the format is:
        // 1
        // ```
        // description
        // ```
        
        // Simplify: just pass the whole target string
        const dm = await generateDM(target, i);
        
        outputMd += `## Target ${i + 1}\n`;
        outputMd += `**Original Pitch:**\n\`\`\`\n${target.substring(0, 200)}...\n\`\`\`\n\n`;
        outputMd += `**The Council DM:**\n> ${dm?.replace(/\n/g, '\n> ')}\n\n---\n\n`;
    }

    const outputPath = '/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/council_dms.md';
    fs.writeFileSync(outputPath, outputMd);
    console.log(`\n✅ Council deliberation complete. DMs saved to: ${outputPath}`);
}

main();
