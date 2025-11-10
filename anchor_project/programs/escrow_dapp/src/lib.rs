use anchor_lang::prelude::*;

pub mod contexts;
pub mod state;

use contexts::*;

declare_id!("5afza8swMPYeP3cf3sDhszmqS2WpBs8ewrPbMPai9Cbb");

#[program]
pub mod escrow_dapp {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        initializer_amount: u64,
        taker_amount: u64,
    ) -> Result<()> {
        contexts::initialize(ctx, initializer_amount, taker_amount)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        contexts::cancel(ctx)
    }

    pub fn exchange(ctx: Context<Exchange>) -> Result<()> {
        contexts::exchange(ctx)
    }
}

