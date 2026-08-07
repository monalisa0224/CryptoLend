// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockToken
 * @notice Generic configurable ERC-20 mock for local demo collateral assets (BTC, SOL, etc.).
 * @dev `decimals` is immutable for gas efficiency.  `mint` has no access restriction
 *      to simplify demo wallet top-ups.  Do NOT deploy on a public network.
 */
contract MockToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals; // Set at construction; cannot change
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @param tokenName     Human-readable token name (e.g. "BTC").
     * @param tokenSymbol   Ticker symbol (e.g. "BTC").
     * @param tokenDecimals Precision used by this asset (8 for BTC, 9 for SOL).
     */
    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals) {
        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
    }

    /// @notice Mint `amount` tokens to `to`. Unrestricted for demo use.
    function mint(address to, uint256 amount) external {
        require(to != address(0), "Zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Allowance too low");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    /// @dev Shared transfer logic: validates recipient and sufficient balance.
    function _transfer(address from, address to, uint256 amount) private {
        require(to != address(0), "Zero address");
        require(balanceOf[from] >= amount, "Balance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
