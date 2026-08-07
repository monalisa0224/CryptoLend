# Smart Contract: PriceOracle

## File

- `contracts/PriceOracle.sol`

## Purpose

`PriceOracle` is a simple, owner-controlled on-chain price registry.
`LendingPool` queries it via the `IPriceOracle` interface for every collateral
valuation, so all borrow, liquidation, and LTV calculations use a single
authoritative price source.

## Design

- Prices are stored as **mUSDT units** (6 decimals) — e.g. `100_000_000` represents $100.00.
- An `owner` account (deployer) is the only address allowed to update prices.
- Ownership can be transferred, enabling a key rotation or hand-off to a multi-sig in a real deployment.

## Storage

```solidity
mapping(bytes32 => uint256) private pricesUsdt;
```

Keyed by `bytes32`-encoded asset symbol, e.g. `ethers.encodeBytes32String("ETH")`.

## Key Functions

### `setPriceUsdt(bytes32 assetId, uint256 priceUsdt)`

- Owner-only.
- Sets a single asset price.
- Reverts if `assetId` is zero or `priceUsdt` is zero.
- Emits `PriceUpdated`.

### `setPricesUsdt(bytes32[] assetIds, uint256[] priceUsdtValues)`

- Owner-only batch version.
- Used by `deploy.js` and `update-oracle-prices.js` to set ETH/BTC/SOL prices in one transaction.

### `getPriceUsdt(bytes32 assetId) → uint256`

- Called by `LendingPool` for every collateral valuation.
- Reverts with `"Price unavailable"` if the asset has never been set.

### `transferOwnership(address newOwner)`

- Allows rotating the oracle admin key.
- Emits `OwnershipTransferred`.

## Events

- `PriceUpdated(bytes32 indexed assetId, uint256 priceUsdt)` — emitted on every price write.
- `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)` — ownership change audit trail.

## Integration with LendingPool

`LendingPool` stores `priceOracle` as an immutable `IPriceOracle` reference set at deploy.
All price reads happen at runtime so the protocol automatically reflects oracle updates.

```solidity
interface IPriceOracle {
    function getPriceUsdt(bytes32 assetId) external view returns (uint256);
}
```

## Price Refresh

- **At deploy**: `deploy.js` fetches live prices from CoinGecko and sets them in the oracle.
- **On demand**: `scripts/update-oracle-prices.js` fetches fresh CoinGecko prices and sends a
  batch update transaction — useful for keeping the local demo in sync with real market rates.
- **Frontend**: `/api/prices` independently polls CoinGecko every 60 seconds for UI display.
  UI prices and oracle prices are **independent** — the oracle is the only source the contract trusts.
