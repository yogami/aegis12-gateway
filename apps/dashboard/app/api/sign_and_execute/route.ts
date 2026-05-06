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
        if (typeof (wallet as any).signTypedData === 'function') {
            signature = await (wallet as any).signTypedData(domain, types, policyConfig);
        } else {
            signature = await (wallet as any)._signTypedData(domain, types, policyConfig);
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

        const targetUrl = process.env.PHALA_ENFORCE_URL || 'https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/sign_and_execute';

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
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
