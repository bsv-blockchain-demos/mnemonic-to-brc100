# @bsv/sdk Transaction API Guide

## Overview

This guide demonstrates the correct way to create, sign, and verify BSV transactions using @bsv/sdk v1.8.2, based on actual implementation patterns in this codebase.

## Table of Contents

1. [Basic Transaction Flow](#basic-transaction-flow)
2. [Transaction Input API](#transaction-input-api)
3. [Signing Patterns](#signing-patterns)
4. [Signature Verification](#signature-verification)
5. [Real-World Example](#real-world-example)

## Basic Transaction Flow

### Step 1: Create a Source Transaction (UTXO)

```typescript
import { Transaction, PrivateKey, P2PKH } from '@bsv/sdk'

// Generate keys
const privateKey = PrivateKey.fromRandom()
const publicKey = privateKey.toPublicKey()
const publicKeyHash = publicKey.toHash()

// Create P2PKH locking script
const p2pkh = new P2PKH()
const lockingScript = p2pkh.lock(publicKeyHash)

// Create source transaction with P2PKH output
const sourceTx = new Transaction(
  1, // version
  [], // inputs (empty for funding/coinbase tx)
  [
    {
      lockingScript,
      satoshis: 5000
    }
  ],
  0 // lockTime
)
```

### Step 2: Create a Spending Transaction

```typescript
const spendTx = new Transaction(
  1, // version
  [
    {
      sourceTransaction: sourceTx,  // ✅ Use full Transaction object for SPV
      sourceOutputIndex: 0,
      sequence: 0xffffffff
    }
  ],
  [
    {
      lockingScript: p2pkh.lock(publicKeyHash),
      satoshis: 4500 // 500 satoshis for fee
    }
  ],
  0 // lockTime
)
```

### Step 3: Sign the Transaction

```typescript
// Create unlocking script template
const unlockingTemplate = p2pkh.unlock(privateKey)

// Sign to generate unlocking script
const unlockingScript = await unlockingTemplate.sign(spendTx, 0)
```

### Step 4: Verify the Signature

```typescript
import { Spend } from '@bsv/sdk'

const spend = new Spend({
  sourceTXID: sourceTx.id('hex'),
  sourceOutputIndex: 0,
  sourceSatoshis: 5000,
  lockingScript,
  transactionVersion: 1,
  otherInputs: [],
  inputIndex: 0,
  unlockingScript,
  outputs: spendTx.outputs,
  inputSequence: 0xffffffff,
  lockTime: 0
})

const isValid = spend.validate() // true if signature is valid
```

## Transaction Input API

### Method 1: sourceTransaction (Recommended)

Use the full `Transaction` object for SPV verification:

```typescript
tx.addInput({
  sourceTransaction: sourceTx,  // Full Transaction object
  sourceOutputIndex: 0,
  sequence: 0xffffffff
})
```

**Advantages:**
- Enables SPV (Simplified Payment Verification)
- Includes merkle proof for validation
- Required for BEEF (BRC-62) format

### Method 2: sourceTXID (Alternative)

Use just the transaction ID:

```typescript
import { UnlockingScript } from '@bsv/sdk'

tx.addInput({
  sourceTXID: 'abc123...',
  sourceOutputIndex: 0,
  unlockingScript: new UnlockingScript(), // Must provide unlocking script
  sequence: 0xffffffff
})
```

**When to use:**
- When you don't have the full transaction
- For lightweight operations
- When SPV is not required

## Signing Patterns

### Pattern 1: Direct Signing (Simple)

```typescript
const unlockingTemplate = p2pkh.unlock(privateKey)
const unlockingScript = await unlockingTemplate.sign(tx, inputIndex)
```

### Pattern 2: Template + tx.sign() (Recommended from App.tsx)

This is the pattern used in the actual codebase:

```typescript
// Set unlocking script template on each input
tx.inputs.forEach(input => {
  input.unlockingScriptTemplate = new P2PKH().unlock(privateKey)
})

// Calculate fees
await tx.fee()

// Sign all inputs at once
await tx.sign()

// Access generated unlocking scripts
tx.inputs.forEach(input => {
  console.log(input.unlockingScript!.toHex())
})
```

### Pattern 3: Multiple Inputs with Different Keys

```typescript
// Map of TXID to private keys
const privKeysByTxid = {
  'abc123...': privateKey1,
  'def456...': privateKey2
}

// Set appropriate key for each input
tx.inputs.forEach(input => {
  const txid = input.sourceTransaction!.id('hex')
  const privKey = privKeysByTxid[txid]

  if (!privKey) {
    throw new Error(`No private key found for input: ${txid}`)
  }

  input.unlockingScriptTemplate = new P2PKH().unlock(privKey)
})

await tx.fee()
await tx.sign()
```

## Signature Verification

### Using the Spend Validator

The `Spend` class validates that an unlocking script correctly satisfies a locking script:

```typescript
import { Spend } from '@bsv/sdk'

const spend = new Spend({
  sourceTXID: sourceTx.id('hex'),
  sourceOutputIndex: 0,
  sourceSatoshis: satoshis,
  lockingScript: lockingScript,
  transactionVersion: tx.version,
  otherInputs: [], // Other inputs in the transaction
  inputIndex: 0,   // Index of this input
  unlockingScript: unlockingScript,
  outputs: tx.outputs,
  inputSequence: 0xffffffff,
  lockTime: tx.lockTime
})

const isValid = spend.validate()
if (!isValid) {
  throw new Error('Invalid signature')
}
```

## Real-World Example

This example replicates the pattern from `App.tsx` (lines 231-241):

```typescript
import {
  Transaction,
  PrivateKey,
  P2PKH,
  Beef,
  Utils
} from '@bsv/sdk'

async function createIngestTransaction(
  utxos: Array<{ txid: string; vout: number; value: number; privKey: PrivateKey }>
) {
  // 1. Fetch BEEF data for all source transactions
  const beef = new Beef()
  const inputs = []
  const privKeyMap = {}

  for (const utxo of utxos) {
    // Fetch BEEF from API
    const response = await fetch(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.txid}/beef`
    )
    const beefHex = await response.text()
    const beefBytes = Utils.toArray(beefHex, 'hex')

    // Merge BEEF data
    beef.mergeBeef(beefBytes)

    // Prepare input
    inputs.push({
      inputDescription: 'UTXO to ingest',
      unlockingScriptLength: 108, // Standard P2PKH unlocking script length
      outpoint: `${utxo.txid}.${utxo.vout}`
    })

    // Store private key for signing
    privKeyMap[utxo.txid] = utxo.privKey
  }

  // 2. Create action with wallet (using BRC-100 interface)
  const { signableTransaction } = await wallet.createAction({
    inputBEEF: beef.toBinary(),
    description: 'Ingesting UTXOs',
    inputs
  })

  // 3. Parse transaction
  const tx = Transaction.fromAtomicBEEF(signableTransaction.tx)

  // 4. Verify fees are reasonable
  const sats = tx.getFee()
  const size = tx.toBinary().length
  const kb = size / 1000
  const satsPerKb = sats / kb

  if (sats > 1 && satsPerKb > 10) {
    throw new Error('Fee too high, aborting')
  }

  // 5. Set unlocking script templates for all inputs
  tx.inputs.forEach(input => {
    const txid = input.sourceTransaction!.id('hex')
    const privKey = privKeyMap[txid]

    if (!privKey) {
      throw new Error(`No private key for input: ${txid}.${input.sourceOutputIndex}`)
    }

    input.unlockingScriptTemplate = new P2PKH().unlock(privKey)
  })

  // 6. Calculate fees and sign
  await tx.fee()
  await tx.sign()

  // 7. Extract unlocking scripts for wallet
  const spends = {}
  tx.inputs.forEach((input, index) => {
    spends[index] = {
      unlockingScript: input.unlockingScript!.toHex()
    }
  })

  // 8. Broadcast via wallet
  const { txid } = await wallet.signAction({
    reference: signableTransaction.reference,
    spends,
    options: {
      acceptDelayedBroadcast: false,
      returnTXIDOnly: true
    }
  })

  return txid
}
```

## Key Points to Remember

### ✅ Do's

1. **Use `sourceTransaction`** when possible for SPV verification
2. **Set `unlockingScriptTemplate`** on inputs before calling `tx.sign()`
3. **Use proper BSV terminology**: locking/unlocking scripts
4. **Call `await tx.fee()`** before signing to calculate proper fees
5. **Validate signatures** using the `Spend` class
6. **Handle async operations** with await/try-catch

### ❌ Don'ts

1. **Don't use old terminology**: scriptPubKey/scriptSig
2. **Don't skip fee calculation** before signing
3. **Don't reuse addresses** - generate new addresses for change
4. **Don't mix sync/async** - always await transaction operations
5. **Don't forget error handling** - wrap signing in try-catch blocks

## BSV Terminology

| Old Term | BSV Term | Description |
|----------|----------|-------------|
| scriptPubKey | Locking Script | Script that locks coins to an address |
| scriptSig | Unlocking Script | Script that proves ownership |
| - | Unlocking Script Template | Template that generates unlocking scripts |

## Testing

Run the comprehensive test suite:

```bash
npm test
```

Tests are located in `/Users/personal/git/centbee-to-brc100/src/__tests__/transaction-signing.test.ts`

## Additional Resources

- **SDK Documentation**: https://bsv-blockchain.github.io/ts-sdk
- **SDK Repository**: https://github.com/bsv-blockchain/ts-sdk
- **BRC Standards**: https://github.com/bitcoin-sv/BRCs
- **BRC-42 (Key Derivation)**: Core privacy standard
- **BRC-62 (BEEF Format)**: Transaction package format
- **BRC-100 (Wallet Interface)**: Wallet-to-application standard

## Support

For questions or issues:
1. Review the test suite in `src/__tests__/`
2. Check the SDK documentation
3. Review BRC standards for protocol details
4. Examine the codebase in `App.tsx` for real-world usage
