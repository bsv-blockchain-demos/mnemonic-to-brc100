# Security Flow Diagram: Private Key Alignment

This document provides visual representations of how private keys are correctly mapped to transaction inputs.

---

## Flow 1: Address Discovery Phase

```
User Input
   │
   ├─→ Mnemonic: "word1 word2 ... word12"
   ├─→ PIN: "1234"
   └─→ Path Prefix: "m/44'/0/0"
       │
       ▼
┌──────────────────────────────┐
│  Generate Seed (BIP39)       │
│  seed = mnemonic + PIN       │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Derive Master Key (BIP32)   │
│  masterKey = HD.fromSeed()   │
└──────────────────────────────┘
       │
       ▼
   For index 0, 1, 2, ...
       │
       ▼
┌──────────────────────────────┐
│  Derive Child Key            │
│  path = "m/44'/0/0/0"        │
│  childKey = derive(path)     │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Generate Address            │
│  privKey → pubKey → address  │
│  Address: 1ABC...            │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Check WhatsOnChain API      │
│  Has this address been used? │
└──────────────────────────────┘
       │
       ▼ (if has UTXOs)
┌──────────────────────────────┐
│  Store Result                │
│  {                           │
│    index: 0,                 │
│    address: "1ABC...",       │
│    pathPrefix: "m/44'/0/0",  │◀─── ✅ PATH STORED
│    utxos: [{                 │
│      tx_hash: "abc123",      │
│      tx_pos: 0,              │
│      value: 5000             │
│    }]                        │
│  }                           │
└──────────────────────────────┘
       │
       ▼
   Results Array
   (displayed to user)
```

---

## Flow 2: Transaction Creation Phase

```
User Clicks "Sweep Into My Local Wallet"
       │
       ▼
┌──────────────────────────────┐
│  Re-Generate Seed (BIP39)    │
│  seed = mnemonic + PIN       │
│  (SAME as discovery phase)   │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Derive Master Key (BIP32)   │
│  masterKey = HD.fromSeed()   │
│  (SAME as discovery phase)   │
└──────────────────────────────┘
       │
       ▼
   For Each Result
       │
       ▼
┌──────────────────────────────┐
│  Read Stored Path & Index    │
│  pathPrefix = res.pathPrefix │◀─── ✅ READ STORED VALUE
│  index = res.index           │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Derive Child Key            │
│  path = pathPrefix + index   │
│  childKey = derive(path)     │
│  privKey = childKey.privKey  │
└──────────────────────────────┘
       │
       ▼
   For Each UTXO in Result
       │
       ▼
┌──────────────────────────────┐
│  Map UTXO to Private Key     │
│  utxosByTxid[txid].push({    │
│    vout: utxo.tx_pos,        │
│    privKey: privKey,         │◀─── ✅ CORRECT KEY MAPPED
│    value: utxo.value         │
│  })                          │
└──────────────────────────────┘
       │
       ▼
   utxosByTxid Structure
   {
     "abc123": [
       { vout: 0, privKey: key0 },
       { vout: 1, privKey: key0 }
     ],
     "def456": [
       { vout: 0, privKey: key1 }
     ]
   }
```

---

## Flow 3: Transaction Signing Phase

```
Create Transaction via Wallet
       │
       ▼
┌──────────────────────────────┐
│  Transaction Object          │
│  tx.inputs = [               │
│    { sourceTx: "abc123",     │
│      sourceOutputIndex: 0 }, │
│    { sourceTx: "abc123",     │
│      sourceOutputIndex: 1 }, │
│    { sourceTx: "def456",     │
│      sourceOutputIndex: 0 }  │
│  ]                           │
└──────────────────────────────┘
       │
       ▼
   For Each Input
       │
       ▼
┌──────────────────────────────┐
│  Get Input Details           │
│  txid = input.sourceTx       │
│  vout = input.sourceOutIdx   │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Two-Factor Lookup           │
│  privKey = utxosByTxid[txid] │
│    .find(u => u.vout == vout)│◀─── ✅ EXACT MATCH
│    ?.privKey                 │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Verify Key Found            │
│  if (!privKey)               │
│    throw Error               │◀─── ✅ FAIL-SAFE
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Set Unlocking Template      │
│  input.unlockingTemplate =   │
│    new P2PKH().unlock(key)   │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Sign Transaction            │
│  await tx.fee()              │
│  await tx.sign()             │
└──────────────────────────────┘
       │
       ▼
   Valid Signed Transaction
   (all inputs have correct signatures)
```

---

## Data Structure Diagram

### utxosByTxid Structure

```
utxosByTxid: {

  "abc123": [                    ← Transaction ID
    {
      vout: 0,                   ← Output Index
      privKey: PrivKey(0x01ec), ← Private Key for this UTXO
      value: 5000                ← Satoshi Value
    },
    {
      vout: 1,                   ← Different output, SAME key
      privKey: PrivKey(0x01ec), ← (same address/derivation)
      value: 3000
    }
  ],

  "def456": [                    ← Different Transaction
    {
      vout: 0,                   ← Output Index
      privKey: PrivKey(0xa39c), ← DIFFERENT Private Key
      value: 2000                ← (different address/derivation)
    }
  ]

}
```

### Lookup Logic

```
Input to Sign:
  sourceTx: "abc123"
  sourceOutputIndex: 1

Step 1: Get array for txid
  utxosByTxid["abc123"]
  → [{ vout: 0, privKey: key0 }, { vout: 1, privKey: key0 }]

Step 2: Find matching vout
  .find(utxo => utxo.vout === 1)
  → { vout: 1, privKey: key0, value: 3000 }

Step 3: Extract private key
  ?.privKey
  → PrivKey(0x01ec...)

✅ Result: Correct private key for UTXO at abc123:1
```

---

## Security Verification Matrix

| Input | Expected Address | Derived Key | Key Used | Match? |
|-------|------------------|-------------|----------|--------|
| abc123:0 | 18kkyvNXf... | key0 (m/44'/0/0/0) | key0 | ✅ YES |
| abc123:1 | 18kkyvNXf... | key0 (m/44'/0/0/0) | key0 | ✅ YES |
| def456:0 | 1D9SF86ia... | key1 (m/44'/0/0/1) | key1 | ✅ YES |

### What if keys were swapped? (Attack Scenario)

| Input | Expected Address | Derived Key | **Wrong** Key Used | Match? |
|-------|------------------|-------------|--------------------|--------|
| abc123:0 | 18kkyvNXf... | key0 | **key1** ❌ | ❌ NO |
| abc123:1 | 18kkyvNXf... | key0 | **key1** ❌ | ❌ NO |
| def456:0 | 1D9SF86ia... | key1 | **key0** ❌ | ❌ NO |

**Result:** Transaction signature verification FAILS (proven by Test 3)

```
Error: OP_EQUALVERIFY requires the top two stack items to be equal.
```

This proves the Bitcoin Script execution correctly rejects invalid signatures.

---

## Path Prefix Preservation

### Scenario: User Scans with Different Path Prefixes

```
Scan 1: Path = "m/44'/0/0"
  Index 0 → Address A1
  UTXO: abc123:0

  Stored Result:
    pathPrefix: "m/44'/0/0"  ◀─── ✅ STORED
    index: 0
    utxos: [abc123:0]

User changes path prefix to "m/0'/0" and scans again

Scan 2: Path = "m/0'/0"
  Index 0 → Address B1 (different!)
  UTXO: def456:0

  Stored Result:
    pathPrefix: "m/0'/0"     ◀─── ✅ STORED (different)
    index: 0
    utxos: [def456:0]

Results Array:
  [
    { pathPrefix: "m/44'/0/0", index: 0, utxos: [abc123:0] },
    { pathPrefix: "m/0'/0",    index: 0, utxos: [def456:0] }
  ]
```

### Transaction Creation Reads Correct Path

```
For Result 1:
  pathPrefix = "m/44'/0/0"   ◀─── Read from Result 1
  index = 0
  path = "m/44'/0/0/0"
  privKey = derive(path)     ◀─── Correct key for Address A1

For Result 2:
  pathPrefix = "m/0'/0"      ◀─── Read from Result 2
  index = 0
  path = "m/0'/0/0"
  privKey = derive(path)     ◀─── Correct key for Address B1
```

**✅ Each UTXO gets the correct private key for its original derivation path.**

---

## Key Security Property

### The Two-Factor Lock

```
Private Key Lookup Requires TWO Things to Match:

1. Transaction ID (txid)
   ├─→ Identifies the source transaction
   └─→ Many inputs might reference different outputs of the same tx

2. Output Index (vout)
   ├─→ Identifies which output within the transaction
   └─→ Different outputs might belong to different addresses

Only when BOTH match is the private key retrieved.
```

### Example: Why Two-Factor Matters

```
Transaction "abc123" has 3 outputs:
  Output 0: locked to Address A (needs key A)
  Output 1: locked to Address A (needs key A)
  Output 2: locked to Address B (needs key B)

If we only matched on txid:
  Input for abc123:0 → might get key B ❌ WRONG
  Input for abc123:1 → might get key B ❌ WRONG
  Input for abc123:2 → might get key A ❌ WRONG

With txid + vout matching:
  Input for abc123:0 → gets key A ✅ CORRECT
  Input for abc123:1 → gets key A ✅ CORRECT
  Input for abc123:2 → gets key B ✅ CORRECT
```

---

## Summary: Why This Code is Secure

1. **Path Prefix Preservation**
   - ✅ Stored during discovery
   - ✅ Read during transaction creation
   - ✅ Not affected by UI state changes

2. **Deterministic Key Derivation**
   - ✅ Same seed → same master key → same child keys
   - ✅ Proven by tests to be consistent

3. **Two-Factor UTXO Matching**
   - ✅ Must match BOTH txid AND vout
   - ✅ Prevents key swap attacks

4. **Cryptographic Validation**
   - ✅ Wrong keys fail signature verification
   - ✅ Enforced by Bitcoin Script execution
   - ✅ Proven by negative tests

5. **Defensive Programming**
   - ✅ Throws error if key not found
   - ✅ Validates fees before broadcast
   - ✅ Checks wallet authentication

**Result: Private keys are ALWAYS correctly aligned with their inputs.**

---

## Test Evidence

Run these tests to verify:

```bash
# Test 1-8: Key derivation and mapping
npx tsx test-key-alignment.ts

# Test signature validation (including wrong key rejection)
npx tsx test-signature-validation.ts
```

All tests pass with 100% success rate.

---

**Diagram Created:** 2025-10-12
**Based on Security Review:** [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
