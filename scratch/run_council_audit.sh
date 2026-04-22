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

CONTEXT=$(cat Aegis_Clinical_Audit_Consolidated.md src/infrastructure/AegisPEP.ts src/infrastructure/AegisLocalStateStore.ts)

echo "--- DEBATE START ---"

echo "### Critic (DeepSeek R1) ###"
CRITIC_PROMPT="You are an adversarial security auditor. Brutally tear apart the current tiered crypto implementation in Aegis-12. Use the provided audit findings and code context. Be vicious and hunt for structural failure modes. Context: $CONTEXT"
call_model "deepseek/deepseek-r1" "$CRITIC_PROMPT" > critic_resp.txt
cat critic_resp.txt

echo -e "\n### Proposer (GPT-4o) ###"
PROPOSER_PROMPT="You are the lead architect of Aegis-12. Defend your tiered crypto strategy against the Critic's attack. Focus on L1 constraints and regulatory pragmatism. Context: $CONTEXT. Critic's Attack: $(cat critic_resp.txt)"
call_model "openai/gpt-4o-2024-08-06" "$PROPOSER_PROMPT" > proposer_resp.txt
cat proposer_resp.txt

echo -e "\n### Resolver (Qwen 2.5 72B) ###"
RESOLVER_PROMPT="You are a clinical judge. Synthesize the debate and provide a final verdict: Revert to SHA-512 or Synchronize the PQ path? Provide 3 mandatory remediation steps. Context: $CONTEXT. Debate: Critic: $(cat critic_resp.txt). Proposer: $(cat proposer_resp.txt)"
call_model "qwen/qwen-2.5-72b-instruct" "$RESOLVER_PROMPT" > resolver_resp.txt
cat resolver_resp.txt

echo "--- DEBATE END ---"
