// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PriceOracle {
    address public owner;
    mapping(bytes32 => uint256) private pricesUsdt;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PriceUpdated(bytes32 indexed assetId, uint256 priceUsdt);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setPriceUsdt(bytes32 assetId, uint256 priceUsdt) external onlyOwner {
        require(assetId != bytes32(0), "Invalid asset");
        require(priceUsdt > 0, "Invalid price");
        pricesUsdt[assetId] = priceUsdt;
        emit PriceUpdated(assetId, priceUsdt);
    }

    function setPricesUsdt(bytes32[] calldata assetIds, uint256[] calldata priceUsdtValues) external onlyOwner {
        require(assetIds.length == priceUsdtValues.length, "Length mismatch");
        for (uint256 i = 0; i < assetIds.length; i++) {
            require(assetIds[i] != bytes32(0), "Invalid asset");
            require(priceUsdtValues[i] > 0, "Invalid price");
            pricesUsdt[assetIds[i]] = priceUsdtValues[i];
            emit PriceUpdated(assetIds[i], priceUsdtValues[i]);
        }
    }

    function getPriceUsdt(bytes32 assetId) external view returns (uint256) {
        uint256 priceUsdt = pricesUsdt[assetId];
        require(priceUsdt > 0, "Price unavailable");
        return priceUsdt;
    }
}
