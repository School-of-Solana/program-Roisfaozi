use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};
use crate::state::EscrowState;

pub fn exchange(ctx: Context<Exchange>) -> Result<()> {
    // Transfer tokens from taker to initializer
    let cpi_accounts_taker_tx = Transfer {
        from: ctx.accounts.taker_ata_b.to_account_info(),
        to: ctx.accounts.initializer_ata_b.to_account_info(),
        authority: ctx.accounts.taker.to_account_info(),
    };
    let cpi_program_taker_tx = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_taker_tx = CpiContext::new(cpi_program_taker_tx, cpi_accounts_taker_tx);
    token::transfer(cpi_ctx_taker_tx, ctx.accounts.escrow_state.taker_amount)?;

    // Transfer tokens from vault to taker
    let seeds = &[
        b"state".as_ref(),
        ctx.accounts.initializer.key.as_ref(),
        &[ctx.bumps.escrow_state],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts_vault_tx = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.taker_ata_a.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
    };
    let cpi_program_vault_tx = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_vault_tx = CpiContext::new_with_signer(cpi_program_vault_tx, cpi_accounts_vault_tx, signer);
    token::transfer(cpi_ctx_vault_tx, ctx.accounts.escrow_state.initializer_amount)?;

    // Close the vault account
    let cpi_accounts_close = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.initializer.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
    };
    let cpi_program_close = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_close = CpiContext::new_with_signer(cpi_program_close, cpi_accounts_close, signer);
    token::close_account(cpi_ctx_close)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Exchange<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    /// CHECK: This is safe because we only use this account to receive lamports from the closed escrow_state account.
    #[account(mut)]
    pub initializer: AccountInfo<'info>,
    pub mint_a: Account<'info, Mint>,
    pub mint_b: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = taker
    )]
    pub taker_ata_a: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = taker
    )]
    pub taker_ata_b: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = initializer
    )]
    pub initializer_ata_b: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = initializer,
        constraint = escrow_state.taker == *taker.key,
        constraint = escrow_state.initializer == *initializer.key,
        constraint = escrow_state.mint_a == mint_a.key(),
        constraint = escrow_state.mint_b == mint_b.key(),
        seeds = [b"state".as_ref(), initializer.key().as_ref()],
        bump
    )]
    pub escrow_state: Account<'info, EscrowState>,
    #[account(
        mut,
        seeds = [b"vault".as_ref(), initializer.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
