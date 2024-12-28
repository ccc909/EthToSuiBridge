import express from 'express';
import { ethers } from 'ethers';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_CONFIG = {
  ethereum: {
    address: process.env.VITE_ETH_CONTRACT_ADDRESS,
    abi: [
      "function mint(address to, uint256 amount) external",
      "function burn(address from, uint256 amount) external",
      "event BridgeInitiated(address indexed from, uint256 amount, string destinationChain, string destinationAddress)"
    ]
  },
  sui: {
    packageId: process.env.VITE_SUI_PACKAGE_ID,
    bridgeAuthId: process.env.VITE_SUI_BRIDGE_AUTH_ID,
    module: 'IBT'
  }
};

const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const ethSigner = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, ethProvider);
const ethContract = new ethers.Contract(
  CONTRACT_CONFIG.ethereum.address,
  CONTRACT_CONFIG.ethereum.abi,
  ethSigner
);

const suiClient = new SuiClient({ url: getFullnodeUrl('localnet') });
const suiKeypair = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const processedTxs = new Set();

async function listenToEthereumEvents() {
  console.log('Starting to listen for Ethereum bridge events...');

  ethContract.on("BridgeInitiated", async (from, amount, destinationChain, destinationAddress, event) => {
    try {
      const txHash = event.log.transactionHash;
      if (processedTxs.has(txHash)) {
        console.log(`Transaction ${txHash} already processed`);
        return;
      }

      console.log(`Processing Ethereum bridge event:
        From: ${from}
        Amount: ${amount}
        Destination: ${destinationChain}
        TX Hash: ${txHash}`);

      const tx = await ethProvider.getTransaction(txHash);
      if (!tx || tx.confirmations < 5) {
        console.log('Waiting for more confirmations...');
        return;
      }

      const txb = new Transaction();

      txb.moveCall({
        target: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::mint`,
        arguments: [
          txb.object(CONTRACT_CONFIG.sui.bridgeAuthId),
          txb.pure.u64(ethers.formatUnits(amount, 18) * 10**9), 
          txb.pure.address(destinationAddress)
        ]
      });

      const result = await suiClient.signAndExecuteTransaction({
        transaction: txb,
        signer: suiKeypair,
        options: {
          showEffects: true
        }
      });

      console.log('Sui mint transaction executed:', result.digest);

      processedTxs.add(txHash);

    } catch (error) {
      console.error('Error processing Ethereum bridge event:', error);
    }
  });
}

async function listenToSuiEvents() {
  console.log('Starting to listen for Sui bridge events...');

  const processedEventDigests = new Set();

  setInterval(async () => {
    try {
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::BridgeEvent`,
        },
        limit: 50,
        order: "descending",
      });

      for (const event of events.data) {
        if (processedEventDigests.has(event.id.txDigest)) continue;

        console.log(event);

        const { from, amount, eth_address } = event.parsedJson;
        const decodedEthAddress = '0x' + Buffer.from(eth_address).toString('hex');

        console.log(`Processing Sui bridge event:
          From: ${from}
          Amount: ${amount}
          ETH Address: ${eth_address}
          Event ID: ${event.id.txDigest}`);

        const tx = await suiClient.getTransactionBlock({
          digest: event.id.txDigest,
          options: {
            showEffects: true
          }
        });

        if (!tx) {
          console.log('Transaction not found');
          continue;
        }

        const mintTx = await ethContract.mint(
          decodedEthAddress,
          ethers.parseUnits((amount / 10**9).toString(), 18)
        );
        await mintTx.wait();

        console.log('Ethereum mint transaction executed:', mintTx.hash);

        processedEventDigests.add(event.id.txDigest);
      }
    } catch (error) {
      console.error('Error processing Sui bridge events:', error);
    }
  }, 5000); 
}

listenToEthereumEvents().catch(console.error);
listenToSuiEvents().catch(console.error);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bridge backend service running on port ${PORT}`);
});