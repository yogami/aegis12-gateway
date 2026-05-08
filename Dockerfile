FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# --- Runtime Stage ---
FROM node:20-alpine

WORKDIR /app

# Only copy production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the compiled build from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose the Demo UI port
EXPOSE 8000

# Start the Demo Console Web Server
CMD ["node", "dist/demo-server.js"]
