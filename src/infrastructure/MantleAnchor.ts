import { ethers, Wallet } from 'ethers';
import { AegisComplianceReceipt } from '../types';
import { ILedgerAnchor, AnchorResult, VerificationResult } from '../ports/ILedgerAnchor';
import { AegisSigner } from './AegisSigner';
import { JsonUtils } from './JsonUtils';

export class MantleAnchor implements ILedgerAnchor {
    private provider: ethers.Provider;
    private wallet: Wallet;
    private networkName: string;

    constructor(rpcUrl: string, wallet: Wallet, networkName: string = 'Mantle (EVM)') {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = wallet.connect(this.provider);
        this.networkName = networkName;
    }

    public async anchorReceipt(
        receipt: AegisComplianceReceipt, 
        decision: 'approved' | 'denied',
        enclaveDid: string
    ): Promise<AnchorResult> {
        const receiptHash = JsonUtils.computeReceiptHash(receipt);
        
        const memoObj = {
            v: 'aegis:v8',
            act: receipt.actionId,
            h: receiptHash, 
            d: decision,
            did: enclaveDid,
            ts: receipt.timestamp
        };
        const memo = `a12:${Buffer.from(JSON.stringify(memoObj)).toString('base64url')}`;

        // On EVM, we write data to the blockchain by sending a transaction to ourselves with hex calldata.
        const hexData = ethers.hexlify(ethers.toUtf8Bytes(memo));
        
        const tx = await this.wallet.sendTransaction({
            to: this.wallet.address,
            data: hexData
        });

        const receiptTx = await tx.wait();

        return {
            txSignature: tx.hash,
            explorerUrl: `https://explorer.mantle.xyz/tx/${tx.hash}`,
        };
    }

    public async verifyAnchoredReceipt(
        txHash: string,
        receipt: AegisComplianceReceipt,
        signer: AegisSigner
    ): Promise<VerificationResult> {
        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) throw new Error('Transaction not found on Mantle');

            const hexData = tx.data;
            if (hexData === '0x') throw new Error('No calldata found in transaction');

            const onChainMemo = ethers.toUtf8String(hexData);
            if (!onChainMemo.startsWith('a12:')) throw new Error('Invalid memo prefix');
            
            const memoObj = JsonUtils.safeParse(Buffer.from(onChainMemo.substring(4), 'base64url').toString('utf-8'), 'MantleMemo');
            const recomputedHash = JsonUtils.computeReceiptHash(receipt);
            const hashMatch = this.compareMemo(memoObj, receipt, recomputedHash);

            const signatureValid = signer.verify(recomputedHash, receipt.signature, signer.getPublicKeyHex());
            if (!signatureValid) throw new Error('Enclave signature invalid.');

            const block = await this.provider.getBlock(tx.blockNumber!);

            return { 
                verified: hashMatch && signatureValid, 
                onChainMemo, 
                timestamp: block?.timestamp
            };
        } catch (e: any) {
            return { verified: false, error: e.message };
        }
    }

    private compareMemo(memoObj: any, receipt: AegisComplianceReceipt, recomputedHash: string): boolean {
        const expectedDecision = (receipt as any).decision || 'approved';
        const expectedDid = receipt.enclaveDid || "unknown";
        return (memoObj.h === recomputedHash) && 
               (memoObj.act === receipt.actionId) && 
               (memoObj.d === expectedDecision) &&
               (memoObj.did === expectedDid);
    }

    public getPayerPublicKey(): string {
        return this.wallet.address;
    }

    public getNetworkName(): string {
        return this.networkName;
    }
}
