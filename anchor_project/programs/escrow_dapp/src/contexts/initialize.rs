use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::EscrowState;

pub fn initialize(
    ctx: Context<Initialize>,
    initializer_amount: u64,
    taker_amount: u64,
) -> Result<()> {
    ctx.accounts.escrow_state.initializer = *ctx.accounts.initializer.key;
    ctx.accounts.escrow_state.taker = *ctx.accounts.taker.key;
    ctx.accounts.escrow_state.initializer_amount = initializer_amount;
    ctx.accounts.escrow_state.taker_amount = taker_amount;
    ctx.accounts.escrow_state.mint_a = ctx.accounts.mint_a.key();
    ctx.accounts.escrow_state.mint_b = ctx.accounts.mint_b.key();

    let cpi_accounts = Transfer {
        from: ctx.accounts.initializer_ata_a.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.initializer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, initializer_amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub taker: AccountInfo<'info>,
    pub mint_a: Account<'info, Mint>,
    pub mint_b: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = initializer
    )]
    pub initializer_ata_a: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 8 + 8 + 32 + 32,
        seeds = [b"state".as_ref(), initializer.key().as_ref()],
        bump
    )]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        init,
        payer = initializer,
        token::mint = mint_a,
        token::authority = escrow_state,
        seeds = [b"vault".as_ref(), initializer.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}
