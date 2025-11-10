'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { EscrowDapp, IDL } from '@/lib/escrow_dapp';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const programId = new PublicKey('5afza8swMPYeP3cf3sDhszmqS2WpBs8ewrPbMPai9Cbb');

interface EscrowAccount {
  publicKey: PublicKey;
  account: {
    initializer: PublicKey;
    taker: PublicKey;
    initializerAmount: any; // BN
    takerAmount: any; // BN
    mintA: PublicKey;
    mintB: PublicKey;
  };
}

export function EscrowList() {
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { connection } = useConnection();
  const wallet = useWallet();

  const getProgram = () => {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    const provider = new AnchorProvider(connection, wallet as any, {});
    return new Program<EscrowDapp>(IDL, programId, provider);
  };

  const fetchEscrows = async () => {
    if (!wallet.publicKey) return;
    const program = getProgram();
    setIsLoading(true);
    try {
      const accounts = await program.account.escrowState.all();
      setEscrows(accounts as EscrowAccount[]);
    } catch (error) {
      console.error('Error fetching escrows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchEscrows();
    }
  }, [wallet.publicKey, connection]);

  const handleCancel = async (escrow: EscrowAccount) => {
    if (!wallet.publicKey) return;
    setIsLoading(true);
    try {
      const program = getProgram();
      const [vaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from('vault'), escrow.account.initializer.toBuffer()],
        program.programId
      );
      const initializerAtaA = await getAssociatedTokenAddress(escrow.account.mintA, escrow.account.initializer);

      const tx = await program.methods
        .cancel()
        .accounts({
          initializer: escrow.account.initializer,
          escrowState: escrow.publicKey,
          vault: vaultPda,
          initializerAtaA: initializerAtaA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      alert(`Escrow canceled! Tx: ${tx}`);
      fetchEscrows();
    } catch (error) {
      console.error('Error canceling escrow:', error);
      alert(`Error canceling escrow: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExchange = async (escrow: EscrowAccount) => {
    if (!wallet.publicKey) return;
    setIsLoading(true);
    try {
      const program = getProgram();
      const [vaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from('vault'), escrow.account.initializer.toBuffer()],
        program.programId
      );

      const takerAtaA = await getAssociatedTokenAddress(escrow.account.mintA, wallet.publicKey);
      const takerAtaB = await getAssociatedTokenAddress(escrow.account.mintB, wallet.publicKey);
      const initializerAtaB = await getAssociatedTokenAddress(escrow.account.mintB, escrow.account.initializer);

      const tx = await program.methods
        .exchange()
        .accounts({
          taker: wallet.publicKey,
          initializer: escrow.account.initializer,
          mintA: escrow.account.mintA,
          mintB: escrow.account.mintB,
          takerAtaA: takerAtaA,
          takerAtaB: takerAtaB,
          initializerAtaB: initializerAtaB,
          escrowState: escrow.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      alert(`Exchange successful! Tx: ${tx}`);
      fetchEscrows();
    } catch (error) {
      console.error('Error exchanging escrow:', error);
      alert(`Error exchanging escrow: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-md mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Open Escrows</h2>
        <Button onClick={fetchEscrows} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
      <div className="grid gap-4">
        {isLoading && escrows.length === 0 ? (
          <p>Loading escrows...</p>
        ) : escrows.length === 0 ? (
          <p>No open escrows found.</p>
        ) : (
          escrows.map(({ publicKey, account }) => (
            <div key={publicKey.toString()} className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">Escrow Address: {publicKey.toBase58()}</p>
              <div className="mt-2">
                <p><strong>Initializer:</strong> {account.initializer.toBase58()}</p>
                <p><strong>Taker:</strong> {account.taker.toBase58()}</p>
                <p><strong>Offering:</strong> {account.initializerAmount.toString()} of token {account.mintA.toBase58()}</p>
                <p><strong>Requesting:</strong> {account.takerAmount.toString()} of token {account.mintB.toBase58()}</p>
              </div>
              <div className="mt-4 flex gap-2">
                {wallet.publicKey?.equals(account.initializer) && (
                  <Button variant="destructive" onClick={() => handleCancel({ publicKey, account })} disabled={isLoading}>
                    {isLoading ? 'Canceling...' : 'Cancel'}
                  </Button>
                )}
                {wallet.publicKey?.equals(account.taker) && (
                  <Button variant="default" onClick={() => handleExchange({ publicKey, account })} disabled={isLoading}>
                    {isLoading ? 'Exchanging...' : 'Exchange'}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
