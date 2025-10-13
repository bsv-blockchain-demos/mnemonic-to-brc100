/**
 * Test suite for @bsv/sdk transaction creation and signing
 *
 * This test demonstrates the correct API for:
 * 1. Creating a source transaction with a P2PKH output
 * 2. Creating a spending transaction that references the source UTXO
 * 3. Signing the spending transaction with P2PKH unlock script
 * 4. Verifying the signature using the Spend validator
 */

import { webcrypto } from 'node:crypto'
import {
  Transaction,
  PrivateKey,
  P2PKH,
  UnlockingScript,
  Spend
} from '@bsv/sdk'

// Setup crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - Adding crypto to globalThis
  globalThis.crypto = webcrypto
}

// Use fixed test keys instead of random to avoid crypto issues
const TEST_PRIVATE_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_HEX_2 = '0000000000000000000000000000000000000000000000000000000000000002'
const TEST_PRIVATE_KEY_HEX_3 = '0000000000000000000000000000000000000000000000000000000000000003'

/**
 * Test 1: Create, sign, and verify a P2PKH transaction
 */
async function testBasicP2PKHTransaction() {
  console.log('\n=== Test 1: Basic P2PKH Transaction ===');

  // 1. Create a private key and derive the P2PKH locking script
  const privateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX, 'hex')
  const publicKey = privateKey.toPublicKey()
  const publicKeyHash = publicKey.toHash()
  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(publicKeyHash)
  const satoshis = 5000

  // 2. Create a source transaction (UTXO) with a P2PKH output
  const sourceTx = new Transaction(
    1, // version
    [], // inputs (coinbase/funding transaction has no inputs in this example)
    [
      {
        lockingScript,
        satoshis
      }
    ],
    0 // lockTime
  )

  console.log('Source transaction created');
  console.log('  TxID:', sourceTx.id('hex'));
  console.log('  Outputs:', sourceTx.outputs.length);
  console.log('  Satoshis:', sourceTx.outputs[0].satoshis);

  // 3. Create the unlocking script template
  const unlockingTemplate = p2pkh.unlock(privateKey)

  // 4. Create a spending transaction that references the source UTXO
  const spendTx = new Transaction(
    1, // version
    [
      {
        sourceTransaction: sourceTx,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      }
    ],
    [
      {
        lockingScript: p2pkh.lock(publicKeyHash), // send back to same address
        satoshis: 4500 // 500 sats for fee
      }
    ],
    0 // lockTime
  )

  // 5. Sign the transaction by generating the unlocking script
  const unlockingScript = await unlockingTemplate.sign(spendTx, 0)

  console.log('Unlocking script generated');
  console.log('  Length:', unlockingScript.toBinary().length);

  // 6. Verify the signature using the Spend validator
  const spend = new Spend({
    sourceTXID: sourceTx.id('hex'),
    sourceOutputIndex: 0,
    sourceSatoshis: satoshis,
    lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    inputIndex: 0,
    unlockingScript,
    outputs: spendTx.outputs,
    inputSequence: 0xffffffff,
    lockTime: 0
  })

  const isValid = spend.validate()

  if (isValid) {
    console.log('✓ PASS: Transaction signature is VALID');
    return true;
  } else {
    console.log('✗ FAIL: Transaction signature is INVALID');
    return false;
  }
}

/**
 * Test 2: Verify that wrong private key fails validation
 */
async function testWrongPrivateKeyFails() {
  console.log('\n=== Test 2: Wrong Private Key Should Fail ===');

  // 1. Create correct and wrong private keys
  const correctPrivateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX, 'hex')
  const wrongPrivateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX_2, 'hex')

  const publicKey = correctPrivateKey.toPublicKey()
  const publicKeyHash = publicKey.toHash()
  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(publicKeyHash)
  const satoshis = 5000

  // 2. Create source transaction locked to correct public key
  const sourceTx = new Transaction(
    1,
    [],
    [
      {
        lockingScript,
        satoshis
      }
    ],
    0
  )

  console.log('Source transaction locked to correct key');

  // 3. Try to unlock with WRONG private key
  const wrongUnlockingTemplate = p2pkh.unlock(wrongPrivateKey)

  // 4. Create spending transaction
  const spendTx = new Transaction(
    1,
    [
      {
        sourceTransaction: sourceTx,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      }
    ],
    [
      {
        lockingScript: p2pkh.lock(publicKeyHash),
        satoshis: 4500
      }
    ],
    0
  )

  // 5. Sign with wrong key
  const wrongUnlockingScript = await wrongUnlockingTemplate.sign(spendTx, 0)

  console.log('Attempting to spend with WRONG key...');

  // 6. Validation should FAIL
  const spend = new Spend({
    sourceTXID: sourceTx.id('hex'),
    sourceOutputIndex: 0,
    sourceSatoshis: satoshis,
    lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    inputIndex: 0,
    unlockingScript: wrongUnlockingScript,
    outputs: spendTx.outputs,
    inputSequence: 0xffffffff,
    lockTime: 0
  })

  try {
    const isValid = spend.validate()

    if (!isValid) {
      console.log('✓ PASS: Wrong key correctly FAILED validation');
      return true;
    } else {
      console.log('✗ FAIL: Wrong key should have failed but passed');
      return false;
    }
  } catch (error) {
    // Exception thrown means validation failed (which is what we want)
    console.log('✓ PASS: Wrong key correctly FAILED validation (exception thrown)');
    return true;
  }
}

/**
 * Test 3: Different ways to add inputs to transactions
 */
async function testInputAdditionMethods() {
  console.log('\n=== Test 3: Different Input Addition Methods ===');

  const privateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX, 'hex')
  const publicKey = privateKey.toPublicKey()
  const publicKeyHash = publicKey.toHash()
  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(publicKeyHash)

  // Create a source transaction
  const sourceTx = new Transaction(
    1,
    [],
    [
      {
        lockingScript,
        satoshis: 10000
      }
    ],
    0
  )

  console.log('Testing input addition methods...');

  // Method 1: Add input in constructor
  const tx1 = new Transaction(
    1,
    [
      {
        sourceTransaction: sourceTx,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      }
    ],
    [],
    0
  )

  const method1Pass = tx1.inputs.length === 1 &&
                      tx1.inputs[0].sourceTransaction?.id('hex') === sourceTx.id('hex') &&
                      tx1.inputs[0].sourceOutputIndex === 0;

  console.log(`  Method 1 (Constructor): ${method1Pass ? '✓' : '✗'}`);

  // Method 2: Use addInput() method
  const tx2 = new Transaction()
  tx2.addInput({
    sourceTransaction: sourceTx,
    sourceOutputIndex: 0,
    sequence: 0xffffffff
  })

  const method2Pass = tx2.inputs.length === 1 &&
                      tx2.inputs[0].sourceTransaction?.id('hex') === sourceTx.id('hex');

  console.log(`  Method 2 (addInput): ${method2Pass ? '✓' : '✗'}`);

  // Method 3: Add input using sourceTXID
  const tx3 = new Transaction()
  tx3.addInput({
    sourceTXID: sourceTx.id('hex'),
    sourceOutputIndex: 0,
    unlockingScript: new UnlockingScript(),
    sequence: 0xffffffff
  })

  const method3Pass = tx3.inputs.length === 1 &&
                      tx3.inputs[0].sourceTXID === sourceTx.id('hex');

  console.log(`  Method 3 (sourceTXID): ${method3Pass ? '✓' : '✗'}`);

  if (method1Pass && method2Pass && method3Pass) {
    console.log('✓ PASS: All input addition methods work correctly');
    return true;
  } else {
    console.log('✗ FAIL: Some methods failed');
    return false;
  }
}

/**
 * Test 4: Proper usage with unlockingScriptTemplate
 */
async function testUnlockingScriptTemplate() {
  console.log('\n=== Test 4: Unlocking Script Template ===');

  const privateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX_3, 'hex')
  const publicKey = privateKey.toPublicKey()
  const publicKeyHash = publicKey.toHash()
  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(publicKeyHash)
  const satoshis = 10000

  // Create source transaction
  const sourceTx = new Transaction(
    1,
    [],
    [
      {
        lockingScript,
        satoshis
      }
    ],
    0
  )

  // Create spending transaction
  const spendTx = new Transaction(
    1,
    [
      {
        sourceTransaction: sourceTx,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      }
    ],
    [
      {
        lockingScript: p2pkh.lock(publicKeyHash),
        satoshis: 9500
      }
    ],
    0
  )

  // Set unlocking script template on the input
  spendTx.inputs[0].unlockingScriptTemplate = p2pkh.unlock(privateKey)

  console.log('Set unlocking script template on input');

  // Sign the transaction - this uses the template to generate unlocking scripts
  await spendTx.sign()

  console.log('Transaction signed');

  // Verify the unlocking script was generated
  const hasUnlockingScript = spendTx.inputs[0].unlockingScript !== undefined &&
                             spendTx.inputs[0].unlockingScript.toBinary().length > 0;

  console.log('  Unlocking script generated:', hasUnlockingScript);

  // Validate the spend
  const spend = new Spend({
    sourceTXID: sourceTx.id('hex'),
    sourceOutputIndex: 0,
    sourceSatoshis: satoshis,
    lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    inputIndex: 0,
    unlockingScript: spendTx.inputs[0].unlockingScript!,
    outputs: spendTx.outputs,
    inputSequence: 0xffffffff,
    lockTime: 0
  })

  const isValid = spend.validate()

  if (hasUnlockingScript && isValid) {
    console.log('✓ PASS: Unlocking script template works correctly');
    return true;
  } else {
    console.log('✗ FAIL: Unlocking script template issue');
    return false;
  }
}

/**
 * Test 5: Replicate the pattern from App.tsx
 */
async function testRealWorldPattern() {
  console.log('\n=== Test 5: Real-world Pattern from App.tsx ===');

  // This test replicates the pattern from App.tsx lines 231-241
  const privateKey = PrivateKey.fromString(TEST_PRIVATE_KEY_HEX, 'hex')
  const publicKey = privateKey.toPublicKey()
  const publicKeyHash = publicKey.toHash()
  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(publicKeyHash)

  // Create source UTXO
  const sourceTransaction = new Transaction(
    1,
    [],
    [
      {
        lockingScript,
        satoshis: 50000
      }
    ],
    0
  )

  console.log('Replicating App.tsx transaction pattern...');

  // Create spending transaction (mimicking the wallet's output structure)
  const tx = new Transaction(
    1,
    [
      {
        sourceTransaction,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      }
    ],
    [
      {
        lockingScript: p2pkh.lock(publicKeyHash),
        satoshis: 49500
      }
    ],
    0
  )

  // Apply the pattern from App.tsx: set unlockingScriptTemplate on each input
  tx.inputs.forEach(input => {
    const txid = input.sourceTransaction!.id('hex')
    console.log('  Processing input for txid:', txid.substring(0, 16) + '...');
    // In real app, this finds the correct privKey from a map
    // Here we just use our test private key
    input.unlockingScriptTemplate = new P2PKH().unlock(privateKey)
  })

  // Sign the transaction (calculates fees if needed, then signs)
  await tx.fee()
  await tx.sign()

  console.log('Transaction signed with fee:', tx.getFee());

  // Verify each input has an unlocking script
  let allInputsSigned = true;
  tx.inputs.forEach((input, idx) => {
    const hasSig = input.unlockingScript !== undefined && input.unlockingScript.toHex().length > 0;
    console.log(`  Input ${idx} signed: ${hasSig}`);
    if (!hasSig) allInputsSigned = false;
  })

  // Validate the signature
  const spend = new Spend({
    sourceTXID: sourceTransaction.id('hex'),
    sourceOutputIndex: 0,
    sourceSatoshis: 50000,
    lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    inputIndex: 0,
    unlockingScript: tx.inputs[0].unlockingScript!,
    outputs: tx.outputs,
    inputSequence: 0xffffffff,
    lockTime: 0
  })

  const isValid = spend.validate()

  if (allInputsSigned && isValid) {
    console.log('✓ PASS: Real-world pattern works correctly');
    return true;
  } else {
    console.log('✗ FAIL: Real-world pattern issue');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('TRANSACTION SIGNING TEST SUITE');
  console.log('='.repeat(70));

  const results = [
    await testBasicP2PKHTransaction(),
    await testWrongPrivateKeyFails(),
    await testInputAdditionMethods(),
    await testUnlockingScriptTemplate(),
    await testRealWorldPattern(),
  ];

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passed}/${total} tests passed`);
  console.log('='.repeat(70));

  if (passed === total) {
    console.log('✓ ALL TRANSACTION SIGNING TESTS PASSED');
  } else {
    console.log('✗ SOME TESTS FAILED');
  }
}

runAllTests();
