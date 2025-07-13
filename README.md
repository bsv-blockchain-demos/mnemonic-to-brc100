# Mnemonic to BRC-100

This tool helps recover funds from Bitcoin SV (BSV) wallets that may no longer be online by deriving addresses from a mnemonic phrase, checking for unspent transaction outputs (UTXOs), and creating an ingest transaction compatible with BRC-100 wallets.

**Important Security Note:**  
For maximum security, we strongly recommend running this tool locally on your own machine. This ensures that your mnemonic phrase and PIN never leave your device. If you use the hosted version at [mnemonic-brc100.vercel.app](https://mnemonic-brc100.vercel.app), you must trust the host (@sirdeggen on GitHub) not to capture or misuse your sensitive information. Running locally eliminates this trust requirement and is the safer option when dealing with private keys and funds recovery.

## Features
- Derive addresses from a mnemonic phrase using a specified derivation path prefix.
- Scan for used addresses with transaction history and current UTXOs.
- Calculate balances and display results in a table.
- Generate an ingest transaction to sweep funds into a BRC-100 compatible format.
- Modern, responsive design for mobile and desktop.

## Prerequisites
- Node.js (version 18 or later)
- npm (comes with Node.js)

## Installation and Running Locally

1. Clone the repository:
   ```
   git clone https://github.com/sirdeggen/centbee-to-brc100.git
   cd centbee-to-brc100
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173` (or the port shown in the terminal).

The app will now be running locally, and you can use it securely without sending data to any external servers.

## Usage

1. Enter your mnemonic phrase in the textarea.
2. Enter your PIN (if applicable; leave blank if none).
3. Specify a derivation path prefix (see recommendations below).
4. Click "Generate Addresses" to scan for used addresses with UTXOs.
5. If UTXOs are found, review the table and click "Create Ingest Tx" to generate the transaction hex.
6. The transaction hex and a link to view it on What's On Chain will be displayed. You can then broadcast this transaction using a BRC-100 compatible wallet.

**Warning:** Handle your mnemonic and PIN with extreme care. Exposure can lead to loss of funds. Always verify addresses and transactions before broadcasting.

## Recommended Derivation Path Prefixes

This tool uses HD wallet derivation based on standards like BIP44. Here are some common prefixes in the BSV ecosystem:

- **BIP44 Standard for BSV:** `m/44'/0'/0'` (coin type 0 for Bitcoin, but often used in BSV forks).
- **Alternative BIP44 for BSV:** `m/44'/236'/0'` (using BSV-specific coin type 236).
- **Electrum/Electron Cash Style:** `m/44'/0'/0` (non-hardened, common in some BSV wallets).
- **HandCash/Centbee Style:** `m/0'` or `m/44'/0'/0` (check wallet-specific docs; some use custom paths).
- **Other Common Paths:** 
  - `m/0'/0` (simple hardened path).
  - `m/49'/0'/0'` (for P2SH addresses, if applicable).
  - `m/84'/0'/0'` (for native SegWit, though less common in BSV).

Start with `m/44'/0'/0` and try variations if no funds are found. Consult your wallet's documentation for the exact path used.

## Development
This project is built with React, TypeScript, and Vite. To build for production:
```
npm run build
```

## License
MIT License. See [LICENSE](LICENSE) for details.
