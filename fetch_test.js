const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false,
  family: 4 // IPv4 only
});

const urls = [
  'https://51.255.59.58:443/web/handshake/',
  'https://23.81.180.7:443/web/handshake/',
  'https://158.69.163.138:443/web/handshake/'
];

async function testFetch() {
  for (const url of urls) {
    try {
      console.log(`Connecting to ${url}...`);
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ clientPublicKey: 'test', challenge: 'test', epoch: 22527 }),
        headers: { 'Content-Type': 'application/json' },
        dispatcher: new (require('undici').Agent)({
          connect: {
            rejectUnauthorized: false
          }
        })
      });
      console.log(`[SUCCESS] ${url} HTTP ${response.status}`);
      console.log(await response.text());
    } catch (e) {
      console.error(`[FAIL] ${url}:`, e);
    }
  }
}

testFetch();
