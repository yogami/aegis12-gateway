const { Connection, PublicKey } = require('@solana/web3.js');
async function check() {
  const connection = new Connection('https://devnet.helius-rpc.com/?api-key=e3f686d4-1710-4a8e-a2f4-4f147052af29', 'confirmed');
  const info = await connection.getAccountInfo(new PublicKey('DkrgGxr4YfCDtMFhN1tGUix4ZLjMGBMrWbHc74P2fXvL'));
  console.log("Account Info:", info ? "Exists" : "Not Found");
}
check();
