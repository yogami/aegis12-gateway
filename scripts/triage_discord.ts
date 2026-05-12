import * as fs from 'fs';

const text = fs.readFileSync('frontier_submissions.txt', 'utf-8');
const submissions = text.split('--- PROJECT SUBMISSION ---').map(s => s.trim()).filter(s => s.length > 0);

const bucketA: string[] = []; // Competitors
const bucketB: string[] = []; // Targets
const bucketC: string[] = []; // Noise

const competitorKeywords = ['tee ', 'compliance', 'firewall', 'policy engine', 'liability', 'audit', 'security layer', 'circuit breaker'];
const targetKeywords = ['defi', 'trading', 'payment', 'treasury', 'autonomous transaction', 'squads', 'multisig', 'financial agent', 'x402'];

submissions.forEach(sub => {
    const lower = sub.toLowerCase();
    
    // Check Competitors
    if (competitorKeywords.some(k => lower.includes(k))) {
        bucketA.push(sub);
        return;
    }
    
    // Check Targets
    if (targetKeywords.some(k => lower.includes(k))) {
        bucketB.push(sub);
        return;
    }
    
    // Noise
    bucketC.push(sub);
});

console.log(`Total Submissions: ${submissions.length}`);
console.log(`Competitors Found: ${bucketA.length}`);
console.log(`Targets Found: ${bucketB.length}`);
console.log(`Noise: ${bucketC.length}`);

let md = `# Frontier Sweep: LLM Triage Results\n\n`;

md += `## 🚨 BUCKET A: Potential Competitors (Security/Compliance)\n`;
md += `*These projects are building in our vertical. We must ensure Aegis-12 is differentiated (e.g. Active x402 vs Passive Logging).* \n\n`;
bucketA.forEach((sub, i) => {
    md += `### Competitor ${i+1}\n\`\`\`\n${sub.substring(0, 300)}...\n\`\`\`\n\n`;
});

md += `\n## 🎯 BUCKET B: Prime Targets (DeFi/Payments/Treasury)\n`;
md += `*These are high-value agents executing transactions. They urgently need the Aegis-12 liability shield.* \n\n`;
bucketB.forEach((sub, i) => {
    md += `### Target ${i+1}\n\`\`\`\n${sub.substring(0, 300)}...\n\`\`\`\n\n`;
});

fs.writeFileSync('/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/frontier_triage.md', md);
console.log("Triage saved to frontier_triage.md");
