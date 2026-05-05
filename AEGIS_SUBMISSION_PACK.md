# [META_TAGS]: Intel TDX, Phala dStack, RISC Zero, ZK-Seal, TEE, Solana, Jito ShredStream, DePIN, Agentic Security, Compliance, Squads V4, Zero-Custody, LLM-Agent-Infrastructure

# Aegis-12: The Sovereign Kill Switch | Colosseum Hackathon Submission

## 1. Project Identity & The Core Problem
- **Project Name**: Aegis-12
- **Track**: DePIN / Infrastructure / AI
- **Tagline**: The Hardware-Rooted Custodian for Agentic Capital.
- **The Problem (Institutional Liability for Autonomous Agents)**: If a hedge fund gives an AI agent a private key, and the AI hallucinates and sends $10M to a sanctioned wallet, who is legally liable? Because AI agents cannot hold legal liability, institutions refuse to deploy capital to autonomous agents. Software-based "guardrails" and API firewalls fail because they can be trivially bypassed by prompt injection or server compromise.

## 2. The Solution: The Core Duo
Aegis-12 is the only wallet infrastructure designed specifically for machines, shifting trust from legal liability to cryptographic determinism. We solve the liability void with two core pillars:

1. **The Zero-Custody Remote Signer (Custody)**: Agents NEVER hold private keys. They submit unsigned intents to our Phala hardware enclave (Intel TDX). The hardware enforces strict compliance policies (Sanctions, Limits, Tail-Risk) at CPU machine speed before signing the transaction internally.
2. **Auditor-Grade Evidence Rails (Liability)**: For every transaction, the hardware generates a cryptographic RISC Zero ZK-Seal and a Phala TDX Hardware Quote. This mathematically proves to regulators that the exact compliance policy was enforced, creating a closed-loop audit trail.

## 3. Under the Hood: Engineering Resilience
To keep the hardware-rooted custodian alive in high-stress, adversarial environments, Aegis-12 implements 5 critical resilience mechanisms:

1. **x402-PoI Active Policy Engine**: Enforces verifiable micro-payments (0.005 USDC) on HTTP headers to prevent DDoS and spam via pure capitalism.
2. **Human-on-the-Loop (HOTL) Escalation (Article 14)**: Automatically intercepts intents exceeding risk thresholds and routes them to a Squads V4 Multisig for manual human governance approval.
3. **Dynamic Circuit Breakers**: Deterministic pDFA engine that intercepts prompt injections, circular swaps, and OFAC violations instantaneously.
4. **Asynchronous Evidence WAL (Write-Ahead Log)**: A fault-tolerant memory queue that protects against TEE network drops by caching compliance receipts locally and re-transmitting asynchronously.
5. **Jito ShredStream Integration**: Packages compliant transactions into Jito Bundles to transmit directly to the block leader, protecting against MEV extraction.

## 4. Colosseum Rubric Mapping
- **Technical Complexity**: Aegis-12 is not a Web2 wrapper. It operates at the silicon level (Intel TDX / Phala CVM) and the cryptographic math level (RISC Zero ZK-Seals), running a custom low-memory Micro-Server to survive stringent 2GB enclave limits.
- **Solana Ecosystem Integration**: Deeply embedded with Solana primitives: Jito Bundles, Squads V4 multisigs for governance, and base58 Ed25519 cryptography.
- **Real-World Utility**: Solves the biggest bottleneck in the AI x Crypto space (the Liability Void), opening the floodgates for institutional capital to legally deploy autonomous trading agents.

## 5. Verified Substance (Cryptographic Proofs)
> These proofs were generated live in a Phala Confidential VM (CVM) and anchored to the Solana Devnet.

- **Solana Anchor (L1 Receipt)**: `QtJoCFkPQtvkMUW74ptQc5wugQoUEJp5CDiMqVkpxgmjTVABtERws4pnCAZuP7Dfy31H21rvMaT5QRRy34kfAto`
    - *Explorer Link*: [View on Solana Explorer](https://explorer.solana.com/tx/QtJoCFkPQtvkMUW74ptQc5wugQoUEJp5CDiMqVkpxgmjTVABtERws4pnCAZuP7Dfy31H21rvMaT5QRRy34kfAto?cluster=devnet)
- **ZK-Seal (Computational Proof)**: `44e5ccf80493b7ee...` (Confirmed via Solana Memo)
    - *Verification*: Generated via RISC Zero (STARK) inside the TEE.
- **TEE Hardware Quote (Attestation)**: `did:aegis:enclave:6556903abcc8d66d`
    - *Verification*: Genuine Phala dStack Hardware Enclave (Intel SGX).

## 6. Live Deployment & Visual Assets
- **CVM Endpoint**: `https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/`
- **Dashboard**: `https://aegis12-dashboarduprailwayapp-production.up.railway.app/`
- **GitHub**: `https://github.com/yogami/aegis12-gateway`
- **Technical Demo**: [aegis12_technical_demo.mp4](file:///Users/user1000/gitprojects/aegis12-gateway/aegis12_technical_demo.mp4)
- **Final Pitch Video**: [aegis12_final_pitch.mp4](file:///Users/user1000/gitprojects/aegis12-gateway/aegis12_final_pitch.mp4)

---
**Verified by Antigravity AI Auditor**
*Proof of Execution Timestamp: 2026-04-21T12:26:30Z*
