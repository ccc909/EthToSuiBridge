## Run Locally

Clone the project

```bash
  git clone https://link-to-project
```

Install foundry https://book.getfoundry.sh/getting-started/installation.
Install node.js https://nodejs.org/en.
Install SUI https://docs.sui.io/guides/developer/getting-started/sui-install.

Start the anvil localchain by running 

```bash
anvil
```

Select an adress and its's private key from the output.

Navigate to the ethereum contract and deploy it 

```bash
cd eth-contract
forge create src/BridgeToken.sol:IBT --rpc-url http://127.0.0.1:8545 --private-key <YOUR_PRIVATE_KEY> --broadcast  
```

Copy the deployed_to field and save it in /ibt-web/.env as the value for VITE_ETH_CONTRACT_ADDRESS.

Start the sui localchain and request tokens with:

```bash
RUST_LOG="off,sui_node=info" sui start --with-faucet --force-regenesis
sui client faucet
```

Navigate to the Sui contract and deploy it:

```bash
cd sui_contract
sui move build 
sui client publish --gas-budget <YOUR_GAS_LIMIT> (100000000 works)
```

From the output of the previous commands or by running "sui client objects" note down the id of the IBT contract and the id of the BridgeAuth objects.
Save these as VITE_SUI_PACKAGE_ID and VITE_SUI_BRIDGE_AUTH_ID respectively in the .env file located in "./ibt-web"

Start the event listener server to handle bridge events:

```bash
cd ibt-web
node src/Server.js
```

Run the website locally by running:

```bash
cd ibt-web
npm run dev
```

Navigate to the output url and test the bridge. To mint coins, use the contract deployer's address.

NOTE: MetaMask and a Sui wallet that support the "dApps-kit" library must be used.
