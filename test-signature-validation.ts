/**
 * Security Test: Transaction Signature Validation
 *
 * This test creates actual transactions and verifies that signatures
 * are valid for the inputs they claim to spend.
 */

import {
  Mnemonic,
  HD,
  PrivateKey,
  PublicKey,
  P2PKH,
  Transaction,
  Utils,
  Script,
  TransactionInput,
  TransactionOutput,
  SatoshisPerKilobyte
} from '@bsv/sdk';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PIN = '';

/**
 * Test 1: Create and validate a simple P2PKH transaction
 */
async function testSimpleP2PKHTransaction() {
  console.log('\n=== Test 1: Simple P2PKH Transaction Signature ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Derive key for index 0
  const childKey = masterKey.derive("m/44'/0/0/0");
  const privKey = childKey.privKey as PrivateKey;
  const pubKey = privKey.toPublicKey() as PublicKey;
  const address = pubKey.toAddress().toString();

  console.log('Address:', address);
  console.log('PrivKey:', privKey.toHex());

  // Create a dummy source transaction (simulating a UTXO we want to spend)
  const sourceTx = new Transaction();
  sourceTx.addOutput({
    satoshis: 10000,
    lockingScript: new P2PKH().lock(address)
  });

  console.log('\nSource Transaction:');
  console.log('  TxID:', sourceTx.id('hex'));
  console.log('  Output 0 value:', sourceTx.outputs[0].satoshis);
  console.log('  Output 0 script:', sourceTx.outputs[0].lockingScript.toHex());

  // Create spending transaction
  const spendingTx = new Transaction();

  // Add input referencing the source transaction
  const input = {
    sourceTransaction: sourceTx,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privKey),
    sequence: 0xffffffff
  } as TransactionInput;

  spendingTx.inputs.push(input);

  // Add output (send to same address for simplicity)
  spendingTx.addOutput({
    satoshis: 9000, // Leave 1000 sats for fee
    lockingScript: new P2PKH().lock(address)
  });

  console.log('\nSpending Transaction (before signing):');
  console.log('  Input 0 sourceOutputIndex:', spendingTx.inputs[0].sourceOutputIndex);
  console.log('  Input 0 sourceTxID:', spendingTx.inputs[0].sourceTransaction?.id('hex'));

  // Sign the transaction
  await spendingTx.fee(new SatoshisPerKilobyte(10));
  await spendingTx.sign();

  console.log('\nSpending Transaction (after signing):');
  console.log('  TxID:', spendingTx.id('hex'));
  console.log('  Input 0 unlocking script:', spendingTx.inputs[0].unlockingScript?.toHex());
  console.log('  Fee:', spendingTx.getFee(), 'satoshis');

  // Verify the signature
  try {
    await spendingTx.verify();
    console.log('\n✓ PASS: Transaction signature is VALID');
    return true;
  } catch (e) {
    console.log('\n✗ FAIL: Transaction signature is INVALID');
    console.error(e);
    return false;
  }
}

/**
 * Test 2: Multi-input transaction with correct key mapping
 */
async function testMultiInputTransaction() {
  console.log('\n=== Test 2: Multi-Input Transaction (Correct Keys) ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Derive two different keys
  const childKey0 = masterKey.derive("m/44'/0/0/0");
  const privKey0 = childKey0.privKey as PrivateKey;
  const pubKey0 = privKey0.toPublicKey() as PublicKey;
  const address0 = pubKey0.toAddress().toString();

  const childKey1 = masterKey.derive("m/44'/0/0/1");
  const privKey1 = childKey1.privKey as PrivateKey;
  const pubKey1 = privKey1.toPublicKey() as PublicKey;
  const address1 = pubKey1.toAddress().toString();

  console.log('Address 0:', address0);
  console.log('Address 1:', address1);

  // Create two source transactions
  const sourceTx0 = new Transaction();
  sourceTx0.addOutput({
    satoshis: 5000,
    lockingScript: new P2PKH().lock(address0)
  });

  const sourceTx1 = new Transaction();
  sourceTx1.addOutput({
    satoshis: 3000,
    lockingScript: new P2PKH().lock(address1)
  });

  console.log('\nSource Transactions:');
  console.log('  Tx0:', sourceTx0.id('hex').substring(0, 16) + '...');
  console.log('  Tx1:', sourceTx1.id('hex').substring(0, 16) + '...');

  // Create spending transaction with 2 inputs
  const spendingTx = new Transaction();

  // Add input 0 (should use privKey0)
  spendingTx.inputs.push({
    sourceTransaction: sourceTx0,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privKey0),
    sequence: 0xffffffff
  } as TransactionInput);

  // Add input 1 (should use privKey1)
  spendingTx.inputs.push({
    sourceTransaction: sourceTx1,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privKey1),
    sequence: 0xffffffff
  } as TransactionInput);

  // Add output
  spendingTx.addOutput({
    satoshis: 7000, // 5000 + 3000 - 1000 fee
    lockingScript: new P2PKH().lock(address0)
  });

  console.log('\nSigning transaction with correct keys...');
  await spendingTx.fee(new SatoshisPerKilobyte(10));
  await spendingTx.sign();

  console.log('Transaction signed, fee:', spendingTx.getFee());

  // Verify
  try {
    await spendingTx.verify();
    console.log('\n✓ PASS: Multi-input transaction with correct keys is VALID');
    return true;
  } catch (e) {
    console.log('\n✗ FAIL: Multi-input transaction signature is INVALID');
    console.error(e);
    return false;
  }
}

/**
 * Test 3: Multi-input transaction with WRONG key mapping (should fail)
 */
async function testMultiInputTransactionWrongKeys() {
  console.log('\n=== Test 3: Multi-Input Transaction (Wrong Keys - Should FAIL) ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Derive two different keys
  const childKey0 = masterKey.derive("m/44'/0/0/0");
  const privKey0 = childKey0.privKey as PrivateKey;
  const pubKey0 = privKey0.toPublicKey() as PublicKey;
  const address0 = pubKey0.toAddress().toString();

  const childKey1 = masterKey.derive("m/44'/0/0/1");
  const privKey1 = childKey1.privKey as PrivateKey;
  const pubKey1 = privKey1.toPublicKey() as PublicKey;
  const address1 = pubKey1.toAddress().toString();

  // Create two source transactions
  const sourceTx0 = new Transaction();
  sourceTx0.addOutput({
    satoshis: 5000,
    lockingScript: new P2PKH().lock(address0)  // Locked to address0
  });

  const sourceTx1 = new Transaction();
  sourceTx1.addOutput({
    satoshis: 3000,
    lockingScript: new P2PKH().lock(address1)  // Locked to address1
  });

  // Create spending transaction with SWAPPED keys (WRONG!)
  const spendingTx = new Transaction();

  // Add input 0 - using WRONG key (privKey1 instead of privKey0)
  spendingTx.inputs.push({
    sourceTransaction: sourceTx0,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privKey1), // WRONG KEY!
    sequence: 0xffffffff
  } as TransactionInput);

  // Add input 1 - using WRONG key (privKey0 instead of privKey1)
  spendingTx.inputs.push({
    sourceTransaction: sourceTx1,
    sourceOutputIndex: 0,
    unlockingScriptTemplate: new P2PKH().unlock(privKey0), // WRONG KEY!
    sequence: 0xffffffff
  } as TransactionInput);

  // Add output
  spendingTx.addOutput({
    satoshis: 7000,
    lockingScript: new P2PKH().lock(address0)
  });

  console.log('\nAttempting to sign transaction with WRONG keys...');
  console.log('  Input 0: address0 output, but using privKey1 (WRONG)');
  console.log('  Input 1: address1 output, but using privKey0 (WRONG)');

  try {
    await spendingTx.fee(new SatoshisPerKilobyte(10));
    await spendingTx.sign();

    // Try to verify - this should fail
    await spendingTx.verify();
    console.log('\n✗ FAIL: Transaction with wrong keys should NOT be valid, but it passed!');
    return false;
  } catch (e) {
    console.log('\n✓ PASS: Transaction with wrong keys correctly FAILED verification');
    console.log('  Error:', (e as Error).message);
    return true;
  }
}

/**
 * Test 4: Simulate the actual createIngestTx flow
 */
async function testActualIngestTxFlow() {
  console.log('\n=== Test 4: Simulating Actual createIngestTx Flow ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Simulate results from address discovery with mixed paths
  const mockResults = [
    {
      index: 0,
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'txid1', tx_pos: 0, value: 5000 },
          { tx_hash: 'txid1', tx_pos: 1, value: 3000 },
        ]
      }
    },
    {
      index: 1,
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'txid2', tx_pos: 0, value: 2000 },
        ]
      }
    },
  ];

  // Build utxosByTxid structure (from lines 172-185)
  const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {};

  mockResults.forEach(res => {
    const fullPath = `${res.pathPrefix}/${res.index}`.replace(/'/g, "'");
    const childKey = masterKey.derive(fullPath);
    const privKey = childKey.privKey as PrivateKey;

    res.utxos.result.forEach((utxo) => {
      const txid = utxo.tx_hash;
      if (!utxosByTxid[txid]) {
        utxosByTxid[txid] = [];
      }
      utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value });
    });
  });

  console.log('utxosByTxid structure:');
  for (const [txid, list] of Object.entries(utxosByTxid)) {
    console.log(`  ${txid}:`);
    list.forEach(u => console.log(`    vout ${u.vout}: privKey ${u.privKey.toHex().substring(0, 16)}...`));
  }

  // Create source transactions
  const sourceTxs: { [key: string]: Transaction } = {};

  for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
    const tx = new Transaction();
    utxoList.forEach(utxo => {
      const pubKey = utxo.privKey.toPublicKey() as PublicKey;
      const address = pubKey.toAddress().toString();

      // Ensure the transaction has enough outputs
      while (tx.outputs.length <= utxo.vout) {
        tx.addOutput({
          satoshis: 1, // Dummy output
          lockingScript: new P2PKH().lock('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
        });
      }

      // Set the actual output at the correct vout
      tx.outputs[utxo.vout] = {
        satoshis: utxo.value,
        lockingScript: new P2PKH().lock(address)
      } as TransactionOutput;

    // Set a dummy txid for testing
    sourceTxs[txid] = tx;
    });
  }

  // Create spending transaction
  const spendingTx = new Transaction();

  // Add inputs based on the structure
  for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
    const sourceTx = sourceTxs[txid];

    utxoList.forEach(utxo => {
      spendingTx.inputs.push({
        sourceTransaction: sourceTx,
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new P2PKH().unlock(utxo.privKey),
        sequence: 0xffffffff
      } as TransactionInput);
    });
  }

  console.log(`\nCreated transaction with ${spendingTx.inputs.length} inputs`);

  // Add output
  const totalInput = Object.values(utxosByTxid)
    .flat()
    .reduce((sum, utxo) => sum + utxo.value, 0);

  spendingTx.addOutput({
    satoshis: totalInput - 100, // Leave 100 for fee
    lockingScript: new P2PKH().lock('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
  });

  // Now simulate the signing loop from lines 231-238
  console.log('\nSimulating signing loop:');
  spendingTx.inputs.forEach((input, idx) => {
    const txid = input.sourceTransaction!.id('hex');
    const privKey = utxosByTxid[txid].find(utxo => utxo.vout === input.sourceOutputIndex)?.privKey;

    if (!privKey) {
      throw new Error(`Failed to find private key for input ${idx}: ${txid}.${input.sourceOutputIndex}`);
    }

    console.log(`  Input ${idx}: ${txid.substring(0, 8)}...${input.sourceOutputIndex} -> privKey ${privKey.toHex().substring(0, 16)}...`);
    input.unlockingScriptTemplate = new P2PKH().unlock(privKey);
  });

  await spendingTx.fee(new SatoshisPerKilobyte(10));
  await spendingTx.sign();

  console.log('\nTransaction signed successfully');
  console.log('  TxID:', spendingTx.id('hex'));
  console.log('  Fee:', spendingTx.getFee());

  // Verify
  try {
    await spendingTx.verify();
    console.log('\n✓ PASS: Simulated ingest transaction is VALID');
    return true;
  } catch (e) {
    console.log('\n✗ FAIL: Simulated ingest transaction is INVALID');
    console.error(e);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('SIGNATURE VALIDATION TEST SUITE');
  console.log('='.repeat(70));

  const results = [
    await testSimpleP2PKHTransaction(),
    await testMultiInputTransaction(),
    await testMultiInputTransactionWrongKeys(),
    await testActualIngestTxFlow(),
  ];

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passed}/${total} tests passed`);
  console.log('='.repeat(70));

  if (passed === total) {
    console.log('✓ ALL SIGNATURE VALIDATION TESTS PASSED');
  } else {
    console.log('✗ SOME TESTS FAILED');
  }
}

runAllTests();
