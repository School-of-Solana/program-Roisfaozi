'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { EscrowDapp, IDL } from '@/lib/escrow_dapp';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// The program ID is from the declare_id! macro in the Anchor program
const programId = new PublicKey('5afza8swMPYeP3cf3sDhszmqS2WpBs8ewrPbMPai9Cbb');

export function CreateEscrow() {
  const [mintA, setMintA] = useState('');
  const [amountA, setAmountA] = useState('');
  const [mintB, setMintB] = useState('');
  const [amountB, setAmountB] = useState('');
  const [taker, setTaker] = useState('');
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

  const handleCreateEscrow = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet!');
      return;
    }
    setIsLoading(true);
    try {
      const program = getProgram();
      const initializer = wallet.publicKey;
      const takerPubkey = new PublicKey(taker);

      const mintAPubkey = new PublicKey(mintA);
      const mintBPubkey = new PublicKey(mintB);

      const initializerAtaA = await getAssociatedTokenAddress(mintAPubkey, initializer);

      const [statePda] = await PublicKey.findProgramAddress(
        [Buffer.from('state'), initializer.toBuffer()],
        program.programId
      );
      const [vaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from('vault'), initializer.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .initialize(new BN(amountA), new BN(amountB))
        .accounts({
          initializer: initializer,
          taker: takerPubkey,
          mintA: mintAPubkey,
          mintB: mintBPubkey,
          initializerAtaA: initializerAtaA,
          escrowState: statePda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      alert(`Escrow created successfully! Transaction signature: ${tx}`);
    } catch (error) {
      console.error('Error creating escrow:', error);
      alert(`Error creating escrow: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-2xl font-bold mb-4">Create Escrow</h2>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="mintA">Token to Send (Mint Address)</Label>
          <Input id="mintA" placeholder="Enter Mint Address of Token A" value={mintA} onChange={(e) => setMintA(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amountA">Amount to Send</Label>
          <Input id="amountA" type="number" placeholder="e.g., 500" value={amountA} onChange={(e) => setAmountA(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mintB">Token to Receive (Mint Address)</Label>
          <Input id="mintB" placeholder="Enter Mint Address of Token B" value={mintB} onChange={(e) => setMintB(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amountB">Amount to Receive</Label>
          <Input id="amountB" type="number" placeholder="e.g., 1000" value={amountB} onChange={(e) => setAmountB(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="taker">Taker Address</Label>
          <Input id="taker" placeholder="Enter Taker's Public Key" value={taker} onChange={(e) => setTaker(e.target.value)} />
        </div>
        <Button onClick={handleCreateEscrow} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Escrow'}
        </Button>
      </div>
    </div>
  );
}
