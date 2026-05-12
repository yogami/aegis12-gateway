FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Ensure the ZK prover binary path exists so the later COPY doesn't fail.
# If the real binary wasn't built (e.g. in CI), this creates a harmless empty file.
RUN mkdir -p /app/aegis-zk-prover/target/debug && touch /app/aegis-zk-prover/target/debug/host && chmod +x /app/aegis-zk-prover/target/debug/host

# --- Runtime Stage ---
FROM node:20-alpine

WORKDIR /app

# Only copy production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the compiled build from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy the pre-built RiscZero prover binary (if it exists in the repo)
# This is a statically-linked Rust binary, built locally via `cargo build`.
# If not present, the MultiOracleRouter will gracefully fall back to Phala/Mock.
COPY --from=builder /app/aegis-zk-prover/target/debug/host ./aegis-zk-prover/target/debug/host

# Expose the Demo UI port
EXPOSE 8000

# Start the Demo Console Web Server
CMD ["node", "dist/demo-server.js"]
