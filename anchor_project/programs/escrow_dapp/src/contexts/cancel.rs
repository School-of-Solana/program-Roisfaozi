use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};
use crate::state::EscrowState;

pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
    let seeds = &[
        b"state".as_ref(),
        ctx.accounts.initializer.key.as_ref(),
        &[ctx.bumps.escrow_state],
    ];
    let signer = &[&seeds[..]];

    // Transfer tokens back to the initializer
    let cpi_accounts_tx = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.initializer_ata_a.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
    };
    let cpi_program_tx = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_tx = CpiContext::new_with_signer(cpi_program_tx, cpi_accounts_tx, signer);
    token::transfer(cpi_ctx_tx, ctx.accounts.vault.amount)?;

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
pub struct Cancel<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(
        mut,
        close = initializer,
        has_one = initializer,
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
    #[account(
        mut,
        associated_token::mint = escrow_state.mint_a,
        associated_token::authority = initializer
    )]
    pub initializer_ata_a: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
