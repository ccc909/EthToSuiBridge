// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IBT is ERC20, Ownable {
    event BridgeInitiated(address indexed from, uint256 amount, string destinationChain, string destinationAddress);
    constructor() ERC20("Inter BlockChain Token", "IBT") Ownable(msg.sender) {}
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function initiatebridge(uint256 amount, string calldata suiAddresss) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _transfer(msg.sender, address(this), amount);
        
        emit BridgeInitiated(msg.sender, amount, "sui", suiAddresss);
    }
}