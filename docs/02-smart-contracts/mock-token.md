# Smart Contract: MockToken

## File

- `contracts/MockToken.sol`

## Purpose

`MockToken` is a generic ERC-20-like token used to simulate alternative collateral assets
(e.g. BTC, SOL) for local development. Unlike `MockUSDT`, its `name`, `symbol`, and `decimals`
are configurable at deploy time so a single contract can represent any asset.

## Constructor

```solidity
constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals)
```

- Sets `name`, `symbol`, and `decimals` via constructor arguments.
- Does **not** mint any initial supply; the deployment script calls `mint()` after deployment.

## Token Configuration

| Property   | Source                           |
| ---------- | -------------------------------- |
| `name`     | Constructor argument             |
| `symbol`   | Constructor argument             |
| `decimals` | Constructor argument (immutable) |

Current deployment examples:

- `MockToken("BTC", "BTC", 8)` — 8-decimal BTC stand-in.
- `MockToken("Solana", "SOL", 9)` — 9-decimal SOL stand-in.

## Key Differences from MockUSDT

- `decimals` is `immutable` (set in constructor, gas-optimised).
- No `owner` restriction on `mint()` — **any caller** can mint in the local dev environment.
  This is intentional for demo purposes and must **not** be used in production.
- `name` and `symbol` are state variables, not hard-coded strings.

## Exposed Behaviour

- `mint(to, amount)`: unrestricted mint for demo wallets.
- `transfer(to, amount)`: direct transfer.
- `approve(spender, amount)`: set allowance.
- `transferFrom(from, to, amount)`: spend allowance and transfer.

## How It Is Used in CryptoLend

- Deployment script mints BTC and SOL balances to deployer, borrower, and demo accounts.
- Borrower approves `LendingPool` as spender before calling `borrowWithTokenCollateral()`.
- `LendingPool` uses `transferFrom` to pull token collateral in and `transfer` to return it on repay/withdrawal.
