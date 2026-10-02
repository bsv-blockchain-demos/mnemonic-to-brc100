# Mnemonic to BRC-100

A browser-based BSV recovery tool that derives addresses from a mnemonic, finds spendable outputs on mainnet and sweeps them into a connected BRC-100 wallet. Built with React, TypeScript, Vite and the BSV SDK.

**The sweep action creates, signs and submits a real transaction.** It is more than a transaction-hex generator. Review the source and run a trusted local copy before entering recovery material.

## What it does

- Derives addresses using a mnemonic, the optional PIN/passphrase and a configurable derivation path prefix.
- Queries WhatsOnChain for address history, unspent outputs and source-transaction BEEF.
- Lists addresses with spendable outputs, excluding outputs reported as spent in the mempool.
- Uses the connected wallet to construct the receiving transaction, signs the recovered inputs locally and submits them with `signAction`.
- Displays the resulting transaction hex and a WhatsOnChain link after successful submission.

The application uses mainnet APIs and P2PKH inputs. It does not automatically discover every wallet's derivation scheme.

## Run locally

Use Node.js 22.12 or newer and npm. Scanning needs an internet connection. Sweeping also needs a running, unlocked BRC-100 wallet configured for mainnet.

```sh
git clone https://github.com/bsv-blockchain-demos/mnemonic-to-brc100.git
cd mnemonic-to-brc100
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. No environment file or application backend is required.

Mnemonic and PIN inputs are held in browser memory. Local hosting does not make scanning offline: derived addresses and transaction identifiers are sent to WhatsOnChain, and wallet operations communicate with the connected wallet. The app also logs addresses and transaction details to the browser console.

## Recovery workflow

1. Enter the mnemonic and, if required by the original wallet, the PIN/passphrase used to derive its seed. The PIN field is passed directly to the SDK's mnemonic-to-seed method.
2. Set the exact derivation path prefix used by the original wallet. The app appends `/<index>` to that prefix. Its default is `m/44'/0/0`; the selectable examples are starting points, not universal wallet compatibility guarantees.
3. Set a non-negative start offset and a positive unused-address gap. Defaults are index `0` and five consecutive addresses without history.
4. Select **Derive and Check Balance of Addresses**. Review the addresses, satoshi balances and output counts.
5. Select **Sweep Into My Local Wallet** only when ready to transfer all outputs in the results table. Approve the connected wallet's requests.
6. Check the resulting transaction and receiving wallet. A returned transaction ID is not a mined-confirmation check.

Results accumulate across scans. Refresh the page before changing the mnemonic or PIN, and before starting a separate recovery session. An API or derivation error can stop a scan early; an empty or partial table does not establish that the original wallet has no funds.

The fee guard currently rejects a transaction when its calculated fee exceeds one satoshi and its pre-signing rate exceeds 1,000 satoshis per kilobyte. It is a code-level guard, not a fee estimate or a recovery guarantee.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build static assets in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the key-alignment, signature-validation and transaction-signing scripts. |

The test command invokes `npx tsx`; `tsx` is not declared in this project's dependencies, so npm may need to obtain it on first use. These scripts exercise SDK primitives with test data. They do not establish that a particular live wallet can be recovered.

The application workflow is in [src/App.tsx](src/App.tsx). Existing technical notes are collected in [TESTS.md](TESTS.md) and [TRANSACTION_API_GUIDE.md](TRANSACTION_API_GUIDE.md); check older notes against the current implementation.

## Licence

**Apache 2.0 licence.** See [LICENSE.txt](LICENSE.txt) for the full terms. A browser-served copy is available in [public/LICENSE.txt](public/LICENSE.txt).
