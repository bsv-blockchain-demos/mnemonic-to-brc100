/**
 * Test suite for @bsv/sdk transaction creation and signing
 *
 * This test demonstrates the correct API for:
 * 1. Creating a source transaction with a P2PKH output
 * 2. Creating a spending transaction that references the source UTXO
 * 3. Signing the spending transaction with P2PKH unlock script
 * 4. Verifying the signature using the Spend validator
 */

import { describe, it, expect } from 'vitest'
import {
  Transaction,
  PrivateKey,
  P2PKH,
  LockingScript,
  UnlockingScript,
  Spend
} from '@bsv/sdk'

describe('Transaction Creation and Signing with @bsv/sdk', () => {
  describe('Basic P2PKH Transaction Flow', () => {
    it('should create, sign, and verify a P2PKH transaction', async () => {
      // 1. Create a private key and derive the P2PKH locking script
      const privateKey = PrivateKey.fromRandom()
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

      // Verify source transaction was created
      expect(sourceTx.outputs.length).toBe(1)
      expect(sourceTx.outputs[0].satoshis).toBe(satoshis)
      expect(sourceTx.outputs[0].lockingScript?.toHex()).toBe(lockingScript.toHex())

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

      // Verify unlocking script was created
      expect(unlockingScript).toBeDefined()
      expect(unlockingScript.toBinary().length).toBeGreaterThan(0)

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
      expect(isValid).toBe(true)
    })

    it('should fail to verify a P2PKH spend with the wrong private key', async () => {
      // 1. Create correct and wrong private keys
      const correctPrivateKey = PrivateKey.fromRandom()
      const wrongPrivateKey = PrivateKey.fromRandom()

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

      const isValid = spend.validate()
      expect(isValid).toBe(false)
    })
  })

  describe('Transaction Input API - Comprehensive Examples', () => {
    it('should demonstrate different ways to add inputs to transactions', async () => {
      const privateKey = PrivateKey.fromRandom()
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
      expect(tx1.inputs.length).toBe(1)
      expect(tx1.inputs[0].sourceTransaction?.id('hex')).toBe(sourceTx.id('hex'))
      expect(tx1.inputs[0].sourceOutputIndex).toBe(0)

      // Method 2: Use addInput() method
      const tx2 = new Transaction()
      tx2.addInput({
        sourceTransaction: sourceTx,
        sourceOutputIndex: 0,
        sequence: 0xffffffff
      })
      expect(tx2.inputs.length).toBe(1)
      expect(tx2.inputs[0].sourceTransaction?.id('hex')).toBe(sourceTx.id('hex'))

      // Method 3: Add input using sourceTXID (for reference, though sourceTransaction is preferred)
      const tx3 = new Transaction()
      tx3.addInput({
        sourceTXID: sourceTx.id('hex'),
        sourceOutputIndex: 0,
        unlockingScript: new UnlockingScript(),
        sequence: 0xffffffff
      })
      expect(tx3.inputs.length).toBe(1)
      expect(tx3.inputs[0].sourceTXID).toBe(sourceTx.id('hex'))
    })

    it('should demonstrate proper usage with unlockingScriptTemplate', async () => {
      const privateKey = PrivateKey.fromRandom()
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

      // Sign the transaction - this uses the template to generate unlocking scripts
      await spendTx.sign()

      // Verify the unlocking script was generated
      expect(spendTx.inputs[0].unlockingScript).toBeDefined()
      expect(spendTx.inputs[0].unlockingScript!.toBinary().length).toBeGreaterThan(0)

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

      expect(spend.validate()).toBe(true)
    })
  })

  describe('Real-world pattern from App.tsx', () => {
    it('should replicate the pattern used in the codebase', async () => {
      // This test replicates the pattern from App.tsx lines 231-241
      const privateKey = PrivateKey.fromRandom()
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
        // In real app, this finds the correct privKey from a map
        // Here we just use our test private key
        input.unlockingScriptTemplate = new P2PKH().unlock(privateKey)
      })

      // Sign the transaction (calculates fees if needed, then signs)
      await tx.fee()
      await tx.sign()

      // Verify each input has an unlocking script
      tx.inputs.forEach(input => {
        expect(input.unlockingScript).toBeDefined()
        expect(input.unlockingScript!.toHex()).toBeTruthy()
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

      expect(spend.validate()).toBe(true)
    })
  })
})
