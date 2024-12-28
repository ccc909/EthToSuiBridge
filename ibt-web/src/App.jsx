import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, Wallet } from 'lucide-react';
import { WalletProvider, useWallets } from '@mysten/dapp-kit';
import { createNetworkConfig, SuiClientProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const networks = {
  localnet: {
    url: getFullnodeUrl('localnet')
  },
  mainnet: {
    url: getFullnodeUrl('mainnet')
  }
};
const queryClient = new QueryClient();

const ETHEREUM_ABI = [
  "function mint(address to, uint256 amount) external",
  "function burn(address from, uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event BridgeInitiated(address indexed from, uint256 amount, string destinationChain, string destinationAddress)",
  "function initiatebridge(uint256 amount, string calldata suiAddresss) external"
];

const CONTRACT_CONFIG = {
  ethereum: {
    address: import.meta.env.VITE_ETH_CONTRACT_ADDRESS,
    abi: ETHEREUM_ABI
  },
  sui: {
    packageId: import.meta.env.VITE_SUI_PACKAGE_ID,
    bridgeAuthId: import.meta.env.VITE_SUI_BRIDGE_AUTH_ID,
    module: 'IBT'
  }
};

const BridgeContent = () => {
  const [amount, setAmount] = useState('');
  const [sourceChain, setSourceChain] = useState('ethereum');
  const [destinationChain, setDestinationChain] = useState('sui');
  const [ethConnected, setEthConnected] = useState(false);
  const [ethAddress, setEthAddress] = useState('');
  const [status, setStatus] = useState('');
  const [ethProvider, setEthProvider] = useState(null);
  const [suiClient, setSuiClient] = useState(null);
  const [ethBalance, setEthBalance] = useState('0');
  const [suiBalance, setSuiBalance] = useState('0');
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [availableCoins, setAvailableCoins] = useState([]);
  const [selectedCoinId, setSelectedCoinId] = useState('');

  const wallets = useWallets();

  const fetchAvailableCoins = async (address) => {
    if (suiClient && address) {
      try {
        const coins = await suiClient.getCoins({
          owner: address,
          coinType: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::IBT`
        });
        setAvailableCoins(coins.data);
      } catch (error) {
        console.error('Error fetching coins:', error);
        setStatus('Error fetching available coins: ' + error.message);
      }
    }
  };

  useEffect(() => {
    initializeProviders();
  }, []);

  useEffect(() => {

    const intervalId = setInterval(() => {
      if (ethAddress) updateEthBalance(ethAddress);
      if (selectedWallet && selectedWallet.accounts[0]) {
        const address = selectedWallet.accounts[0].address;
        updateSuiBalance(address);
        fetchAvailableCoins(address);
      }
    }, 5000); 

    return () => clearInterval(intervalId); 
  }, [ethAddress, selectedWallet]);

  const initializeProviders = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setEthProvider(provider);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }

    const client = new SuiClient({ url: getFullnodeUrl('localnet') });
    setSuiClient(client);
  };

  const connectSuiWallet = async (wallet) => {
    try {
      const features = wallet.features['standard:connect'];
      if (features) {
        await features.connect();
        setSelectedWallet(wallet);
        if (wallet.accounts[0]) {
          await updateSuiBalance(wallet.accounts[0].address);
        }
        setStatus('Sui wallet connected successfully!');
      }
    } catch (error) {
      setStatus('Error connecting Sui wallet: ' + error.message);
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setEthConnected(false);
      setEthAddress('');
    } else {
      setEthAddress(accounts[0]);
      setEthConnected(true);
      await updateEthBalance(accounts[0]);
    }
  };

  const handleMintTokens = async () => {
    try {
      if (sourceChain === 'ethereum') {
        if (!ethProvider || !ethAddress) {
          setStatus('Ethereum wallet not connected.');
          return;
        }

        const signer = await ethProvider.getSigner();
        const contract = new ethers.Contract(
          CONTRACT_CONFIG.ethereum.address,
          CONTRACT_CONFIG.ethereum.abi,
          signer
        );

        const amountWei = ethers.parseUnits(amount, 18);
        setStatus('Minting tokens on Ethereum...');

        const mintTx = await contract.mint(ethAddress, amountWei);
        await mintTx.wait();

        setStatus('Tokens minted successfully on Ethereum!');
        await updateEthBalance(ethAddress);
      } else if (sourceChain === 'sui') {
        if (!selectedWallet || !selectedWallet.accounts[0]) {
          setStatus('Sui wallet not connected.');
          return;
        }

        setStatus('Minting tokens on Sui...');
        const tx = new Transaction();

        tx.moveCall({
          target: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::mint`,
          arguments: [
            tx.object(CONTRACT_CONFIG.sui.bridgeAuthId),
            tx.pure(amount, 'u64'),
            tx.pure(selectedWallet.accounts[0].address)
          ]
        });

        const features = selectedWallet.features['sui:signAndExecuteTransactionBlock'];
        if (!features) throw new Error("Wallet doesn't support transaction signing");

        const response = await features.signAndExecuteTransaction({
          transaction: tx
        });

        setStatus('Tokens minted successfully on Sui!');
        await updateSuiBalance(selectedWallet.accounts[0].address);
      }
    } catch (error) {
      setStatus('Error minting tokens: ' + error.message);
    }
  };

  const connectEthWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const updatedAccounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (updatedAccounts.length === 0) {
        setStatus('No accounts found. Please create or import an account in MetaMask.');
        return;
      }

      const selectedAccount = updatedAccounts[0];
      setEthAddress(selectedAccount);
      setEthConnected(true);
      await updateEthBalance(selectedAccount);
      setStatus('Ethereum wallet connected successfully!');
    } catch (error) {
      setStatus('Error connecting Ethereum wallet: ' + error.message);
    }
  };

  const updateEthBalance = async (address) => {
    if (ethProvider && address) {
      try {
        const contract = new ethers.Contract(
          CONTRACT_CONFIG.ethereum.address,
          CONTRACT_CONFIG.ethereum.abi,
          ethProvider
        );
        const balance = await contract.balanceOf(address);
        setEthBalance(ethers.formatUnits(balance, 18));
      } catch (error) {
        console.error('Error fetching ETH balance:', error);
      }
    }
  };

  const updateSuiBalance = async (address) => {
    if (suiClient && address) {
      try {
        const coins = await suiClient.getCoins({
          owner: address,
          coinType: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::IBT`
        });
        const totalBalance = coins.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n);

        const displayBalance = Number(totalBalance) / 1_000_000_000;
        setSuiBalance(displayBalance.toString());
      } catch (error) {
        console.error('Error fetching SUI balance:', error);
      }
    }
  };

  const handleEthereumToSuiBridge = async () => {
    try {
      if (!ethProvider || !ethAddress) {
        throw new Error("Ethereum wallet not connected.");
      }

      if (!selectedWallet || !selectedWallet.accounts[0]) {
        throw new Error("Sui wallet not connected.");
      }

      const signer = await ethProvider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_CONFIG.ethereum.address,
        CONTRACT_CONFIG.ethereum.abi,
        signer
      );

      const amountWei = ethers.parseUnits(amount, 18);
      const suiAddress = selectedWallet.accounts[0].address;

      setStatus('Initiating bridge from Ethereum to Sui...');

      const bridgeTx = await contract.initiatebridge(amountWei, suiAddress);
      const bridgeReceipt = await bridgeTx.wait();
      const ethereumTxHash = bridgeReceipt.hash;

      setStatus(`Bridge initiated successfully on Ethereum! Tx Hash: ${ethereumTxHash}`);
      await updateEthBalance(ethAddress);
    } catch (error) {
      setStatus('Error during Ethereum to Sui bridge: ' + error.message);
      throw error;
    }
  };

  const handleSuiToEthereumBridge = async () => {
    try {
      if (!selectedWallet) throw new Error("Wallet not connected");
      if (!selectedCoinId) throw new Error("Please select a coin to bridge");

      setStatus('Creating transaction...');
      const tx = new Transaction();

      const ethAddressBytes = Array.from(
        Buffer.from(ethAddress.replace(/^0x/, ''), 'hex')
      );

      tx.moveCall({
        target: `${CONTRACT_CONFIG.sui.packageId}::${CONTRACT_CONFIG.sui.module}::burn_and_bridge`,
        arguments: [
          tx.object(CONTRACT_CONFIG.sui.bridgeAuthId),
          tx.object(selectedCoinId),
          tx.pure('vector<u8>', ethAddressBytes)
        ]
      });

      setStatus('Executing transaction...');
      const features = selectedWallet.features['sui:signAndExecuteTransaction'];
      if (!features) throw new Error("Wallet doesn't support transaction signing");

      const response = await features.signAndExecuteTransaction({
        transaction: tx
      });

      setStatus('Bridge transfer completed!');
      if (selectedWallet.accounts[0]) {
        await updateSuiBalance(selectedWallet.accounts[0].address);
        await fetchAvailableCoins(selectedWallet.accounts[0].address);
      }
      await updateEthBalance(ethAddress);
      setSelectedCoinId('');
      return response;
    } catch (error) {
      setStatus('Error: ' + error.message);
      throw error;
    }
  };

  const renderBridgeInterface = () => {
    if (sourceChain === 'ethereum') {
      return (
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full"
        />
      );
    } else {
      return (
        <Select value={selectedCoinId} onValueChange={setSelectedCoinId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a coin to bridge" />
          </SelectTrigger>
          <SelectContent>
            {availableCoins.map((coin) => (
              <SelectItem key={coin.coinObjectId} value={coin.coinObjectId}>
                {`${Number(coin.balance) / 1_000_000_000} IBT (ID: ${coin.coinObjectId.slice(0, 6)}...)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
  };

  const swapChains = () => {
    setSourceChain(destinationChain);
    setDestinationChain(sourceChain);
  };

  const handleBridge = async () => {
    if (!amount) {
      setStatus('Please enter an amount');
      return;
    }

    if (sourceChain === 'ethereum' && !ethConnected) {
      setStatus('Please connect Ethereum wallet');
      return;
    }

    if (sourceChain === 'sui' && !selectedWallet) {
      setStatus('Please connect Sui wallet');
      return;
    }

    try {
      if (sourceChain === 'ethereum') {
        await handleEthereumToSuiBridge();
      } else {
        await handleSuiToEthereumBridge();
      }
    } catch (error) {
      setStatus('Bridge failed: ' + error.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-4xl shadow-xl bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            IBT Cross-Chain Bridge
          </CardTitle>
          <p className="text-center text-gray-500 text-sm">Transfer tokens between Ethereum and Sui</p>
        </CardHeader>
        <CardContent className="space-y-8">
          {}
          <div className="grid grid-cols-1 gap-4">
            {!ethConnected && (
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition-all" 
                onClick={connectEthWallet}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Ethereum
              </Button>
            )}

            {!selectedWallet && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Available SUI Wallets:</div>
                {wallets.length === 0 ? (
                  <Alert className="bg-gray-50 border border-gray-200">
                    <AlertDescription>No SUI wallets installed</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-2">
                    {wallets.map((wallet) => (
                      <Button
                        key={wallet.name}
                        variant="outline"
                        className="w-full flex items-center justify-between hover:bg-gray-50 transition-all"
                        onClick={() => connectSuiWallet(wallet)}
                      >
                        <div className="flex items-center">
                          <img 
                            src={wallet.icon} 
                            alt={`${wallet.name} icon`} 
                            className="w-5 h-5 mr-2"
                          />
                          {wallet.name}
                        </div>
                        <div className="text-xs text-gray-500">v{wallet.version}</div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {}
          {(ethConnected || selectedWallet) && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              {ethConnected && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ethereum</span>
                  <span className="font-mono">
                    {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)} ({ethBalance} IBT)
                  </span>
                </div>
              )}
              {selectedWallet && selectedWallet.accounts[0] && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Sui</span>
                  <span className="font-mono">
                    {selectedWallet.accounts[0].address.slice(0, 6)}...
                    {selectedWallet.accounts[0].address.slice(-4)} ({suiBalance} IBT)
                  </span>
                </div>
              )}
            </div>
          )}

          {}
          <div className="w-full max-w-2xl mx-auto space-y-6">
            <Button
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 transition-all text-white"
              onClick={handleMintTokens}
              disabled={!amount || (sourceChain === 'ethereum' && !ethConnected) || (sourceChain === 'sui' && !selectedWallet)}
            >
              Mint Tokens
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select value={sourceChain} onValueChange={setSourceChain}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Source Chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="sui">Sui</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                onClick={swapChains}
                className="p-2 hover:bg-gray-100 rounded-full transition-all border-gray-200"
              >
                <ArrowLeftRight className="h-4 w-4 text-gray-600" />
              </Button>

              <div className="flex-1">
                <Select value={destinationChain} onValueChange={setDestinationChain}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Destination Chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="sui">Sui</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {renderBridgeInterface()}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition-all text-white"
              onClick={handleBridge}
              disabled={
                !amount ||
                (sourceChain === 'ethereum' && !ethConnected) ||
                (sourceChain === 'sui' && !selectedWallet)
              }
            >
              Bridge Tokens
            </Button>

            {status && (
              <Alert className="bg-gray-50 border border-gray-200">
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Bridge = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networks} defaultNetwork="localnet">
          <WalletProvider>
            <BridgeContent />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </div>
  );
};

export default Bridge;