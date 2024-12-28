## Run Locally

### 1. Clone the Project
```bash
git clone https://link-to-project
```

---

### 2. Install Dependencies
- **Foundry**: [Installation Guide](https://book.getfoundry.sh/getting-started/installation)
- **Node.js**: [Download and Install](https://nodejs.org/en)
- **SUI**: [Installation Guide](https://docs.sui.io/guides/developer/getting-started/sui-install)

---

### 3. Start the Local Ethereum Chain
Start the `anvil` localchain by running:
```bash
anvil
```

From the output, select an address and its private key.

---

### 4. Deploy the Ethereum Contract
Navigate to the Ethereum contract directory and deploy the contract:
```bash
cd eth-contract
forge create src/BridgeToken.sol:IBT --rpc-url http://127.0.0.1:8545 --private-key <YOUR_PRIVATE_KEY> --broadcast
```

Copy the `deployed_to` field from the output and save it in `/ibt-web/.env` as the value for:
```
VITE_ETH_CONTRACT_ADDRESS=<DEPLOYED_ADDRESS>
```

---

### 5. Start the SUI Localchain
Run the following command to start the SUI localchain and request tokens:
```bash
RUST_LOG="off,sui_node=info" sui start --with-faucet --force-regenesis
sui client faucet
```

---

### 6. Deploy the SUI Contract
Navigate to the SUI contract directory and deploy the contract:
```bash
cd sui_contract
sui move build
sui client publish --gas-budget <YOUR_GAS_LIMIT> # Example: 100000000
```

From the output (or by running `sui client objects`), note down:
1. The ID of the **IBT contract**
2. The ID of the **BridgeAuth objects**

Save these values in the `.env` file located in `./ibt-web` as:
```
VITE_SUI_PACKAGE_ID=<IBT_CONTRACT_ID>
VITE_SUI_BRIDGE_AUTH_ID=<BRIDGE_AUTH_ID>
```

---

### 7. Start the Event Listener Server
Navigate to the `ibt-web` directory and start the server:
```bash
cd ibt-web
node src/Server.js
```

---

### 8. Run the Website Locally
In the same directory, run the following command to start the website:
```bash
npm run dev
```

Navigate to the output URL to test the bridge. Use the contract deployer's address to mint coins.

---

### Notes
- Use **MetaMask** and a **SUI wallet** that supports the "dApps-kit" library.
  
---
