# Session 1: @bsv/sdk Transaction API Test Implementation

## Date: 2025-10-12

## Overview
Created comprehensive test suite demonstrating the correct API for creating and signing transactions with @bsv/sdk v1.8.2, based on actual usage patterns found in the codebase.

## Key Findings from Codebase Analysis

### Correct Transaction Input API
Based on analysis of `/Users/personal/git/centbee-to-brc100/src/App.tsx` (lines 231-241) and SDK test files, the correct pattern is:

1. **Create transaction with source UTXO reference**:
   ```typescript
   const tx = new Transaction(
     1, // version
     [
       {
         sourceTransaction: sourceTx,  // The full Transaction object
         sourceOutputIndex: 0,
         sequence: 0xffffffff
       }
     ],
     outputs,
     0 // lockTime
   )
   ```

2. **Set unlocking script template on input**:
   ```typescript
   tx.inputs[0].unlockingScriptTemplate = new P2PKH().unlock(privateKey)
   ```

3. **Sign transaction**:
   ```typescript
   await tx.fee()  // Calculate fees
   await tx.sign() // Generate unlocking scripts from templates
   ```

4. **Access generated unlocking script**:
   ```typescript
   const unlockingScriptHex = tx.inputs[0].unlockingScript!.toHex()
   ```

### Important Terminology (BSV Standard)
- **Locking Script**: The script that locks coins (traditionally called scriptPubKey)
- **Unlocking Script**: The script that unlocks coins (traditionally called scriptSig)
- **Unlocking Script Template**: A template that generates unlocking scripts during signing

### Key Classes Used
- `Transaction`: Main transaction class
- `PrivateKey`, `PublicKey`: Key management
- `P2PKH`: Pay-to-Public-Key-Hash script template
- `LockingScript`, `UnlockingScript`: Script containers
- `Spend`: Signature validation class

## Files Created/Modified

### 1. `/Users/personal/git/centbee-to-brc100/src/__tests__/transaction-signing.test.ts`
Comprehensive test suite with:
- Basic P2PKH transaction creation and signing
- Signature verification using `Spend` validator
- Negative test (wrong key should fail)
- Multiple patterns for adding transaction inputs
- Real-world pattern from App.tsx replication
- Full documentation of API usage

### 2. `/Users/personal/git/centbee-to-brc100/vitest.config.ts`
Vitest configuration for running tests:
- Node environment
- Global test APIs
- Coverage reporting with v8
- Test file patterns

### 3. Updated `/Users/personal/git/centbee-to-brc100/package.json`
Added test scripts:
- `npm test`: Run tests in watch mode
- `npm run test:ui`: Run tests with UI
- `npm run test:coverage`: Generate coverage reports

Added dev dependencies:
- `vitest@^3.0.0`
- `@vitest/ui@^3.0.0`
- `@vitest/coverage-v8@^3.0.0`
- `@types/node@^22.0.0`

### 4. `/Users/personal/git/centbee-to-brc100/tsconfig.test.json`
TypeScript configuration for test files:
- Extends tsconfig.app.json
- Includes vitest/globals and node types
- Targets ES2022 for BigInt support

### 5. `/Users/personal/git/centbee-to-brc100/src/__tests__/README.md`
Comprehensive documentation for test directory:
- Key concepts and examples
- API patterns and usage
- BSV terminology
- Common patterns for different scenarios

### 6. `/Users/personal/git/centbee-to-brc100/TRANSACTION_API_GUIDE.md`
Complete guide with detailed examples:
- Step-by-step transaction flow
- Multiple signing patterns
- Real-world example from App.tsx
- Error handling patterns
- Do's and Don'ts

### 7. `/Users/personal/git/centbee-to-brc100/BSV_SDK_QUICK_REFERENCE.md`
Quick reference card with:
- All common operations
- Code snippets
- Constants and types
- Commands and shortcuts

## Test Coverage

The test suite covers:

1. **Basic P2PKH Flow**:
   - Create source transaction with P2PKH output
   - Create spending transaction referencing source UTXO
   - Sign with correct private key
   - Validate signature

2. **Negative Testing**:
   - Signing with wrong private key should fail validation

3. **API Variations**:
   - Adding inputs via constructor
   - Adding inputs via `addInput()` method
   - Using `sourceTXID` vs `sourceTransaction`

4. **Real-world Pattern**:
   - Exact replication of the pattern used in App.tsx
   - Setting `unlockingScriptTemplate` on inputs
   - Using `tx.fee()` and `tx.sign()`

## How to Run Tests

```bash
# Install dependencies (including vitest)
npm install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Next Steps / Recommendations

1. **Install Dependencies**: Run `npm install` to install vitest
2. **Run Tests**: Execute `npm test` to verify all tests pass
3. **Integration**: Consider using these patterns when implementing transaction features
4. **Documentation**: Use this test file as reference documentation for the API

## SDK Version
- @bsv/sdk: ^1.8.2

## References
- SDK Repository: https://github.com/bsv-blockchain/ts-sdk
- SDK Documentation: https://bsv-blockchain.github.io/ts-sdk
- BRC Standards: https://github.com/bitcoin-sv/BRCs

## Notes
- The SDK uses BSV-standard terminology (locking/unlocking scripts)
- The `Spend` class is used for script validation
- The `sourceTransaction` approach enables SPV verification
- All async operations (signing) properly handled with await
- Tests follow SDK's own test patterns from their test suite
