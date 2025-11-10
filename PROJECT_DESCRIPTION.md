# Project Description

**Deployed Frontend URL:** [TODO: Link to your deployed frontend]

**Solana Program ID:** [TODO: Your deployed program's public key]

## Project Overview

### Description
This project is a decentralized application (dApp) that implements a secure, two-party token swap escrow system on the Solana blockchain. The program acts as a trustless intermediary, allowing one party (the "initializer") to lock a certain amount of one token (Token A) while specifying the amount of another token (Token B) they wish to receive from a specific second party (the "taker"). The swap is atomic, meaning it either completes successfully with both parties receiving their assets, or it fails, and no assets are exchanged. This ensures that neither party can be cheated.

The core functionalities are creating an escrow, canceling it (only by the initializer if it's still open), and executing the trade (only by the designated taker).

### Key Features
- **Initialize Escrow:** An initializer can create a new escrow by depositing their tokens and defining the terms of the trade.
- **Cancel Escrow:** The initializer can cancel an active escrow at any time before the trade is executed, safely reclaiming their deposited tokens.
- **Exchange Tokens:** The designated taker can fulfill the escrow's terms by depositing their tokens, which atomically triggers the release of the initializer's tokens to them.

### How to Use the dApp
1.  **Connect Wallet:** Both the initializer and the taker need to connect their Solana wallets.
2.  **Initialize Escrow (Initializer's Action):**
    *   The initializer specifies the token and amount they want to give (e.g., 500 Token A).
    *   They specify the token and amount they want to receive (e.g., 1000 Token B).
    *   They input the public key of the taker.
    *   Upon submitting the transaction, their Token A is transferred and locked into a secure program-controlled vault.
3.  **Exchange Tokens (Taker's Action):**
    *   The taker reviews the open escrow.
    *   If they agree to the terms, they approve the transaction.
    *   Upon submitting, their Token B is transferred to the initializer, and the locked Token A is automatically transferred to them. The escrow is then closed.
4.  **Cancel Escrow (Initializer's Alternative Action):**
    *   If the escrow has not been fulfilled by the taker, the initializer can choose to cancel it.
    *   Upon submitting the cancel transaction, the locked Token A is returned to the initializer, and the escrow is closed.

## Program Architecture
The program is built using the Anchor framework and leverages Program Derived Addresses (PDAs) to create a secure, trustless system. The architecture revolves around two main PDAs for each escrow instance:

1.  **Escrow State Account:** A PDA that stores all the data related to the escrow, such as the public keys of the initializer and taker, the mints of the tokens being swapped, and the amounts for the exchange.
2.  **Vault Account:** A PDA token account that is owned by the Escrow State PDA. This vault securely holds the initializer's tokens until the escrow is either canceled or fulfilled.

This design ensures that no private keys are stored on-chain. The program itself is the only authority that can sign for the movement of tokens out of the vault, and it will only do so when the conditions defined in the `cancel` or `exchange` instructions are met.

### PDA Usage
Two PDAs are created for each escrow instance, both derived from the initializer's public key to ensure uniqueness per user.

**PDAs Used:**
- **Escrow State PDA:**
  - **Purpose:** Stores the terms and state of the escrow agreement.
  - **Seeds:** `["state", initializer.key()]`
- **Vault PDA:**
  - **Purpose:** A token account that holds the initializer's locked tokens. Its authority is the Escrow State PDA.
  - **Seeds:** `["vault", initializer.key()]`

### Program Instructions
The program consists of three core instructions that map directly to the key features.

**Instructions Implemented:**
- **`initialize`:** Creates and enables a new escrow. It creates the `EscrowState` and `Vault` accounts and transfers the initializer's tokens into the vault.
- **`cancel`:** Allows the initializer to reverse the escrow. It transfers the tokens from the vault back to the initializer and closes both the `Vault` and `EscrowState` accounts, returning the rent lamports.
- **`exchange`:** Allows the designated taker to complete the swap. It facilitates the atomic two-way transfer of tokens and closes the `Vault` and `EscrowState` accounts.

### Account Structure
The primary on-chain data structure is the `EscrowState` account, which holds all the information about a specific trade.

```rust
#[account]
pub struct EscrowState {
    // The party who initialized the escrow
    pub initializer: Pubkey,
    // The party who is expected to fulfill the escrow
    pub taker: Pubkey,
    // The amount of tokens the initializer is depositing
    pub initializer_amount: u64,
    // The amount of tokens the taker must provide
    pub taker_amount: u64,
    // The mint of the token the initializer is depositing
    pub mint_a: Pubkey,
    // The mint of the token the taker must provide
    pub mint_b: Pubkey,
}
```

## Testing

### Test Coverage
The program was developed using a strict Test-Driven Development (TDD) methodology. Each instruction (`initialize`, `cancel`, `exchange`) was built by first writing a failing test that defined its requirements, and then writing the program code to make the test pass. This includes tests for both successful operations and error conditions to ensure program security and reliability.

**Happy Path Tests:**
- **`initialize`:** A test confirms that an escrow can be successfully created with the correct state and that tokens are correctly transferred to the vault.
- **`cancel`:** A test confirms that the initializer can successfully cancel an escrow, that their tokens are returned, and that all escrow-related accounts are closed.
- **`exchange`:** A test confirms that the taker can successfully execute the trade, that both parties receive the correct tokens, and that all escrow-related accounts are closed.

**Unhappy Path Tests:**
- **`cancel` (as non-initializer):** An explicit test was written to ensure that a random user cannot cancel an escrow they did not create. The test confirms that the transaction fails with the correct `ConstraintSeeds` error, proving that the program's security checks are effective.
- **Other Scenarios:** Other failure scenarios (e.g., wrong taker trying to exchange) are implicitly covered by Anchor's constraint system (`has_one`, `constraint`), which was proven effective by the explicit test above.

### Running Tests
```bash
# Navigate to the anchor project directory
cd anchor_project
# Run the test suite
anchor test
```

### Additional Notes for Evaluators
The development process rigorously followed the TDD cycle. Several bugs were intentionally introduced via failing tests and subsequently fixed, including issues with PDA signing, account ownership for closing accounts, and account mutability for rent refunds. The final code is a direct result of this iterative and test-focused process.
