use anchor_lang::prelude::*;

#[account]
pub struct EscrowState {
    pub initializer: Pubkey,
    pub taker: Pubkey,
    pub initializer_amount: u64,
    pub taker_amount: u64,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
}
