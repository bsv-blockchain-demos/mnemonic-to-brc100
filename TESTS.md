# @bsv/sdk Transaction API Tests

This directory contains comprehensive tests demonstrating the correct API usage for the @bsv/sdk library.

## Test Files

### `transaction-signing.test.ts`
Demonstrates how to properly create, sign, and verify BSV transactions using the @bsv/sdk.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Key Concepts Demonstrated

### 1. Creating a Source Transaction (UTXO)

```typescript
import { Transaction, PrivateKey, P2PKH } from '@bsv/sdk'

const privateKey = PrivateKey.fromRandom()
const publicKey = privateKey.toPublicKey()
const publicKeyHash = publicKey.toHash()
const p2pkh = new P2PKH()
const lockingScript = p2pkh.lock(publicKeyHash)

const sourceTx = new Transaction(
  1, // version
  [], // inputs (empty for funding tx)
  [
    {
      lockingScript,
      satoshis: 5000
    }
  ],
  0 // lockTime
)
```

### 2. Creating a Spending Transaction

```typescript
const spendTx = new Transaction(
  1, // version
  [
    {
      sourceTransaction: sourceTx,  // Reference the source transaction
      sourceOutputIndex: 0,          // Which output to spend
      sequence: 0xffffffff
    }
  ],
  [
    {
      lockingScript: p2pkh.lock(publicKeyHash),
      satoshis: 4500 // 500 sats for fee
    }
  ],
  0 // lockTime
)
```

### 3. Signing the Transaction

**Method 1: Using the template directly**
```typescript
const unlockingTemplate = p2pkh.unlock(privateKey)
const unlockingScript = await unlockingTemplate.sign(spendTx, 0)
```

**Method 2: Setting template on input (App.tsx pattern)**
```typescript
spendTx.inputs[0].unlockingScriptTemplate = p2pkh.unlock(privateKey)
await spendTx.fee()  // Calculate fees
await spendTx.sign() // Generate unlocking scripts
```

### 4. Verifying the Signature

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

const isValid = spend.validate() // Returns true if signature is valid
```

## Important API Details

### Transaction Constructor
```typescript
new Transaction(
  version: number,
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  lockTime: number
)
```

### TransactionInput Structure
```typescript
{
  sourceTransaction?: Transaction,  // Preferred: Full transaction object for SPV
  sourceTXID?: string,              // Alternative: Just the TXID
  sourceOutputIndex: number,
  unlockingScript?: UnlockingScript,
  unlockingScriptTemplate?: UnlockingScriptTemplate,
  sequence: number
}
```

### TransactionOutput Structure
```typescript
{
  lockingScript: LockingScript,
  satoshis: number,
  change?: boolean  // Optional: marks as change output
}
```

## BSV Terminology

The SDK uses correct BSV terminology:

- **Locking Script**: Script that locks coins (not "scriptPubKey")
- **Unlocking Script**: Script that unlocks coins (not "scriptSig")
- **Unlocking Script Template**: Template that generates unlocking scripts during signing

## Common Patterns

### Pattern 1: Sign Individual Input
```typescript
const unlockingTemplate = p2pkh.unlock(privateKey)
const unlockingScript = await unlockingTemplate.sign(tx, inputIndex)
```

### Pattern 2: Set Template and Sign All (from App.tsx)
```typescript
tx.inputs.forEach(input => {
  input.unlockingScriptTemplate = new P2PKH().unlock(privateKey)
})
await tx.fee()
await tx.sign()
```

### Pattern 3: Multiple Inputs with Different Keys
```typescript
const privKeyMap = { [txid1]: privKey1, [txid2]: privKey2 }

tx.inputs.forEach(input => {
  const txid = input.sourceTransaction!.id('hex')
  const privKey = privKeyMap[txid]
  input.unlockingScriptTemplate = new P2PKH().unlock(privKey)
})

await tx.sign()
```

## Script Templates

### P2PKH (Pay-to-Public-Key-Hash)
```typescript
const p2pkh = new P2PKH()

// Create locking script
const lockingScript = p2pkh.lock(publicKeyHash)
// OR
const lockingScript = p2pkh.lock(address)

// Create unlocking script template
const unlockingTemplate = p2pkh.unlock(
  privateKey,
  'all',     // signOutputs: 'all' | 'none' | 'single'
  false,     // anyoneCanPay
  satoshis,  // sourceSatoshis (optional)
  lockingScript // (optional)
)
```

## Error Handling

Always handle async operations properly:

```typescript
try {
  await tx.sign()
  const isValid = spend.validate()
  if (!isValid) {
    throw new Error('Invalid signature')
  }
} catch (error) {
  console.error('Transaction signing failed:', error)
}
```

## References

- [SDK Documentation](https://bsv-blockchain.github.io/ts-sdk)
- [SDK Repository](https://github.com/bsv-blockchain/ts-sdk)
- [BRC Standards](https://github.com/bitcoin-sv/BRCs)
- [BRC-42: Key Derivation](https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md)
- [BRC-62: BEEF Format](https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0062.md)

## Contributing

When adding new tests:
1. Follow the existing patterns
2. Use descriptive test names
3. Include both positive and negative test cases
4. Add comments explaining complex operations
5. Use proper BSV terminology
