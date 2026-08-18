// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PriceOracle
 * @notice Simple owner-controlled on-chain price registry.
 *         Prices are stored in mUSDT units (6 decimal places), e.g.
 *         100_000_000 represents $100.00.
 * @dev Deployed alongside LendingPool.  Only the `owner` can write prices;
 *      LendingPool reads prices via the `IPriceOracle` interface.
 *      In production, replace this with a Chainlink price feed adapter.
 */
contract PriceOracle {
    address public owner;
    // Asset prices keyed by bytes32-encoded symbol (e.g. ethers.encodeBytes32String("ETH")).
    mapping(bytes32 => uint256) private pricesUsdt;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    /// @dev Emitted whenever a price is written so off-chain monitors can track feed updates.
    event PriceUpdated(bytes32 indexed assetId, uint256 priceUsdt);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Transfer oracle ownership to a new admin address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Set the price for a single asset.
    function setPriceUsdt(bytes32 assetId, uint256 priceUsdt) external onlyOwner {
        require(assetId != bytes32(0), "Invalid asset");
        require(priceUsdt > 0, "Invalid price");
        pricesUsdt[assetId] = priceUsdt;
        emit PriceUpdated(assetId, priceUsdt);
    }

    /**
     * @notice Batch-set prices for multiple assets in a single transaction.
     * @dev Used by `deploy.js` and `update-oracle-prices.js` to seed/refresh all
     *      supported asset prices (ETH, BTC, SOL) efficiently.
     */
    function setPricesUsdt(bytes32[] calldata assetIds, uint256[] calldata priceUsdtValues) external onlyOwner {
        require(assetIds.length == priceUsdtValues.length, "Length mismatch");
        for (uint256 i = 0; i < assetIds.length; i++) {
            require(assetIds[i] != bytes32(0), "Invalid asset");
            require(priceUsdtValues[i] > 0, "Invalid price");
            pricesUsdt[assetIds[i]] = priceUsdtValues[i];
            emit PriceUpdated(assetIds[i], priceUsdtValues[i]);
        }
    }

    /**
     * @notice Return the current price for an asset.
     * @dev Reverts with "Price unavailable" if no price has been set for `assetId`.
     *      Called by LendingPool on every collateral valuation.
     */
    function getPriceUsdt(bytes32 assetId) external view returns (uint256) {
        uint256 priceUsdt = pricesUsdt[assetId];
        require(priceUsdt > 0, "Price unavailable");
        return priceUsdt;
    }
}
