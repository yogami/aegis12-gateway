import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // This is the known provisioned key on the Phala Enclave (Hardhat Account 0)
        // In a real app, this would be the actual Agent's private key hosted in their sovereign backend.
        const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const wallet = new ethers.Wallet(privateKey);

        const domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
        const types = { Policy: [
            { name: 'policyId', type: 'string' }, { name: 'tenantId', type: 'string' },
            { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' },
            { name: 'crossChainTarget', type: 'string' }, { name: 'maxAnomalyScore', type: 'uint256' },
            { name: 'financialLimitsString', type: 'string' }, { name: 'expiresAt', type: 'uint256' },
            { name: 'nonce', type: 'string' }, { name: 'vaultPda', type: 'string' },
            { name: 'squadsMultisig', type: 'string' }, { name: 'allowedProgramIds', type: 'string[]' }
        ]};

        // Extract the frontend's policy config request and re-sign it mathematically
        const policyConfig = body.dynamicPolicy.policyConfig;
        
        // Ethers v5 requires _signTypedData for typed data
        // Ethers v6 requires signTypedData
        // Let's check which one works by trying v6 first, then falling back to v5
        let signature;
        type EthersSigner = { 
            signTypedData?: (d: unknown, t: unknown, v: unknown) => Promise<string>;
            _signTypedData?: (d: unknown, t: unknown, v: unknown) => Promise<string>;
        };
        const w = wallet as unknown as EthersSigner;
        if (typeof w.signTypedData === 'function') {
            signature = await w.signTypedData(domain, types, policyConfig);
        } else if (typeof w._signTypedData === 'function') {
            signature = await w._signTypedData(domain, types, policyConfig);
        } else {
            throw new Error("Ethers wallet does not support typed data signing");
        }

        // Reconstruct the payload with the dynamically generated valid signature
        const signedPayload = {
            ...body,
            dynamicPolicy: {
                policyConfig,
                ownerPublicKey: wallet.address,
                signature
            }
        };

        const targetUrl = process.env.PHALA_ENFORCE_URL || 'https://33d807c4df82bc98a1378c403181698f1f12bbed-8000.dstack-pha-prod9.phala.network/sign_and_execute';

        // Forward to actual Phala Backend
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signedPayload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
