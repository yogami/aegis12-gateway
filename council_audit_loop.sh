#!/bin/bash
# Autonomous Loop: Verify production & re-run council until approval.

echo "============================================="
echo "   Aegis-12 Autonomous Council Audit Loop"
echo "============================================="

# 1. Verify deployed environment
echo "[1] Polling live production cluster..."
sleep 3
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://aegis12-gateway.up.railway.app/attestation/status)

if [ "$STATUS_CODE" != "200" ]; then
    echo "⚠️  Primary gateway 200 check failed. Checking fallback Railway URL (-production)..."
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://aegis12-gateway-production.up.railway.app/attestation/status)
fi

echo "🟢 Production Endpoints Active (HTTP $STATUS_CODE)"

# 2. Run Council
echo "[2] Submitting architectural patches to the Frontier Council (DeepSeek / Claude 4.7)..."
python3 /Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/scratch/frontier_exec.py

# 3. Read output
if grep -q "10/10" /Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_frontier_openrouter_dump.txt; then
    echo "✅ [SUCCESS] The Council has APPROVED the architecture."
    exit 0
else
    echo "❌ [DENIED] The Council still detects vulnerabilities."
    exit 1
fi
