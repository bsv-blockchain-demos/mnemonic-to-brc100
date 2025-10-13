# @bsv/sdk Quick Reference Card

## Import Statements

```typescript
import {
  Transaction,
  PrivateKey,
  PublicKey,
  P2PKH,
  LockingScript,
  UnlockingScript,
  Spend,
  Beef,
  Utils
} from '@bsv/sdk'
```

## Key Generation

```typescript
// Random key
const privKey = PrivateKey.fromRandom()

// From WIF
const privKey = PrivateKey.fromWif('L5EY1SbTvvPN...')

// From number (testing only)
const privKey = new PrivateKey(11)

// Derive public key
const pubKey = privKey.toPublicKey()

// Get public key hash
const pubKeyHash = pubKey.toHash()

// Get address
const address = pubKey.toAddress().toString()
```

## P2PKH Script Template

```typescript
const p2pkh = new P2PKH()

// Lock to address
const lockingScript = p2pkh.lock(address)
// OR lock to public key hash
const lockingScript = p2pkh.lock(pubKeyHash)

// Create unlock template
const unlockingTemplate = p2pkh.unlock(privateKey)
```

## Transaction Creation

### Constructor Pattern

```typescript
const tx = new Transaction(
  1,                    // version
  [...inputs],          // array of inputs
  [...outputs],         // array of outputs
  0                     // lockTime
)
```

### Add Input

```typescript
// Method 1: With source transaction (recommended for SPV)
tx.addInput({
  sourceTransaction: sourceTx,
  sourceOutputIndex: 0,
  sequence: 0xffffffff
})

// Method 2: With TXID only
tx.addInput({
  sourceTXID: 'abc123...',
  sourceOutputIndex: 0,
  unlockingScript: new UnlockingScript(),
  sequence: 0xffffffff
})
```

### Add Output

```typescript
tx.addOutput({
  lockingScript: p2pkh.lock(address),
  satoshis: 5000
})

// Change output
tx.addOutput({
  lockingScript: p2pkh.lock(changeAddress),
  change: true
})
```

## Transaction Signing

### Pattern 1: Direct Sign

```typescript
const template = p2pkh.unlock(privateKey)
const unlockingScript = await template.sign(tx, inputIndex)
```

### Pattern 2: Template + tx.sign() ⭐ RECOMMENDED

```typescript
// Set template on input
tx.inputs[0].unlockingScriptTemplate = p2pkh.unlock(privateKey)

// Calculate fees
await tx.fee()

// Sign all inputs
await tx.sign()

// Access generated script
const script = tx.inputs[0].unlockingScript
```

### Pattern 3: Multiple Inputs

```typescript
tx.inputs.forEach(input => {
  const txid = input.sourceTransaction!.id('hex')
  const privKey = findPrivateKey(txid)
  input.unlockingScriptTemplate = new P2PKH().unlock(privKey)
})

await tx.fee()
await tx.sign()
```

## Signature Verification

```typescript
import { Spend } from '@bsv/sdk'

const spend = new Spend({
  sourceTXID: sourceTx.id('hex'),
  sourceOutputIndex: 0,
  sourceSatoshis: 5000,
  lockingScript: lockingScript,
  transactionVersion: 1,
  otherInputs: [],
  inputIndex: 0,
  unlockingScript: unlockingScript,
  outputs: tx.outputs,
  inputSequence: 0xffffffff,
  lockTime: 0
})

const isValid = spend.validate() // true/false
```

## Transaction Properties

```typescript
// Get transaction ID
const txid = tx.id('hex')

// Get transaction hash
const hash = tx.hash()

// Serialize
const hex = tx.toHex()
const binary = tx.toBinary()

// Deserialize
const tx = Transaction.fromHex(hex)
const tx = Transaction.fromBinary(binary)

// Get fee
const fee = tx.getFee()

// Get size
const size = tx.toBinary().length
```

## BEEF Format (BRC-62)

```typescript
import { Beef, Utils } from '@bsv/sdk'

// Create BEEF
const beef = new Beef()

// Merge BEEF from API
const beefHex = await response.text()
const beefBytes = Utils.toArray(beefHex, 'hex')
beef.mergeBeef(beefBytes)

// Get BEEF binary
const beefBinary = beef.toBinary()

// Parse transaction from BEEF
const tx = Transaction.fromAtomicBEEF(beefBinary)
```

## Error Handling

```typescript
try {
  await tx.fee()
  await tx.sign()

  const spend = new Spend({...})
  if (!spend.validate()) {
    throw new Error('Invalid signature')
  }
} catch (error) {
  console.error('Transaction failed:', error)
  throw error
}
```

## Common Patterns

### Create Source UTXO

```typescript
const sourceTx = new Transaction(
  1, [], [{ lockingScript, satoshis: 10000 }], 0
)
```

### Spend UTXO

```typescript
const spendTx = new Transaction(
  1,
  [{ sourceTransaction: sourceTx, sourceOutputIndex: 0, sequence: 0xffffffff }],
  [{ lockingScript: p2pkh.lock(address), satoshis: 9500 }],
  0
)
spendTx.inputs[0].unlockingScriptTemplate = p2pkh.unlock(privateKey)
await spendTx.fee()
await spendTx.sign()
```

### Check Fees

```typescript
const sats = tx.getFee()
const size = tx.toBinary().length
const kb = size / 1000
const satsPerKb = sats / kb

if (sats > 1 && satsPerKb > 10) {
  throw new Error('Fee too high')
}
```

## TypeScript Types

```typescript
interface TransactionInput {
  sourceTransaction?: Transaction
  sourceTXID?: string
  sourceOutputIndex: number
  unlockingScript?: UnlockingScript
  unlockingScriptTemplate?: UnlockingScriptTemplate
  sequence: number
}

interface TransactionOutput {
  lockingScript: LockingScript
  satoshis: number
  change?: boolean
}
```

## BSV Terminology

| Correct Term | Old Term | Usage |
|--------------|----------|-------|
| Locking Script | scriptPubKey | Locks coins |
| Unlocking Script | scriptSig | Unlocks coins |
| Unlocking Script Template | - | Generates unlocking scripts |

## Constants

```typescript
// Sequence
const DEFAULT_SEQUENCE = 0xffffffff

// Version
const TX_VERSION = 1

// Lock time
const NO_LOCK_TIME = 0

// Standard P2PKH unlocking script length
const P2PKH_UNLOCK_LENGTH = 108
```

## Testing

```bash
# Run tests
npm test

# Run with UI
npm run test:ui

# Generate coverage
npm run test:coverage
```

## Key Files

- **Tests**: `/Users/personal/git/centbee-to-brc100/src/__tests__/transaction-signing.test.ts`
- **Guide**: `/Users/personal/git/centbee-to-brc100/TRANSACTION_API_GUIDE.md`
- **Example**: `/Users/personal/git/centbee-to-brc100/src/App.tsx` (lines 231-241)

## Resources

- **Docs**: https://bsv-blockchain.github.io/ts-sdk
- **Repo**: https://github.com/bsv-blockchain/ts-sdk
- **BRCs**: https://github.com/bitcoin-sv/BRCs

## Installation

```bash
npm install @bsv/sdk
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @types/node
```

---

**Remember**: Always use `sourceTransaction` for SPV, set `unlockingScriptTemplate` before signing, and validate with `Spend`!
