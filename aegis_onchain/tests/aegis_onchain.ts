import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { AegisOnchain } from "../target/types/aegis_onchain";

describe("aegis_onchain", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AegisOnchain as Program<AegisOnchain>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  it("fails if attestation envelope is expired", async () => {
    try {
      const envelope = {
        vaultPda: anchor.web3.Keypair.generate().publicKey,
        squadsMultisig: anchor.web3.Keypair.generate().publicKey,
        instructionDigest: Array(32).fill(0),
        validUntilSlot: new anchor.BN(0), // Expiration slot is 0, which is always < current slot
      };

      const signature = Array(64).fill(0);
      const enclavePubkey = Array(32).fill(0);

      await program.methods
        .verifyAttestation(envelope, signature, enclavePubkey)
        .accounts({
          authority: provider.wallet.publicKey,
        })
        .rpc();

      expect.fail("Should have thrown AttestationExpired error");
    } catch (err: any) {
      expect(err.message).to.include("Attestation envelope expired.");
    }
  });

  it("succeeds if attestation envelope is valid", async () => {
    const envelope = {
      vaultPda: anchor.web3.Keypair.generate().publicKey,
      squadsMultisig: anchor.web3.Keypair.generate().publicKey,
      instructionDigest: Array(32).fill(0),
      validUntilSlot: new anchor.BN(100000000), // Huge future slot
    };

    const signature = Array(64).fill(0);
    const enclavePubkey = Array(32).fill(0);

    const tx = await program.methods
      .verifyAttestation(envelope, signature, enclavePubkey)
      .accounts({
        authority: provider.wallet.publicKey,
      })
      .rpc();

    expect(tx).to.be.a("string");
  });
});
