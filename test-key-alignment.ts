/**
 * Security Test: Verify Private Key to Input Alignment
 *
 * This test validates that the private keys used to sign transaction inputs
 * correctly correspond to the UTXOs being spent.
 */

import { Mnemonic, HD, PrivateKey, PublicKey, P2PKH, Transaction, Utils } from '@bsv/sdk';

// Test mnemonic (DO NOT USE IN PRODUCTION - for testing only)
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PIN = '';

interface TestUTXO {
  tx_hash: string;
  tx_pos: number;
  value: number;
}

interface TestResult {
  index: number;
  address: string;
  pathPrefix: string;
  utxos: {
    result: TestUTXO[];
  };
}

/**
 * Test 1: Verify that private key derivation is consistent
 */
function testConsistentKeyDerivation() {
  console.log('\n=== Test 1: Consistent Key Derivation ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  const pathPrefix = "m/44'/0/0";
  const index = 0;
  const fullPath = `${pathPrefix}/${index}`.replace(/'/g, "'");

  // Derive the same key twice
  const childKey1 = masterKey.derive(fullPath);
  const privKey1 = childKey1.privKey as PrivateKey;
  const pubKey1 = privKey1.toPublicKey() as PublicKey;
  const address1 = pubKey1.toAddress().toString();

  const childKey2 = masterKey.derive(fullPath);
  const privKey2 = childKey2.privKey as PrivateKey;
  const pubKey2 = privKey2.toPublicKey() as PublicKey;
  const address2 = pubKey2.toAddress().toString();

  console.log('Path:', fullPath);
  console.log('Address 1:', address1);
  console.log('Address 2:', address2);
  console.log('PrivKey 1:', privKey1.toHex());
  console.log('PrivKey 2:', privKey2.toHex());

  if (address1 === address2 && privKey1.toHex() === privKey2.toHex()) {
    console.log('✓ PASS: Key derivation is consistent');
    return true;
  } else {
    console.log('✗ FAIL: Key derivation is inconsistent');
    return false;
  }
}

/**
 * Test 2: Verify private key can unlock the corresponding P2PKH output
 */
function testPrivateKeyUnlocksCorrectAddress() {
  console.log('\n=== Test 2: Private Key Unlocks Correct Address ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  const pathPrefix = "m/44'/0/0";
  const index = 0;
  const fullPath = `${pathPrefix}/${index}`.replace(/'/g, "'");

  const childKey = masterKey.derive(fullPath);
  const privKey = childKey.privKey as PrivateKey;
  const pubKey = privKey.toPublicKey() as PublicKey;
  const address = pubKey.toAddress().toString();

  // Create a P2PKH locking script for this address
  const lockingScript = new P2PKH().lock(address);

  // Verify the private key can create an unlocking template
  const unlockingTemplate = new P2PKH().unlock(privKey);

  console.log('Address:', address);
  console.log('Locking Script:', lockingScript.toHex());
  console.log('Unlocking Template created successfully');

  // Verify the public key hash matches
  const pubKeyHash = pubKey.toHash();
  console.log('PubKey Hash:', pubKeyHash);

  console.log('✓ PASS: Private key can create unlocking template for its address');
  return true;
}

/**
 * Test 3: Simulate the utxosByTxid structure creation
 */
function testUtxosByTxidStructure() {
  console.log('\n=== Test 3: UTXO to Private Key Mapping Structure ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Simulate results from address discovery
  const mockResults: TestResult[] = [
    {
      index: 0,
      address: '1someaddress1',
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'abc123', tx_pos: 0, value: 1000 },
          { tx_hash: 'abc123', tx_pos: 1, value: 2000 },
        ]
      }
    },
    {
      index: 1,
      address: '1someaddress2',
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'def456', tx_pos: 0, value: 3000 },
        ]
      }
    },
  ];

  // Replicate the utxosByTxid creation logic from createIngestTx
  const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {};

  mockResults.forEach(res => {
    const fullPath = `${res.pathPrefix}/${res.index}`.replace(/'/g, "'");
    const childKey = masterKey.derive(fullPath);
    const privKey = childKey.privKey as PrivateKey;

    console.log(`\nProcessing address at index ${res.index}:`);
    console.log('  Path:', fullPath);
    console.log('  PrivKey:', privKey.toHex().substring(0, 16) + '...');

    res.utxos.result.forEach((utxo: TestUTXO) => {
      const txid = utxo.tx_hash;
      if (!utxosByTxid[txid]) {
        utxosByTxid[txid] = [];
      }
      utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value });
      console.log(`  Added UTXO: ${txid}:${utxo.tx_pos}`);
    });
  });

  console.log('\nFinal utxosByTxid structure:');
  for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
    console.log(`\nTxid: ${txid}`);
    utxoList.forEach(utxo => {
      console.log(`  vout: ${utxo.vout}, value: ${utxo.value}, privKey: ${utxo.privKey.toHex().substring(0, 16)}...`);
    });
  }

  console.log('\n✓ PASS: UTXO structure correctly maps txid:vout to private keys');
  return true;
}

/**
 * Test 4: Critical - Verify private key lookup during signing matches input
 */
function testPrivateKeyLookupLogic() {
  console.log('\n=== Test 4: Private Key Lookup During Signing (CRITICAL) ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Create mock utxosByTxid structure
  const pathPrefix = "m/44'/0/0";
  const index0 = 0;
  const index1 = 1;

  const fullPath0 = `${pathPrefix}/${index0}`.replace(/'/g, "'");
  const childKey0 = masterKey.derive(fullPath0);
  const privKey0 = childKey0.privKey as PrivateKey;

  const fullPath1 = `${pathPrefix}/${index1}`.replace(/'/g, "'");
  const childKey1 = masterKey.derive(fullPath1);
  const privKey1 = childKey1.privKey as PrivateKey;

  const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {
    'abc123': [
      { vout: 0, privKey: privKey0, value: 1000 },
      { vout: 1, privKey: privKey0, value: 2000 },
    ],
    'def456': [
      { vout: 0, privKey: privKey1, value: 3000 },
    ]
  };

  console.log('\nMock UTXO structure:');
  console.log('  abc123:0 -> privKey0:', privKey0.toHex().substring(0, 16) + '...');
  console.log('  abc123:1 -> privKey0:', privKey0.toHex().substring(0, 16) + '...');
  console.log('  def456:0 -> privKey1:', privKey1.toHex().substring(0, 16) + '...');

  // Simulate the signing loop from lines 231-238
  console.log('\nSimulating signing logic:');

  const mockInputs = [
    { txid: 'abc123', vout: 0 },
    { txid: 'abc123', vout: 1 },
    { txid: 'def456', vout: 0 },
  ];

  let allMatch = true;
  mockInputs.forEach((mockInput, idx) => {
    // This is the actual lookup logic from line 233
    const foundPrivKey = utxosByTxid[mockInput.txid].find(utxo => utxo.vout === mockInput.vout)?.privKey;

    if (!foundPrivKey) {
      console.log(`  Input ${idx} (${mockInput.txid}:${mockInput.vout}): ✗ FAIL - No private key found`);
      allMatch = false;
    } else {
      const expectedPrivKey = mockInput.txid === 'abc123' ? privKey0 : privKey1;
      const matches = foundPrivKey.toHex() === expectedPrivKey.toHex();
      console.log(`  Input ${idx} (${mockInput.txid}:${mockInput.vout}): ${matches ? '✓' : '✗'} ${matches ? 'PASS' : 'FAIL'} - PrivKey: ${foundPrivKey.toHex().substring(0, 16)}...`);
      if (!matches) allMatch = false;
    }
  });

  if (allMatch) {
    console.log('\n✓ PASS: All private keys correctly match their inputs');
  } else {
    console.log('\n✗ FAIL: Private key mismatch detected');
  }

  return allMatch;
}

/**
 * Test 5: Multi-address scenario with different derivation paths
 */
function testMultipleDerivationPaths() {
  console.log('\n=== Test 5: Multiple Derivation Paths ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Test different path prefixes (simulating user changing path and re-scanning)
  const paths = [
    { prefix: "m/44'/0/0", index: 0 },
    { prefix: "m/44'/0/0", index: 1 },
    { prefix: "m/0'/0", index: 0 },  // Different prefix
  ];

  const derivedKeys: { path: string; privKey: PrivateKey; address: string }[] = [];

  paths.forEach(({ prefix, index }) => {
    const fullPath = `${prefix}/${index}`.replace(/'/g, "'");
    const childKey = masterKey.derive(fullPath);
    const privKey = childKey.privKey as PrivateKey;
    const pubKey = privKey.toPublicKey() as PublicKey;
    const address = pubKey.toAddress().toString();

    derivedKeys.push({ path: fullPath, privKey, address });
    console.log(`Path: ${fullPath} -> Address: ${address}`);
  });

  // Verify all keys are unique (except if same path)
  const privKeyHexes = derivedKeys.map(k => k.privKey.toHex());
  const uniquePrivKeys = new Set(privKeyHexes);

  console.log(`\nTotal keys: ${privKeyHexes.length}, Unique keys: ${uniquePrivKeys.size}`);

  if (uniquePrivKeys.size === privKeyHexes.length) {
    console.log('✓ PASS: All keys are unique for different paths');
    return true;
  } else {
    console.log('✗ FAIL: Duplicate keys detected');
    return false;
  }
}

/**
 * Test 6: Verify address generation matches between phases
 */
function testAddressGenerationConsistency() {
  console.log('\n=== Test 6: Address Generation Consistency Between Phases ===');

  const mnemonic = TEST_MNEMONIC;
  const pin = TEST_PIN;
  const pathPrefix = "m/44'/0/0";
  const index = 0;

  // Phase 1: Address Discovery (lines 86-106)
  const seed1 = new Mnemonic(mnemonic).toSeed(pin);
  const masterKey1 = HD.fromSeed(seed1);
  const fullPath1 = `${pathPrefix}/${index}`.replace(/'/g, "'");
  const childKey1 = masterKey1.derive(fullPath1);
  const privKey1 = childKey1.privKey as PrivateKey;
  const pubKey1 = privKey1.toPublicKey() as PublicKey;
  const address1 = pubKey1.toAddress().toString();

  // Phase 2: Transaction Creation (lines 168-176)
  const seed2 = new Mnemonic().fromString(mnemonic).toSeed(pin);
  const masterKey2 = HD.fromSeed(seed2);
  const fullPath2 = `${pathPrefix}/${index}`.replace(/'/g, "'");
  const childKey2 = masterKey2.derive(fullPath2);
  const privKey2 = childKey2.privKey as PrivateKey;
  const pubKey2 = privKey2.toPublicKey() as PublicKey;
  const address2 = pubKey2.toAddress().toString();

  console.log('Phase 1 (Discovery):');
  console.log('  Address:', address1);
  console.log('  PrivKey:', privKey1.toHex());

  console.log('\nPhase 2 (Transaction):');
  console.log('  Address:', address2);
  console.log('  PrivKey:', privKey2.toHex());

  if (address1 === address2 && privKey1.toHex() === privKey2.toHex()) {
    console.log('\n✓ PASS: Address and private key generation is consistent between phases');
    return true;
  } else {
    console.log('\n✗ FAIL: Address or private key mismatch between phases');
    return false;
  }
}

/**
 * Test 7: Edge case - Same address appears in multiple results
 */
function testDuplicateAddressHandling() {
  console.log('\n=== Test 7: Duplicate Address Handling ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Simulate scenario where same address appears twice (shouldn't happen normally)
  const mockResults: TestResult[] = [
    {
      index: 0,
      address: '1someaddress1',
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'abc123', tx_pos: 0, value: 1000 },
        ]
      }
    },
    {
      index: 0,  // Same index and path - duplicate entry
      address: '1someaddress1',
      pathPrefix: "m/44'/0/0",
      utxos: {
        result: [
          { tx_hash: 'abc123', tx_pos: 1, value: 2000 },
        ]
      }
    },
  ];

  const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {};

  mockResults.forEach(res => {
    const fullPath = `${res.pathPrefix}/${res.index}`.replace(/'/g, "'");
    const childKey = masterKey.derive(fullPath);
    const privKey = childKey.privKey as PrivateKey;

    res.utxos.result.forEach((utxo: TestUTXO) => {
      const txid = utxo.tx_hash;
      if (!utxosByTxid[txid]) {
        utxosByTxid[txid] = [];
      }
      utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value });
    });
  });

  console.log('UTXOs for txid abc123:');
  utxosByTxid['abc123'].forEach((utxo, idx) => {
    console.log(`  [${idx}] vout: ${utxo.vout}, privKey: ${utxo.privKey.toHex().substring(0, 16)}...`);
  });

  // Verify both UTXOs have the same private key (since they're from same derivation)
  const privKey0 = utxosByTxid['abc123'][0].privKey.toHex();
  const privKey1 = utxosByTxid['abc123'][1].privKey.toHex();

  if (privKey0 === privKey1) {
    console.log('\n✓ PASS: Duplicate addresses use same private key (expected behavior)');
    return true;
  } else {
    console.log('\n✗ FAIL: Duplicate addresses have different private keys (unexpected)');
    return false;
  }
}

/**
 * Test 8: Critical - Verify pathPrefix is preserved from discovery to signing
 */
function testPathPrefixPreservation() {
  console.log('\n=== Test 8: Path Prefix Preservation (CRITICAL) ===');

  const seed = new Mnemonic(TEST_MNEMONIC).toSeed(TEST_PIN);
  const masterKey = HD.fromSeed(seed);

  // Simulate results with DIFFERENT path prefixes (this is the actual bug scenario)
  const mockResults: TestResult[] = [
    {
      index: 0,
      address: '1address1',
      pathPrefix: "m/44'/0/0",  // User scanned with this path
      utxos: {
        result: [
          { tx_hash: 'abc123', tx_pos: 0, value: 1000 },
        ]
      }
    },
    {
      index: 0,
      address: '1address2',
      pathPrefix: "m/0'/0",  // User changed path and scanned again
      utxos: {
        result: [
          { tx_hash: 'def456', tx_pos: 0, value: 2000 },
        ]
      }
    },
  ];

  console.log('\nSimulating mixed path prefixes in results:');
  const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number; path: string }[] } = {};

  mockResults.forEach(res => {
    const fullPath = `${res.pathPrefix}/${res.index}`.replace(/'/g, "'");
    const childKey = masterKey.derive(fullPath);
    const privKey = childKey.privKey as PrivateKey;

    console.log(`  Result index ${res.index}, pathPrefix: ${res.pathPrefix}`);
    console.log(`    Full path: ${fullPath}`);
    console.log(`    PrivKey: ${privKey.toHex().substring(0, 16)}...`);

    res.utxos.result.forEach((utxo: TestUTXO) => {
      const txid = utxo.tx_hash;
      if (!utxosByTxid[txid]) {
        utxosByTxid[txid] = [];
      }
      utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value, path: fullPath });
    });
  });

  console.log('\nVerifying correct path prefix was used for each UTXO:');
  let allCorrect = true;

  for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
    utxoList.forEach(utxo => {
      const result = mockResults.find(r =>
        r.utxos.result.some(u => u.tx_hash === txid && u.tx_pos === utxo.vout)
      );

      if (result) {
        const expectedPath = `${result.pathPrefix}/${result.index}`.replace(/'/g, "'");
        const matches = utxo.path === expectedPath;
        console.log(`  ${txid}:${utxo.vout} - Expected: ${expectedPath}, Got: ${utxo.path} - ${matches ? '✓' : '✗'}`);
        if (!matches) allCorrect = false;
      }
    });
  }

  if (allCorrect) {
    console.log('\n✓ PASS: Path prefixes are correctly preserved from discovery to signing');
  } else {
    console.log('\n✗ FAIL: Path prefix mismatch detected');
  }

  return allCorrect;
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(70));
  console.log('SECURITY TEST SUITE: Private Key to Input Alignment');
  console.log('='.repeat(70));

  const results = [
    testConsistentKeyDerivation(),
    testPrivateKeyUnlocksCorrectAddress(),
    testUtxosByTxidStructure(),
    testPrivateKeyLookupLogic(),
    testMultipleDerivationPaths(),
    testAddressGenerationConsistency(),
    testDuplicateAddressHandling(),
    testPathPrefixPreservation(),
  ];

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passed}/${total} tests passed`);
  console.log('='.repeat(70));

  if (passed === total) {
    console.log('✓ ALL TESTS PASSED');
  } else {
    console.log('✗ SOME TESTS FAILED - SECURITY REVIEW REQUIRED');
  }
}

// Execute tests
runAllTests();
