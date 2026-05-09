from generate_audio import generate_tts

text = "The Solana x402 protocol is transforming the Agentic Economy, giving autonomous machines the ability to spend. But no sane institution will fund an agent's wallet if a single hallucination or compromised prompt can drain the treasury. Targeting developers with optional security plugins is a dead end—they optimize for speed, not compliance. Aegis-12 solves this by targeting the capital allocators. We are the Fiduciary Guardrails for the Agentic Economy. We give DAOs, treasuries, and funds the cryptographic guarantee to safely deploy capital. By mandating our firewall at the Squads V4 vault boundary, we ensure that even if an agent's private keys are stolen and broadcast directly to a public RPC, the transaction is mathematically rejected. We don't suggest security; we enforce it."

generate_tts(text, "seg1_new_audio.mp3")
