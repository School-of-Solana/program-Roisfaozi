# Prompt: Membangun dApp Escrow Dua Pihak dengan TDD di Solana

## 🎯 Tujuan Proyek

Membangun, menguji, dan men-deploy program Solana menggunakan Anchor Framework yang berfungsi sebagai sistem escrow untuk pertukaran token antara dua pihak (Alice dan Bob). Proyek ini harus dikembangkan dengan metodologi **Test-Driven Development (TDD)** secara ketat.

## 🛠️ Teknologi & Best Practice

*   **Framework:** Anchor (Rust)
*   **Token:** Standar SPL Token
*   **Arsitektur:** Program Derived Address (PDA) untuk *state* dan *vault*.
*   **Metodologi:** Test-Driven Development (TDD). Setiap fungsionalitas harus dimulai dengan tes yang gagal.
*   **Keamanan:** Menggunakan *constraints* Anchor (`has_one`, `constraint`) untuk validasi akun.

---

## 📋 Alur Pengembangan Langkah-demi-Langkah

### Fase 0: Persiapan & Pengaturan Proyek

1.  **Inisialisasi Proyek Anchor di Direktori `anchor_project`:**
    *   Gunakan perintah berikut di dalam direktori `/home/rois/school-of-solana/program-Roisfaozi/anchor_project/`.

    ```bash
    anchor init escrow_dapp --template=bare && mv escrow_dapp/* . && rm -rf escrow_dapp
    ```

2.  **Tambahkan Dependensi `anchor-spl`:**
    *   Edit `anchor_project/Cargo.toml` untuk menyertakan `anchor-spl` versi `0.30.0`.

    ```toml
    # anchor_project/Cargo.toml

    [dependencies]
    anchor-lang = "0.30.0"
    anchor-spl = "0.30.0"
    ```

### Fase 1: Instruksi `initialize` (TDD)

#### 1.1. [RED] Tulis Tes yang Gagal untuk Inisialisasi

*   **Lokasi:** `anchor_project/tests/escrow_dapp.ts`
*   **Tujuan:** Buat tes `it("Should initialize the escrow", ...)` yang akan gagal.
*   **Logika Tes:**
    1.  Siapkan lingkungan tes (provider, wallet, keypair untuk Alice & Bob).
    2.  Buat dua mint token baru (Token A dan Token B).
    3.  Buat Akun Token Terkait (ATA) untuk Alice (Token A) dan mint token ke dalamnya.
    4.  Panggil instruksi `program.methods.initialize(initializerAmount, takerAmount)`.
    5.  **Assertion:**
        *   Fetch akun `escrowState`. Pastikan datanya (initializer, taker, amounts) benar.
        *   Fetch akun `vault`. Pastikan saldonya sama dengan `initializerAmount`.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi bahwa tes gagal dengan pesan "Function not found".

#### 1.2. [GREEN] Implementasikan Kode Program `initialize`

*   **Lokasi:** `anchor_project/src/lib.rs`
*   **Langkah-langkah:**
    1.  **Definisikan `EscrowState` Account:**
        ```rust
        #[account]
        pub struct EscrowState {
            pub initializer: Pubkey,
            pub taker: Pubkey,
            pub initializer_amount: u64,
            pub taker_amount: u64,
            pub mint_a: Pubkey,
            pub mint_b: Pubkey,
        }
        ```
    2.  **Definisikan `Initialize` Accounts Context:**
        ```rust
        #[derive(Accounts)]
        pub struct Initialize<'info> {
            #[account(mut)]
            pub initializer: Signer<'info>,
            pub mint_a: Account<'info, Mint>,
            #[account(
                mut,
                associated_token::mint = mint_a,
                associated_token::authority = initializer
            )]
            pub initializer_ata_a: Account<'info, TokenAccount>,
            #[account(
                init,
                payer = initializer,
                space = 8 + 32 + 32 + 8 + 8 + 32 + 32, // Sesuaikan space
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
        ```
    3.  **Implementasikan Logika `initialize`:**
        *   Isi semua field di `ctx.accounts.escrow_state`.
        *   Panggil `anchor_spl::token::transfer` untuk memindahkan token dari `initializer_ata_a` ke `vault`.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi tes `initialize` sekarang berhasil.

### Fase 2: Instruksi `cancel` (TDD)

#### 2.1. [RED] Tulis Tes yang Gagal untuk Pembatalan

*   **Lokasi:** `anchor_project/tests/escrow_dapp.ts`
*   **Tujuan:** Buat tes `it("Should cancel the escrow", ...)` yang akan gagal.
*   **Logika Tes:**
    1.  Setup tes dengan membuat escrow yang sudah terinisialisasi.
    2.  Panggil instruksi `program.methods.cancel()`.
    3.  **Assertion:**
        *   Pastikan akun `escrowState` dan `vault` sudah ditutup (fetching akan error).
        *   Pastikan saldo Token A di akun `initializer_ata_a` kembali ke saldo awal.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi tes `cancel` gagal.

#### 2.2. [GREEN] Implementasikan Kode Program `cancel`

*   **Lokasi:** `anchor_project/src/lib.rs`
*   **Langkah-langkah:**
    1.  **Definisikan `Cancel` Accounts Context:**
        ```rust
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
                close = initializer,
                seeds = [b"vault".as_ref(), initializer.key().as_ref()],
                bump
            )]
            pub vault: Account<'info, TokenAccount>,
            // ... Akun lain yang relevan
            pub token_program: Program<'info, Token>,
        }
        ```
    2.  **Implementasikan Logika `cancel`:**
        *   Panggil `anchor_spl::token::transfer` untuk mengembalikan token dari `vault` ke `initializer_ata_a`.
        *   Gunakan `CpiContext::new_with_signer` untuk menandatangani transfer atas nama PDA.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi semua tes berhasil.

### Fase 3: Instruksi `exchange` (TDD)

#### 3.1. [RED] Tulis Tes yang Gagal untuk Pertukaran

*   **Lokasi:** `anchor_project/tests/escrow_dapp.ts`
*   **Tujuan:** Buat tes `it("Should exchange the tokens", ...)` yang akan gagal.
*   **Logika Tes:**
    1.  Setup tes dengan escrow yang aktif.
    2.  Buat ATA untuk Bob (Token B) dan mint token ke dalamnya.
    3.  Buat ATA untuk Alice (Token B) untuk menerima pembayaran.
    4.  Sebagai Bob, panggil `program.methods.exchange()`.
    5.  **Assertion:**
        *   Pastikan `escrowState` dan `vault` ditutup.
        *   Pastikan saldo Token A di akun Bob bertambah.
        *   Pastikan saldo Token B di akun Alice bertambah.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi tes `exchange` gagal.

#### 3.2. [GREEN] Implementasikan Kode Program `exchange`

*   **Lokasi:** `anchor_project/src/lib.rs`
*   **Langkah-langkah:**
    1.  **Definisikan `Exchange` Accounts Context:** Ini adalah konteks paling kompleks, pastikan menyertakan semua akun token yang relevan untuk kedua pihak dan gunakan *constraints* untuk validasi (`has_one`, `constraint = escrow_state.taker == taker.key()`).
    2.  **Implementasikan Logika `exchange`:**
        *   **Transfer 1:** Panggil `anchor_spl::token::transfer` untuk mengirim Token B dari Bob ke Alice.
        *   **Transfer 2:** Panggil `anchor_spl::token::transfer` dengan `CpiContext::new_with_signer` untuk mengirim Token A dari `vault` ke Bob.
*   **Eksekusi:** Jalankan `anchor test`. Verifikasi semua tes berhasil.

### Fase 4: Deployment & Frontend

1.  **Deploy Program:**
    ```bash
    anchor build
    anchor deploy
    ```
    *Catat Program ID yang dihasilkan.*

2.  **Inisialisasi Frontend:**
    *   Di direktori `frontend`, jalankan `npx create-solana-dapp .`
    *   Instal dependensi: `@project-serum/anchor @solana/wallet-adapter-react @solana/wallet-adapter-base @solana/wallet-adapter-react-ui` dan wallet adapter pilihan Anda.

3.  **Integrasi:**
    *   Salin file IDL dari `anchor_project/target/idl/escrow_dapp.json` ke direktori `frontend`.
    *   Bangun UI dengan komponen untuk menghubungkan wallet, membuat escrow, dan menampilkan daftar escrow yang ada dengan tombol untuk `cancel` atau `exchange`.
    *   Implementasikan logika client-side untuk memanggil instruksi on-chain.
