#!/bin/bash
API_KEY="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"

call_model() {
  local model=$1
  local prompt=$2
  curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$model\",
      \"messages\": [{\"role\": \"user\", \"content\": $(echo "$prompt" | jq -Rs .)}]
    }" | jq -r '.choices[0].message.content'
}

CONTEXT=$(cat Aegis_Clinical_Audit_Consolidated.md src/infrastructure/AegisPEP.ts src/infrastructure/AegisLocalStateStore.ts AEGIS_SUBMISSION_PACK.md Enterprise_Pilot_Specification.md)

echo "--- BLEEDING EDGE DEBATE START ---"

echo "### Critic (Kimi K2.6) ###"
CRITIC_PROMPT="You are an adversarial Chinese security auditor (Kimi K2.6). Brutally tear apart the current tiered crypto implementation in Aegis-12. Analyze the race conditions in the async signing and the 'Security Theater' of the PQ upgrade. Use the provided audit findings and code context. Context: $CONTEXT"
call_model "moonshotai/kimi-k2.6" "$CRITIC_PROMPT" > critic_resp_edge.txt
cat critic_resp_edge.txt

echo -e "\n### Proposer (GPT-5.4) ###"
PROPOSER_PROMPT="You are the lead architect (GPT-5.4). Defend your tiered crypto strategy against Kimi's attack. Focus on L1 constraints and the 'Architectural Prophet' frame. Context: $CONTEXT. Critic's Attack: $(cat critic_resp_edge.txt)"
call_model "openai/gpt-5.4" "$PROPOSER_PROMPT" > proposer_resp_edge.txt
cat proposer_resp_edge.txt

echo -e "\n### Resolver (Qwen 3.6 Plus) ###"
RESOLVER_PROMPT="You are a clinical judge (Qwen 3.6 Plus). Synthesize the debate between GPT-5.4 and Kimi K2.6. Deliver a final, unbiased verdict on the Aegis-12 PQ upgrade. Is it a 'Deterministic Floor' or a 'Complexity Trap'? Provide 3 mandatory remediation steps. Context: $CONTEXT. Debate: Critic: $(cat critic_resp_edge.txt). Proposer: $(cat proposer_resp_edge.txt)"
call_model "qwen/qwen3.6-plus" "$RESOLVER_PROMPT" > resolver_resp_edge.txt
cat resolver_resp_edge.txt

echo "--- BLEEDING EDGE DEBATE END ---"
