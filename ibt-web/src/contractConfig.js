export const CONTRACT_CONFIG = {
    ethereum: {
      rpcUrl: "http://localhost:8545", // Default anvil URL
      contractAddress: "YOUR_ETHEREUM_CONTRACT_ADDRESS",
      abi: [
        "function mint(address to, uint256 amount) external",
        "function burn(address from, uint256 amount) external",
        "function balanceOf(address account) view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ]
    },
    sui: {
      rpcUrl: "http://localhost:9000", // Default sui local network
      packageId: "YOUR_SUI_PACKAGE_ID",
      bridgeAuthId: "YOUR_BRIDGE_AUTH_ID"
    }
  }