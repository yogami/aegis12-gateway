#!/bin/bash
echo "Cleaning up old processes and state..."
pkill -9 -f server.ts || true
pkill -9 -f solana || true
rm -rf /tmp/aegis_test_*
sleep 1

echo "Starting solana-test-validator..."
rm -rf test-ledger
solana-test-validator --reset >/dev/null 2>&1 &
SOLANA_PID=$!
echo "Sleeping 5s to let validator boot..."
sleep 5

echo "Starting server..."
export AUTHORIZED_TENANTS='{"tenant-001": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"], "tenant-council": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"], "tenant-e2e": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"], "tenant-substance": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"]}'
PORT=8001 NODE_ENV=test ALLOW_E2E_MOCKING=false PHALA_SIMULATED_ROOT_SEED=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd SOLANA_CLUSTER=localnet SOLANA_RPC_URL=http://127.0.0.1:8899 npx tsx src/server.ts > server.log 2>&1 &
SERVER_PID=$!
echo "Sleeping 5s to let server boot..."
sleep 5

echo "Running E2E tests..."
TEST_API_URL=http://127.0.0.1:8001 SOLANA_CLUSTER=localnet SOLANA_RPC_URL=http://127.0.0.1:8899 npx playwright test "$@"
TEST_RESULT=$?

echo "Killing server and validator..."
kill -9 $SERVER_PID
kill -9 $SOLANA_PID

exit $TEST_RESULT
