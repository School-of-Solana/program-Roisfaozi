import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { EscrowDapp } from "../target/types/escrow_dapp";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("escrow_dapp", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EscrowDapp as Program<EscrowDapp>;

  let mintA: PublicKey = null;
  let mintB: PublicKey = null;
  let initializerTokenAccountA: PublicKey = null;
  let initializerTokenAccountB: PublicKey = null;
  let takerTokenAccountA: PublicKey = null;
  let takerTokenAccountB: PublicKey = null;

  const takerAmount = new BN(1000);
  const initializerAmount = new BN(500);

  const initializer = Keypair.generate();
  const taker = Keypair.generate();

  const escrowState = Keypair.generate();
  let vault: PublicKey = null;


  it("Initializes the test state", async () => {
    // Airdrop SOL to our accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(initializer.publicKey, LAMPORTS_PER_SOL * 2),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(taker.publicKey, LAMPORTS_PER_SOL * 2),
      "confirmed"
    );

    // Create mints
    mintA = await createMint(provider.connection, initializer, initializer.publicKey, null, 6);
    mintB = await createMint(provider.connection, taker, taker.publicKey, null, 6);

    // Create token accounts
    initializerTokenAccountA = await createAccount(provider.connection, initializer, mintA, initializer.publicKey);
    takerTokenAccountA = await createAccount(provider.connection, taker, mintA, taker.publicKey);

    initializerTokenAccountB = await createAccount(provider.connection, initializer, mintB, initializer.publicKey);
    takerTokenAccountB = await createAccount(provider.connection, taker, mintB, taker.publicKey);

    // Mint tokens
    await mintTo(provider.connection, initializer, mintA, initializerTokenAccountA, initializer, initializerAmount.toNumber());
    await mintTo(provider.connection, taker, mintB, takerTokenAccountB, taker, takerAmount.toNumber());

    const _initializerTokenAccountA = await getAccount(provider.connection, initializerTokenAccountA);
    const _takerTokenAccountB = await getAccount(provider.connection, takerTokenAccountB);

    assert.ok(_initializerTokenAccountA.amount === BigInt(initializerAmount.toNumber()));
    assert.ok(_takerTokenAccountB.amount === BigInt(takerAmount.toNumber()));
  });


  it("Should initialize the escrow", async () => {
    const [vaultPda, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), initializer.publicKey.toBuffer()],
        program.programId
    );
    vault = vaultPda;

    const [statePda, stateBump] = await PublicKey.findProgramAddress(
        [Buffer.from("state"), initializer.publicKey.toBuffer()],
        program.programId
    );

    await program.methods
        .initialize(initializerAmount, takerAmount)
        .accounts({
            initializer: initializer.publicKey,
            taker: taker.publicKey,
            mintA: mintA,
            mintB: mintB,
            initializerAtaA: initializerTokenAccountA,
            escrowState: statePda,
            vault: vault,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([initializer])
        .rpc();

    const escrowStateAccount = await program.account.escrowState.fetch(statePda);
    assert.ok(escrowStateAccount.initializer.equals(initializer.publicKey));
    assert.ok(escrowStateAccount.taker.equals(taker.publicKey));
    assert.ok(escrowStateAccount.initializerAmount.eq(initializerAmount));
    assert.ok(escrowStateAccount.takerAmount.eq(takerAmount));
    assert.ok(escrowStateAccount.mintA.equals(mintA));
    assert.ok(escrowStateAccount.mintB.equals(mintB));

    const vaultAccount = await getAccount(provider.connection, vault);
    assert.ok(vaultAccount.amount === BigInt(initializerAmount.toNumber()));
  });

  it("Should allow the initializer to cancel the escrow", async () => {
    const [statePda, stateBump] = await PublicKey.findProgramAddress(
        [Buffer.from("state"), initializer.publicKey.toBuffer()],
        program.programId
    );

    const initialBalance = (await getAccount(provider.connection, initializerTokenAccountA)).amount;

    await program.methods
        .cancel()
        .accounts({
            initializer: initializer.publicKey,
            escrowState: statePda,
            vault: vault,
            initializerAtaA: initializerTokenAccountA,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([initializer])
        .rpc();

    // Check if the tokens were returned
    const finalBalance = (await getAccount(provider.connection, initializerTokenAccountA)).amount;
    assert.ok(finalBalance === initialBalance + BigInt(initializerAmount.toNumber()));

    // Check if the escrow state account is closed
    try {
        await program.account.escrowState.fetch(statePda);
        assert.fail("Escrow state account should have been closed");
    } catch (e) {
        assert.include(e.message, "Account does not exist");
    }

    // Check if the vault account is closed
    const vaultInfo = await provider.connection.getAccountInfo(vault);
    assert.isNull(vaultInfo, "Vault account should be null");
  });

  it("Should allow the taker to exchange tokens", async () => {
    // Create a new set of keypairs and accounts for this test
    const testInitializer = Keypair.generate();
    const testTaker = Keypair.generate();

    // Airdrop SOL
    await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(testInitializer.publicKey, LAMPORTS_PER_SOL * 2)
    );
    await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(testTaker.publicKey, LAMPORTS_PER_SOL * 2)
    );

    // Create new token accounts
    const testInitializerAtaA = await createAccount(provider.connection, testInitializer, mintA, testInitializer.publicKey);
    const testTakerAtaA = await createAccount(provider.connection, testTaker, mintA, testTaker.publicKey);
    const testInitializerAtaB = await createAccount(provider.connection, testInitializer, mintB, testInitializer.publicKey);
    const testTakerAtaB = await createAccount(provider.connection, testTaker, mintB, testTaker.publicKey);

    // Mint tokens
    await mintTo(provider.connection, initializer, mintA, testInitializerAtaA, initializer, initializerAmount.toNumber());
    await mintTo(provider.connection, taker, mintB, testTakerAtaB, taker, takerAmount.toNumber());

    // Initialize a new escrow
    const [statePda, stateBump] = await PublicKey.findProgramAddress(
        [Buffer.from("state"), testInitializer.publicKey.toBuffer()],
        program.programId
    );
    const [vaultPda, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), testInitializer.publicKey.toBuffer()],
        program.programId
    );

    await program.methods
        .initialize(initializerAmount, takerAmount)
        .accounts({
            initializer: testInitializer.publicKey,
            taker: testTaker.publicKey,
            mintA: mintA,
            mintB: mintB,
            initializerAtaA: testInitializerAtaA,
            escrowState: statePda,
            vault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([testInitializer])
        .rpc();

    // Get initial balances
    const initialTakerBalanceA = (await getAccount(provider.connection, testTakerAtaA)).amount;
    const initialInitializerBalanceB = (await getAccount(provider.connection, testInitializerAtaB)).amount;

    // Call the exchange instruction
    await program.methods
        .exchange()
        .accounts({
            taker: testTaker.publicKey,
            initializer: testInitializer.publicKey,
            mintA: mintA,
            mintB: mintB,
            takerAtaA: testTakerAtaA,
            takerAtaB: testTakerAtaB,
            initializerAtaB: testInitializerAtaB,
            escrowState: statePda,
            vault: vaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([testTaker])
        .rpc();

    // Check final balances
    const finalTakerBalanceA = (await getAccount(provider.connection, testTakerAtaA)).amount;
    const finalInitializerBalanceB = (await getAccount(provider.connection, testInitializerAtaB)).amount;

    assert.ok(finalTakerBalanceA === initialTakerBalanceA + BigInt(initializerAmount.toNumber()));
    assert.ok(finalInitializerBalanceB === initialInitializerBalanceB + BigInt(takerAmount.toNumber()));

    // Check if accounts were closed
    const stateInfo = await provider.connection.getAccountInfo(statePda);
    assert.isNull(stateInfo, "Escrow state account should be null");
    const vaultInfoExchange = await provider.connection.getAccountInfo(vaultPda);
    assert.isNull(vaultInfoExchange, "Vault account should be null");
  });

  it("Should not allow non-initializer to cancel", async () => {
    // Create a new set of keypairs for this test
    const testInitializer = Keypair.generate();
    const testTaker = Keypair.generate();
    const randomUser = Keypair.generate();

    // Airdrop SOL
    await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(testInitializer.publicKey, LAMPORTS_PER_SOL * 2)
    );
    await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(randomUser.publicKey, LAMPORTS_PER_SOL * 2)
    );

    // Create a token account for the initializer
    const testInitializerAtaA = await createAccount(provider.connection, testInitializer, mintA, testInitializer.publicKey);
    await mintTo(provider.connection, initializer, mintA, testInitializerAtaA, initializer, initializerAmount.toNumber());

    // Initialize a new escrow
    const [statePda] = await PublicKey.findProgramAddress(
        [Buffer.from("state"), testInitializer.publicKey.toBuffer()],
        program.programId
    );
    const [vaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), testInitializer.publicKey.toBuffer()],
        program.programId
    );

    await program.methods
        .initialize(initializerAmount, takerAmount)
        .accounts({
            initializer: testInitializer.publicKey,
            taker: testTaker.publicKey,
            mintA: mintA,
            mintB: mintB,
            initializerAtaA: testInitializerAtaA,
            escrowState: statePda,
            vault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([testInitializer])
        .rpc();

    // Try to cancel as a random user
    try {
        await program.methods
            .cancel()
            .accounts({
                initializer: randomUser.publicKey, // Using the wrong account
                escrowState: statePda,
                vault: vaultPda,
                initializerAtaA: testInitializerAtaA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([randomUser])
            .rpc();
        assert.fail("Transaction should have failed");
    } catch (e) {
        // Error Code 2006: A seeds constraint was violated
        assert.strictEqual(e.error.errorCode.code, "ConstraintSeeds");
        assert.strictEqual(e.error.errorCode.number, 2006);
    }
  });
});
