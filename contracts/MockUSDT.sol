// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockUSDT
 * @notice Minimal ERC-20 mock token representing USDT (6 decimals) for local demo use.
 * @dev There is intentionally no `onlyOwner` restriction on `mint` so any demo
 *      account can top up balances without extra setup.  Do NOT deploy this on
 *      a public network.
 */
contract MockUSDT {
    string public name = "USDT";
    string public symbol = "USDT";
    uint8 public constant decimals = 6; // Matches real USDT precision
    uint256 public totalSupply;

    // Per-address balances and ERC-20 spending allowances.
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Mint `amount` tokens directly to `to`. No access restriction for demo convenience.
    function mint(address to, uint256 amount) external {
        require(to != address(0), "Zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Standard ERC-20 transfer from caller to `to`.
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice Approve `spender` to spend up to `amount` on behalf of caller.
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Transfer `amount` from `from` to `to` using caller\'s allowance.
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
