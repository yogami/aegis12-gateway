const fs = require('fs');

// 1. src/demo.ts
let demo = fs.readFileSync('src/demo.ts', 'utf8');
demo = demo.replace("import phalaEntrypoint from './phala-entry';", "import phalaEntrypoint from './application/PhalaEntrypoint';");
fs.writeFileSync('src/demo.ts', demo);

// 2. src/infrastructure/AegisPEP.ts
let pep = fs.readFileSync('src/infrastructure/AegisPEP.ts', 'utf8');
pep = pep.replace('estimatedValueBig = BigInt(sanit.amount || 0);', 'estimatedValueBig = BigInt(sanit.amount as any || 0);');
pep = pep.replace('try { spendAmountBig = BigInt(sanit.amount || 0); } catch(e) {}', 'try { spendAmountBig = BigInt(sanit.amount as any || 0); } catch(e) {}');
fs.writeFileSync('src/infrastructure/AegisPEP.ts', pep);

// 3. src/infrastructure/AegisRegistryClient.ts
let reg = fs.readFileSync('src/infrastructure/AegisRegistryClient.ts', 'utf8');
reg = reg.replace('this.program = new Program(idl, new PublicKey(programId), this.provider);', 'this.program = new Program(idl as any, this.provider);');
reg = reg.replace('const account: any = await this.program.account.nonceCheckpoint.fetch(checkpointPda);', 'const account: any = await (this.program.account as any).nonceCheckpoint.fetch(checkpointPda);');
fs.writeFileSync('src/infrastructure/AegisRegistryClient.ts', reg);

// 4. src/infrastructure/SolanaAnchor.ts
let anchor = fs.readFileSync('src/infrastructure/SolanaAnchor.ts', 'utf8');
anchor = anchor.replace(/ToolExecutionReceipt/g, 'AegisComplianceReceipt');
anchor = anchor.replace('anchoredAt: string;', 'anchoredAt: string;\n    isZkSharded?: boolean;\n    attestationState?: string;');
fs.writeFileSync('src/infrastructure/SolanaAnchor.ts', anchor);

// 5. src/infrastructure/SolanaTransactionFirewall.ts
let fw = fs.readFileSync('src/infrastructure/SolanaTransactionFirewall.ts', 'utf8');
fw = fw.replace(/ToolExecutionReceipt/g, 'AegisComplianceReceipt');
fw = fw.replace('gasUsed: number;', 'gasUsed: number;\n    executedPrograms: string[];');
fs.writeFileSync('src/infrastructure/SolanaTransactionFirewall.ts', fw);

// 6. src/infrastructure/SquadsGovernance.ts
let squads = fs.readFileSync('src/infrastructure/SquadsGovernance.ts', 'utf8');
squads = squads.replace(/ToolExecutionReceipt/g, 'AegisComplianceReceipt');
fs.writeFileSync('src/infrastructure/SquadsGovernance.ts', squads);

// 7. src/phala_cvm_server.ts
let cvm = fs.readFileSync('src/phala_cvm_server.ts', 'utf8');
cvm = cvm.replace('server.listen(PORT, "0.0.0.0", () => {', 'server.listen(Number(PORT), "0.0.0.0", () => {');
fs.writeFileSync('src/phala_cvm_server.ts', cvm);
