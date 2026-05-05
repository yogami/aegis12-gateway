# SPQE Policy Evaluator — FastAPI Application
#
# Semantic evaluation service for AI agent transaction intents.
# Runs a two-stage pipeline:
# 1. Rule-based policy engine (fast, deterministic)
# 2. SLM semantic evaluation (deep, nuanced)
#
# If the rule engine denies, the SLM is not consulted (fast-path denial).
# If the rule engine approves, the SLM provides a second opinion.
#
# Endpoints:
#   POST /evaluate  — evaluate a transaction intent
#   GET  /health    — health check

import os
import time
import logging
import httpx

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import hashlib

from domain.policy_engine import PolicyEngine, PolicyConfig
from domain.slm_evaluator import SLMEvaluator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === Pydantic Models ===

class TransactionIntent(BaseModel):
    """Input: AI agent's transaction intent."""
    action: str = Field(..., description="Action type (transfer, swap, stake)")
    target: str = Field(..., description="Target Solana address (base58)")
    amount: int = Field(..., description="Amount in lamports")
    agent_id: str = Field(..., description="Unique AI agent identifier")
    memo: Optional[str] = Field(None, description="Optional memo")
    nonce: str = Field(..., description="Cryptographic nonce to prevent replay attacks")
    timestamp_ms: int = Field(..., description="UNIX timestamp in milliseconds for expiration")


class EvaluationResponse(BaseModel):
    """Output: Policy evaluation verdict."""
    approved: bool = Field(..., description="Whether the intent is approved")
    reasoning: str = Field(..., description="Human-readable reasoning")
    risk_score: float = Field(..., description="Risk score 0.0 to 1.0")
    evaluation_ms: int = Field(..., description="Evaluation latency in ms")
    evaluator: str = Field(..., description="Which evaluator produced the verdict")

class AgentMetadata(BaseModel):
    id: str
    tenantId: str
    currentTier: str

class ActionMetadata(BaseModel):
    toolId: str
    parameters: Dict[str, Any]

class ContextMetadata(BaseModel):
    timestamp: str
    currentAnomalyScore: float

class SignAndExecuteRequest(BaseModel):
    agent: AgentMetadata
    action: ActionMetadata
    context: ContextMetadata

async def get_pyth_price(asset: str = "SOL") -> float:
    # Pyth SOL/USD feed ID
    sol_feed_id = "ef0d8b6fda2ceba41da15d4095d1da392a0d3f8ed0c9c7ddce4812328fb8ff78"
    # Pyth USDC/USD feed ID
    usdc_feed_id = "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
    
    feed_id = usdc_feed_id if asset == "USDC" else sol_feed_id
    url = f"https://hermes.pyth.network/v2/updates/price/latest?ids[]={feed_id}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=2.0)
            data = resp.json()
            price_data = data["parsed"][0]["price"]
            price_str = price_data["price"]
            expo = price_data["expo"]
            return float(price_str) * (10 ** expo)
    except Exception as e:
        logger.error(f"Pyth fetch failed: {e}")
        return 1.0 if asset == "USDC" else 150.0  # Fallback dummy prices


# === Application Setup ===

app = FastAPI(
    title="SPQE Policy Evaluator",
    description="Semantic evaluation service for AI agent transaction intents using a small language model",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Initialize engines
policy_engine = PolicyEngine(PolicyConfig())
slm_evaluator = SLMEvaluator(
    model_name=os.getenv("MODEL_NAME", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
)

# Serverless evaluator requires no local loading phase
@app.on_event("startup")
async def startup_event():
    logger.info("Starting SPQE Policy Evaluator with Serverless vLLM")


@app.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_intent(intent: TransactionIntent):
    """
    Evaluate a transaction intent against security policies.
    
    Two-stage pipeline:
    1. Rule-based policy engine (fast, deterministic)
    2. SLM semantic evaluation (deep, nuanced) — only if rules pass
    """
    start = time.time()

    # Stage 1: Rule-based evaluation (always runs)
    rule_verdict = policy_engine.evaluate(
        action=intent.action,
        target=intent.target,
        amount=intent.amount,
        agent_id=intent.agent_id,
    )

    # Slippage / Toxic Liquidity Oracle Check
    # Check if interacting with USDC or Stablecoin pools
    # In a fully unmocked system, this is derived natively from parsing the SPL mint.
    is_usdc = ("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" in intent.target or 
               "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" in intent.target and "USDC" in str(intent.memo))
    
    if is_usdc:
        # USDC has 6 decimals
        asset_price = await get_pyth_price(asset="USDC")
        token_amount = intent.amount / 1_000_000
    else:
        # SOL has 9 decimals
        asset_price = await get_pyth_price(asset="SOL")
        token_amount = intent.amount / 1_000_000_000

    usd_value = token_amount * asset_price
    
    # Policy: Prevent moving more than $50,000 USD at market price in a single autonomous tx
    # (Protects against flash crashes / sandwich attacks / massive prompt injection drain)
    if usd_value > 50000.0:
        elapsed_ms = int((time.time() - start) * 1000)
        return EvaluationResponse(
            approved=False,
            reasoning=f"Pyth Oracle Block: Transaction usd_value (${usd_value:.2f}) exceeds autonomous maximum of $50,000. Slippage risk high.",
            risk_score=1.0,
            evaluation_ms=elapsed_ms,
            evaluator="pyth_oracle_firewall",
        )

    # If rules deny, fast-path: don't consult the SLM
    if not rule_verdict.approved:
        elapsed_ms = int((time.time() - start) * 1000)
        return EvaluationResponse(
            approved=False,
            reasoning=rule_verdict.reasoning,
            risk_score=rule_verdict.risk_score,
            evaluation_ms=elapsed_ms,
            evaluator="rule_engine",
        )

    # Stage 2: SLM semantic evaluation (Serverless async call)
    slm_verdict = await slm_evaluator.evaluate(
        action=intent.action,
        target=intent.target,
        amount=intent.amount,
        agent_id=intent.agent_id,
        memo=intent.memo,
    )

    elapsed_ms = int((time.time() - start) * 1000)

    # Combine: use SLM verdict but keep rule engine's risk score as floor
    risk_score = max(rule_verdict.risk_score, 0.1 if not slm_verdict.approved else 0.0)

    return EvaluationResponse(
        approved=slm_verdict.approved,
        reasoning=slm_verdict.reasoning,
        risk_score=round(risk_score, 3),
        evaluation_ms=elapsed_ms,
        evaluator="slm" if slm_verdict.raw_output != "rule-based-fallback" else "slm_fallback",
    )


@app.post("/sign_and_execute")
async def sign_and_execute(req: SignAndExecuteRequest):
    """
    Zero-Custody TEE Remote Signer Endpoint.
    Ingests an unsigned intent, evaluates it, and if approved,
    simulates enclave key derivation to sign and execute the transaction.
    """
    start = time.time()
    
    # Extract intent for the engine
    action_type = req.action.toolId
    target = req.action.parameters.get("to", "unknown")
    amount = req.action.parameters.get("amount", 0)
    agent_id = req.agent.id
    
    # Stage 1: Rule-based evaluation ($O(1)$ pDFA Mock)
    rule_verdict = policy_engine.evaluate(
        action=action_type,
        target=target,
        amount=amount,
        agent_id=agent_id,
    )

    if not rule_verdict.approved:
        return JSONResponse(status_code=403, content={
            "status": "denied",
            "error": "Policy Violation",
            "reasoning": rule_verdict.reasoning,
            "risk_score": rule_verdict.risk_score
        })

    # (Skipping SLM evaluation in this mock endpoint for speed, as rules govern the strict constraints)
    
    # Simulate Jito ShredStream Submission & Key Derivation
    mock_tx_hash = "5Jito" + hashlib.sha256(str(time.time()).encode()).hexdigest()[:80]
    
    # Generate Auditor-Readable Evidence Package
    evidence_package = {
        "timestamp": req.context.timestamp,
        "policy_id": f"{req.agent.tenantId}-policy",
        "agent_id": agent_id,
        "risk_tier": req.agent.currentTier,
        "action": action_type,
        "amount": amount,
        "target": target,
        "zk_seal": "0x" + hashlib.sha256(b"zk_proof_mock").hexdigest(),
        "compliance_control": "MiCA-ART-14"
    }

    elapsed_ms = int((time.time() - start) * 1000)

    return {
        "status": "approved",
        "tx_hash": mock_tx_hash,
        "evidence_package": evidence_package,
        "hardware_quote": f"MOCK_TDX_QUOTE_{hashlib.sha256(b'phala_cvm_image_hash').hexdigest()}",
        "evaluation_ms": elapsed_ms
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "spqe-policy-evaluator",
        "version": "0.1.0",
        "model": slm_evaluator.model_name,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
