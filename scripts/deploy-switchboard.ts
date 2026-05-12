import * as dotenv from 'dotenv';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as sbv3 from '@switchboard-xyz/solana.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function main() {
    console.log('🚀 Starting Automated Switchboard V3 Deployment on Devnet...');

    if (!process.env.SOLANA_PAYER_SECRET) {
        console.error('❌ SOLANA_PAYER_SECRET is missing from .env');
        process.exit(1);
    }

    // Support both Base64 and JSON array formats for the secret key
    let secretKey: Buffer;
    try {
        secretKey = Buffer.from(JSON.parse(process.env.SOLANA_PAYER_SECRET));
    } catch {
        secretKey = Buffer.from(process.env.SOLANA_PAYER_SECRET, 'base64');
    }
    const payer = Keypair.fromSecretKey(secretKey);
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

    console.log(`🔑 Using Devnet Wallet: ${payer.publicKey.toBase58()}`);

    let balance = await connection.getBalance(payer.publicKey);
    console.log(`💰 Current Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    if (balance < 0.5 * LAMPORTS_PER_SOL) {
        console.log('⚠️ Balance is low. Attempting to airdrop 1 SOL...');
        try {
            const sig = await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, 'confirmed');
            balance = await connection.getBalance(payer.publicKey);
            console.log(`✅ Airdrop successful! New Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        } catch (e: any) {
            console.error('❌ Devnet Airdrop failed. Devnet faucet might be exhausted or rate-limited.');
            console.error(`Please manually fund this wallet: ${payer.publicKey.toBase58()}`);
            process.exit(1);
        }
    }

    try {
        console.log('🔌 Initializing Switchboard Program...');
        const program = await sbv3.SwitchboardProgram.load(connection, payer);

        console.log('🏗️ Creating Attestation Queue...');
        const [queueAccount] = await sbv3.AttestationQueueAccount.create(program, {
            reward: 0,
            allowAuthorityOverrideAfter: 0,
            maxQuoteVerificationAge: 86400,
            requireAuthorityHeartbeatPermission: false,
            requireUsagePermissions: false,
            nodeTimeout: 86400,
        });
        const queuePubkey = queueAccount.publicKey.toBase58();
        console.log(`✅ Attestation Queue Created: ${queuePubkey}`);

        console.log('🏗️ Creating Enclave Function Account...');
        const [functionAccount] = await sbv3.FunctionAccount.create(program, {
            name: 'Aegis12FiduciaryEnclave',
            metadata: 'Hardware Fiduciary Firewall',
            container: 'aegis12-gateway',
            containerRegistry: 'ghcr.io',
            version: 'latest',
            attestationQueue: queueAccount,
            mrEnclave: Buffer.alloc(32), // Generic placeholder for the Hackathon
        });
        const functionPubkey = functionAccount.publicKey.toBase58();
        console.log(`✅ Function Account Created: ${functionPubkey}`);

        // Update .env file
        const envPath = path.resolve(__dirname, '../.env');
        let envData = '';
        if (fs.existsSync(envPath)) {
            envData = fs.readFileSync(envPath, 'utf8');
        }

        // Remove old keys if they exist
        envData = envData.replace(/^SWITCHBOARD_QUEUE=.*$/m, '');
        envData = envData.replace(/^SWITCHBOARD_FUNCTION=.*$/m, '');
        envData = envData.replace(/^USE_LIVE_SWITCHBOARD=.*$/m, '');

        envData += `\nSWITCHBOARD_QUEUE=${queuePubkey}`;
        envData += `\nSWITCHBOARD_FUNCTION=${functionPubkey}`;
        envData += `\nUSE_LIVE_SWITCHBOARD=true`;

        // Clean up empty lines
        envData = envData.replace(/^\s*[\r\n]/gm, '');

        fs.writeFileSync(envPath, envData);
        console.log('📝 Successfully updated .env with the new Public Keys and enabled Live Mode!');
        
        console.log('\\n🎉 DEPLOYMENT COMPLETE! The Fiduciary Firewall is now fully backed by live Solana contracts.');
    } catch (e: any) {
        console.error(`❌ Deployment failed: ${e.message}`);
        console.error(e.stack);
        process.exit(1);
    }
}

main();
