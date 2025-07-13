import { useState } from 'react';
import { Mnemonic, HD, PrivateKey, PublicKey, P2PKH, Transaction, Utils } from '@bsv/sdk';
import './App.css';


/** FIFO queue for throttling API requests to max 3 per second */
const requestQueue: { url: string; resolve: (value: Response) => void; reject: (reason?: any) => void; }[] = [];

let isProcessing = false;

let lastRequestTime = 0;

const MIN_INTERVAL = 334; // ms for ~3 requests per second

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

interface Result {
  index: number;
  address: string;
  balance: number;
  count: number;
  utxos: any[];
}

function App() {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [pathPrefix, setPathPrefix] = useState<string>("m/44'/0/0");
  const [results, setResults] = useState<Result[]>([]);
  const [txHex, setTxHex] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const generateAddresses = async () => {
    setIsLoading(true);
    let seed: number[];
    try {
      const mn = new Mnemonic(mnemonic);
      seed = mn.toSeed(pin);
    } catch (e) {
      alert('Invalid mnemonic or PIN');
      return;
    }

    const masterKey = HD.fromSeed(seed);

    let index = 0;
    let consecutiveUnused = 0;
    const usedResults: Result[] = [];

    while (consecutiveUnused < 20) {
      const fullPath = `${pathPrefix}/${index}`;
      const childKey = masterKey.derive(fullPath);
      const privKey = childKey.privKey as PrivateKey;
      const pubKey = privKey.toPublicKey() as PublicKey;
      const address = pubKey.toAddress().toString();

      // Check if ever used (using history length > 0)
      const historyRes = await queuedFetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/history`);
      const history = await historyRes.json();
      const isUsed = history.length > 0;

      if (isUsed) {
        // Fetch current UTXOs
        const unspentRes = await queuedFetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent/all`);
        const utxos = await unspentRes.json();
        if (utxos.length > 0) {
          console.log('success')
          const balance = utxos.reduce((sum: number, utxo: { value: number }) => sum + utxo.value, 0);
          usedResults.push({ index, address, balance, count: utxos.length, utxos });
        }
        consecutiveUnused = 0;
      } else {
        consecutiveUnused++;
      }

      index++;
    }

    setResults(usedResults);
    setTxHex('');
    setIsLoading(false);
  };

  const createIngestTx = async () => {
    if (results.length === 0) {
      alert('No outputs found to ingest');
      return;
    }

    const seed = new Mnemonic().fromString(mnemonic).toSeed(pin);
    const masterKey = HD.fromSeed(seed);

    // Collect all UTXOs with their details
    const utxosByTxid: { [key: string]: { vout: number; privKey: PrivateKey; value: number }[] } = {};
    results.forEach(res => {
      const fullPath = `${pathPrefix}/${res.index}`;
      const childKey = masterKey.derive(fullPath);
      const privKey = childKey.privKey as PrivateKey;

      res.utxos.forEach((utxo: { tx_hash: string; tx_pos: number; value: number }) => {
        const txid = utxo.tx_hash;
        if (!utxosByTxid[txid]) {
          utxosByTxid[txid] = [];
        }
        utxosByTxid[txid].push({ vout: utxo.tx_pos, privKey, value: utxo.value });
      });
    });

    const tx = new Transaction(1, []);

    for (const [txid, utxoList] of Object.entries(utxosByTxid)) {
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

  await tx.sign();

    setTxHex(tx.toHex());
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
      <button onClick={generateAddresses} disabled={isLoading}>Generate Addresses</button>
      {isLoading && <p>Loading... Searching for used addresses.</p>}
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
      {results.length > 0 && <button onClick={createIngestTx}>Create Ingest Tx</button>}
      {txHex && <pre>{txHex}</pre>}
    </div>
  );
}

export default App;
