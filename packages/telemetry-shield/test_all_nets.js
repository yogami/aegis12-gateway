const { LitNodeClientNodeJs } = require("@lit-protocol/lit-node-client-nodejs");

const networks = ["datil-dev", "datil-test", "datil", "habanero"];

async function testNetworks() {
  for (const net of networks) {
    console.log(`\n--- Testing ${net} ---`);
    try {
      const client = new LitNodeClientNodeJs({
        litNetwork: net,
        debug: true
      });
      // We wrap it in a timeout so we don't hang forever
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 5000));
      await Promise.race([client.connect(), timeout]);
      console.log(`[PASS] ${net} successfully connected.`);
    } catch (e) {
      console.log(`[FAIL] ${net}: ${e.message}`);
    }
  }
}

testNetworks();
