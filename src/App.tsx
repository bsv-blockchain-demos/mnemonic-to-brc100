import { useState } from 'react';
import { Mnemonic, HD, PrivateKey, PublicKey, P2PKH, Transaction, Utils, Script, WalletClient, type TransactionInput, type CreateActionInput } from '@bsv/sdk';
import './App.css';


/** FIFO queue for throttling API requests to max 3 per second */
const requestQueue: { url: string; resolve: (value: Response) => void; reject: (reason?: any) => void; }[] = [];

let isProcessing = false;

let lastRequestTime = 0;

const MIN_INTERVAL = 334; // ms for ~3 requests per second

const wallet = new WalletClient()

async function queuedFetch(url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    if (!isProcessing) {
      processQueue();
    }
  });
}

async function processQueue() {
  isProcessing = true;
  while (requestQueue.length > 0) {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - timeSinceLast));
    }
    lastRequestTime = Date.now();
    const item = requestQueue.shift()!;
    try {
      const response = await fetch(item.url);
      item.resolve(response);
    } catch (error) {
      item.reject(error);
    }
  }
  isProcessing = false;
}

interface wocUTXO {
  height: number;
  tx_pos: number;
  tx_hash: string;
  value: number;
  isSpentInMempoolTx: boolean;
}

interface utxoResponse {
  address: string;
  error: string;
  result: wocUTXO[];
  script: string;
}

interface Result {
  index: number;
  address: string;
  balance: number;
  count: number;
  utxos: utxoResponse;
}

function App() {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [pathPrefix, setPathPrefix] = useState<string>("m/44'/0/0");
  const [results, setResults] = useState<Result[]>([]);
  const [txHex, setTxHex] = useState<string>('');
  const [isLoading, setIsLoading] = useState<string>('');

const generateAddresses = async () => {
  setIsLoading('Generating seed...');
    let seed: number[];
    try {
      const mn = new Mnemonic(mnemonic);
      seed = mn.toSeed(pin);
    } catch (e) {
      alert('Invalid mnemonic or PIN');
      return;
    }

    const masterKey = HD.fromSeed(seed);
  setIsLoading('Searching for used addresses...');

    let index = 0;
    let consecutiveUnused = 0;
    const usedResults: Result[] = [];

    while (consecutiveUnused < 20) {
      const fullPath = `${pathPrefix}/${index}`;
      const childKey = masterKey.derive(fullPath);
      const privKey = childKey.privKey as PrivateKey;
      const pubKey = privKey.toPublicKey() as PublicKey;
      const address = pubKey.toAddress().toString();
      setIsLoading(`Checking address ${index}: ${address}`);

      // Check if ever used (using history length > 0)
      const historyRes = await queuedFetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/history`);
      const history = await historyRes.json();
      const isUsed = history.length > 0;

      if (isUsed) {
        // Fetch current UTXOs
        const unspentRes = await queuedFetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent/all`);
        const utxos = await unspentRes.json();
        if (utxos.result.length > 0) {
          console.log('success')
          const balance = utxos.result.reduce((sum: number, utxo: { value: number }) => sum + utxo.value, 0);
          usedResults.push({ index, address, balance, count: utxos.result.length, utxos });
        }
        consecutiveUnused = 0;
      } else {
        consecutiveUnused++;
      }

      index++;
    }

    setResults(usedResults);
    setTxHex('');
    setIsLoading('');
  };

  const createIngestTx = async () => {
    if (results.length === 0) {
      alert('No outputs found to ingest');
      return;
    }
    try {
      setIsLoading('Creating ingest transaction...');
      console.log({ results })

      const seed = new Mnemonic().fromString(mnemonic).toSeed(pin);
      const masterKey = HD.fromSeed(seed);

      // Collect all UTXOs with their details
      const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {};
      results.forEach(res => {
        const fullPath = `${pathPrefix}/${res.index}`;
        const childKey = masterKey.derive(fullPath);
        const privKey = childKey.privKey as PrivateKey;

        res.utxos.result.forEach((utxo: { tx_hash: string; tx_pos: number; value: number }) => {
          const txid = utxo.tx_hash;
          if (!utxosByTxid[txid]) {
            utxosByTxid[txid] = [];
          }
          utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value });
        });
      });

      const tx = new Transaction(1, []);
      tx.addOutput({
        satoshis: 1,
        lockingScript: Script.fromASM('OP_NOP')
      })

      for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
        setIsLoading(`Fetching BEEF for txid ${txid}...`);
        const beefRes = await queuedFetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/beef`);
        const beefHex = await beefRes.text();
        const beefBytes = Utils.toArray(beefHex, 'hex'); // Adjusted to fromHex assuming it returns bytes
        const sourceTx = Transaction.fromBEEF(beefBytes);

        utxoList.forEach(utxo => {
          const template = new P2PKH().unlock(utxo.privKey, 'none', true);
          tx.addInput({
            sourceTransaction: sourceTx,
            sourceOutputIndex: utxo.vout,
            unlockingScriptTemplate: template
          });
        });
      }

      setIsLoading('Signing Tx');
      await tx.sign();

      setIsLoading('Sending Tx to WalletClient')    
      const response = await wallet.createAction({
        inputBEEF: tx.toAtomicBEEF(),
        description: 'Ingesting Swept funds from mnemonic',
        inputs: tx.inputs.map<CreateActionInput>((input: TransactionInput) => ({
          inputDescription: 'from mnemonic',
          unlockingScript: input.unlockingScript!.toHex(),
          outpoint: input.sourceTXID + '.' + String(input.sourceOutputIndex)
        }))
      })

      setTxHex(Transaction.fromBEEF(response.tx as number[]).toHex())
    } catch (error) {
      console.error({ error })
    } finally {
      setIsLoading('');
    }
  };

  return (
    <div className="App">
      <h1>Centbee to BRC-100</h1>
      <div>
        <label>Mnemonic:</label>
        <textarea value={mnemonic} onChange={e => setMnemonic(e.target.value)} />
      </div>
      <div>
        <label>PIN:</label>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} />
      </div>
      <div>
        <label>Derivation Path Prefix:</label>
        <input value={pathPrefix} onChange={e => setPathPrefix(e.target.value)} />
      </div>
      <button onClick={generateAddresses} disabled={!!isLoading}>Generate Addresses</button>
      {isLoading && <p>{isLoading}</p>}
      {results.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Index</th>
              <th>Address</th>
              <th>Balance (sat)</th>
              <th>UTXO Count</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, i) => (
              <tr key={i}>
                <td>{res.index}</td>
                <td>{res.address}</td>
                <td>{res.balance}</td>
                <td>{res.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {results.length > 0 && <button onClick={createIngestTx} disabled={!!isLoading}>Create Ingest Tx</button>}
      {txHex && <>
        <a href={`https://whatsonchain.com/tx/${Transaction.fromHex(txHex).id('hex')}`}>whats on chain</a>
        <pre>{txHex}</pre>
      </>}
    </div>
  );
}

export default App;
