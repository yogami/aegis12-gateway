## 🛑 ARCHITECTURAL ANCHOR
This project is part of the **Berlin AI Automation Studio**. 
It is governed by the global rules in **[berlin-ai-infra](https://github.com/yogami/berlin-ai-infra)**.

**Setup for new laptops:**
1. Clone this repo.
2. Run `./bootstrap-infra.sh` to link to the global Master Brain.

---

# Agent Trust Protocol

> Decentralized reputation and compliance protocol for autonomous AI agents.

## 🎯 What This Does

The Agent Trust Protocol tracks and verifies AI agent behavior across the Berlin AI ecosystem. It provides:
- **Reputation Scoring**: Quantified trust metrics based on historical compliance and uptime
- **Identity Verification**: DID-based agent identity for cross-service authentication
- **Regulatory Alignment**: EU AI Act compliance tracking for insurers and auditors

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/health` | Health check |
| GET | `/api/openapi.json` | OpenAPI 3.0 specification |
| GET | `/api/docs` | Swagger UI documentation |
| GET | `/api/agents` | List all registered agents with scores |
| GET | `/api/agents/:id` | Get agent reputation details |
| POST | `/api/agents/:id/report` | Submit compliance report |
| GET | `/api/dashboard` | Trust score dashboard data |

## 🏗️ Architecture

```
src/
├── domain/           # Agent entity, TrustScore value object
├── application/      # CalculateTrustScore, ReportCompliance use cases
├── infrastructure/   # Supabase adapter, external API clients
├── lib/
│   └── trust-protocol/  # Extracted microservice (reusable)
└── app/              # Next.js App Router pages and API routes
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the trust dashboard.

## 🧪 Testing

```bash
# Unit tests
npm run test

# With coverage (target: ≥80%)
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 🔗 Dependencies

| Service | Purpose | Production URL |
| :--- | :--- | :--- |
| Agent Trust Verifier | DID resolution & credential verification | `https://agent-trust-verifier-production.up.railway.app` |
| Supabase | PostgreSQL database | Shared instance (table prefix: `atp_`) |

## 📊 Status

- **Deployment**: Railway
- **Production URL**: `https://agent-trust-protocol-production.up.railway.app`
- **Catalog Entry**: [Microservices_Catalog.md](../Microservices_Catalog.md)
- **OpenAPI**: ✅ Agent-Ready

## ⚙️ Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase connection string | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | ✅ |

## 📜 License

MIT
