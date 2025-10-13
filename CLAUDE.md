# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + TypeScript + Vite application for recovering BSV (Bitcoin SV) funds from wallets that may no longer be online. It derives addresses from a mnemonic phrase, scans for UTXOs, and creates BRC-100 compatible ingest transactions to sweep funds into a local wallet.

**Security Context:** This tool handles sensitive cryptographic material (mnemonic phrases, PINs, private keys). The application is designed to run locally to prevent exposure of these secrets. Never log, store, or transmit mnemonic phrases or private keys unnecessarily.

## Commands

```bash
# Development server (runs on port 5173 by default)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Core Workflow

The application follows a two-phase workflow:

1. **Address Discovery Phase** ([src/App.tsx:82-147](src/App.tsx#L82-L147))
   - Derives HD wallet addresses from mnemonic + PIN using `@bsv/sdk`
   - Scans addresses using the gap limit pattern (default: 5 consecutive unused addresses)
   - Queries WhatsOnChain API for address history and UTXOs
   - Displays results table showing addresses with spendable UTXOs

2. **Transaction Creation & Broadcasting Phase** ([src/App.tsx:149-276](src/App.tsx#L149-L276))
   - Connects to local BRC-100 wallet (Metanet Desktop) via `WalletClient`
   - Fetches BEEF (BSV Expanded Format) for each UTXO's source transaction
   - Creates and signs an ingest transaction using wallet's output assignment
   - Validates fees (< 10 sats/kb) before broadcasting
   - Signs with P2PKH and broadcasts via wallet

### API Rate Limiting

WhatsOnChain API requests are rate-limited to ~3 requests/second using a FIFO queue ([src/App.tsx:6-44](src/App.tsx#L6-L44)). The `queuedFetch` function wraps all external API calls to prevent rate limit errors during address scanning.

### Key Dependencies

- `@bsv/sdk`: Core BSV blockchain functionality (HD derivation, transactions, BEEF, P2PKH)
- `WalletClient`: BRC-100 wallet integration for transaction creation and broadcasting
- WhatsOnChain API: Address history, UTXOs, and BEEF retrieval

### HD Wallet Derivation

The app supports various derivation path formats:
- BIP44 standard: `m/44'/0'/0'` (Centbee)
- Simple hardened: `m/0'/0` (Rock Wallet, other wallets)
- Custom paths configurable via UI

Paths are derived using `HD.fromSeed().derive(fullPath)` with automatic handling of hardened (`'`) notation.

### Transaction Construction

The ingest transaction flow:
1. Groups UTXOs by source transaction ID to optimize BEEF fetching
2. Merges BEEF data for all source transactions
3. Calls `wallet.createAction()` to get wallet-managed outputs
4. Signs inputs with P2PKH templates using derived private keys
5. Validates fee structure before broadcasting
6. Submits signed transaction via `wallet.signAction()`

### State Management

Simple React `useState` hooks manage:
- `results`: Array of discovered addresses with UTXOs
- `txHex`: Completed transaction hex after broadcast
- `isLoading`: Loading state with contextual messages
- Form inputs: mnemonic, PIN, derivation path, gap limit, start offset

## Important Patterns

### Fee Validation
Always validate fees before broadcasting ([src/App.tsx:220-227](src/App.tsx#L220-L227)). Throw error if sats/kb > 10 to prevent excessive fees.

### UTXO Filtering
Filter out mempool-spent UTXOs ([src/App.tsx:119](src/App.tsx#L119)) to prevent double-spend attempts.

### Error Handling
Most async operations use try/catch with console.error logging. User-facing errors use `alert()` for simplicity in this single-page application.

### Security Considerations
- Mnemonic and PIN are held in React state only (never persisted)
- Private keys are derived on-demand and not stored
- SIGHASH_ALL is used to prevent transaction malleability
- Application designed for local execution to minimize exposure

## BSV SDK Integration

This project heavily uses `@bsv/sdk` primitives:
- `Mnemonic`: BIP39 mnemonic phrase handling
- `HD`: Hierarchical deterministic key derivation
- `PrivateKey`/`PublicKey`: Key management
- `P2PKH`: Pay-to-public-key-hash script templates
- `Transaction`: Transaction construction and signing
- `Beef`: BSV Expanded Format for transaction ancestry
- `WalletClient`: BRC-100 wallet communication

Refer to BSV SDK documentation when modifying transaction construction or key derivation logic.
