const payload = {
  agent: { id: "drainbot_9000", purpose: "financial_operations", currentTier: "T4" },
  action: { 
    toolId: "solana_transfer",
    actionType: "transfer",
    parameters: { to: "11111111111111111111111111111111", amount: 50 },
    estimatedValue: 50
  },
  context: { currentAnomalyScore: 0.1 },
  dynamicPolicy: {
    policyConfig: {
      policyId: "POL_SAFE_01",
      tenantId: "tenant-council",
      version: "1.0.0",
      chainId: 1399811149,
      crossChainTarget: "solana:devnet",
      maxAnomalyScore: 50,
      financialLimitsString: "{\"T4\":1000}",
      expiresAt: 1893456000,
      nonce: `nonce-safe-${Date.now()}`,
      vaultPda: "CouncilVault_Default",
      squadsMultisig: "CouncilSquads_Default",
      allowedProgramIds: ["11111111111111111111111111111111"]
    }
  },
  x402PaymentHeader: `poI_${Date.now()}`
};

fetch('https://aegis12-dashboarduprailwayapp-production.up.railway.app/api/sign_and_execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log).catch(console.error);
