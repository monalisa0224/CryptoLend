# CryptoLend

CryptoLend is a blockchain lending and staking demo for the CT124-3-3-BCD assignment. It uses Next.js for the frontend, Prisma + SQLite for local database history, Hardhat for the local blockchain, and Solidity smart contracts for the lending/staking protocol.

---

## Features

- Strategy home page with Lending and Staking.
- Supported collateral search for ETH, BTC, and Solana.
- Fetch live display prices from CoinGecko for each collateral.
- Borrow USDT using ETH, BTC, or Solana collateral.
- Track loan principal, accrued interest, and total debt.
- Repay USDT loans and withdraw collateral after full repayment.
- Stake USDT into the protocol and claim rewards.
- Unstake USDT principal and rewards.
- Admin can add liquidity to the pool and claim rewards.
- Admin can liquidate loan positions eligible for liquidation.
- Admin can claim reserve earnings.
- Stores borrow and staking history in SQLite.

---

## Assumptions

- Collateral prices are retrieved via the CoinGecko API. There may be a slight delay before price updates are reflected on the frontend.
- The Loan-to-Value (LTV) ratio differs for each collateral type.
- The borrowing interest rate is fixed at 4% p.a.
- A user can only have one active borrowing position at a time. The **Borrow USDT** button is disabled while a position is active.
- The staking interest rate is fixed at 3.5% p.a.
- Most system parameters are view-only. Modifying them requires updating the smart contract and redeploying, except for the collateral liquidation thresholds.
- Admin can only unstake deposited liquidity if the pool has sufficient liquidity.
- During liquidation:
  - The administrator liquidates up to 50% of the outstanding borrowing position per call.
  - The liquidator receives a fixed 5% liquidation bonus.
  - As a result, the liquidator receives collateral with a value slightly greater than the repaid debt.
- To refresh collateral values and health factors on the Trigger Liquidation page, run `npm run oracle:update` in a terminal first, then click **Refresh**. The smart contract can only read data already stored on-chain; asset prices are not updated automatically until the oracle update command is executed.

---

## Demo Token Mapping

The UI displays realistic asset names, but all assets are local Hardhat demo tokens:

| Display Name | Token |
|---|---|
| ETH | Hardhat local test ETH |
| USDT | MockUSDT (ERC-20) |
| BTC | MockBTC (ERC-20) |
| Solana | MockSOL (ERC-20) |

CoinGecko prices are used for frontend display only. The contract reads prices from the on-chain `PriceOracle` contract, which must be updated via `npm run oracle:update`.

---

## MetaMask Configuration

Add or switch to the Hardhat local network in MetaMask:

| Field | Value |
|---|---|
| Network name | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Currency symbol | ETH |

Import demo accounts from the `npm run hardhat:node` terminal output. The deployer account is the admin. Import demo tokens using the contract addresses printed by `npm run deploy:local`.

> **Note:** If a token address is entered in MetaMask but the symbol does not match, or MetaMask says the token has already been added, close the terminal and run `npm run deploy:local` twice to reset the addresses.

---

## Setup

```bash
# Terminal 1 - start local blockchain
npm run hardhat:node

# Terminal 2 - deploy contracts
npm run deploy:local

# Terminal 3 - start frontend
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Demo Account Flow - Users

### 1. Lending

Users lock ETH, BTC, or SOL as collateral to borrow USDT.

- Max LTV caps borrowing at a percentage of the collateral value (e.g. 70% for ETH).
- Borrowing interest is 4% p.a., accrued daily.

**Process:**

1. Select a collateral asset and enter the collateral amount.
2. Enter the loan amount.
3. Click **Borrow USDT** and confirm the transaction in MetaMask.

**Outcome:**

- Collateral moves from the user's wallet into the lending pool.
- USDT is credited to the user's wallet.

---

### 2. Repayment

Users repay their USDT loan in full or partially.

- The system shows remaining debt and health factor based on the entered amount.
- Collateral is released after the loan is fully repaid.

**Process:**

1. Enter the repayment amount and click **Repay**, then confirm in MetaMask.
2. If repaying the full loan, confirm a second MetaMask transaction to withdraw collateral.

**Outcome:**

- USDT is transferred from the user's wallet to the pool.
- Collateral is returned to the user's wallet once the loan is fully repaid.

---

### 3. Staking

Users stake USDT into the liquidity pool and earn passive yield at 3.5% p.a.

**Process:**

1. On the Staking page, enter the stake amount.
2. If USDT is not yet approved, click **Approve USDT** and confirm in MetaMask (one-time).
3. Click **Stake** and confirm in MetaMask.

**Outcome:**

- USDT transfers from the user's wallet to the pool.
- The staked balance begins accruing rewards immediately.
- A `STAKE` entry is recorded in the staking history.

---

### 4. Unstake

Users withdraw staked principal and all accrued rewards in one transaction.

**Process:**

1. On the Staking page, under **Your Position**, click **Unstake All** and confirm in MetaMask.

**Outcome:**

- Staked principal and all pending rewards are returned to the user's wallet.
- Staked balance resets to 0.
- An `UNSTAKE` entry is recorded in the staking history.

---

### 5. Claim Rewards

Users collect accrued staking rewards without touching their principal.

**Process:**

1. On the Staking page, under **Your Position**, click **Claim Rewards** and confirm in MetaMask.

**Outcome:**

- Pending rewards (3.5% p.a.) are credited to the user's wallet.
- Principal remains in the pool and continues earning.
- A `CLAIM` entry is recorded in the staking history.

---

## Demo Account Flow - Admin

Only the deployer wallet (used to deploy the smart contracts) can access the admin module.

### 1. Add Liquidity

Adds USDT funds to the pool to make them available for borrowing.

**Process:**

1. Under **Liquidity Pool Management -> Manage Liquidity**, enter the USDT amount.
2. If USDT is not yet approved, click **Approve USDT** and confirm in MetaMask.
3. Click **Add Liquidity** and confirm in MetaMask.

**Outcome:**

- USDT moves from the treasury wallet into the pool.
- The amount is recorded as the treasury's staked position (earning 3.5% p.a.).
- Total pool liquidity increases.

---

### 2. Withdraw Company Treasury

Treasury retrieves its staked principal and accrued staking interest.

**Process:**

1. Under **Liquidity Pool Management -> Withdrawal**, select **Company Treasury**.
2. Click **Unstake** and confirm in MetaMask.

**Outcome:**

- Treasury's staked principal and interest are returned to the treasury wallet.
- The liquidity guard blocks withdrawal if it would leave the pool unable to cover outstanding loans or breach the 30% liquidity buffer.

---

### 3. Withdraw Protocol Earnings

Admin collects protocol revenue accumulated from the borrower interest reserve factor.

**Process:**

1. Under **Liquidity Pool Management -> Withdrawal**, select **Protocol Reserve Earnings**.
2. Review: Total Reserve Collected (10% of all interest paid), Min Reserve Floor, and Claimable Reserve Earnings.
3. Click **Claim Reserve Earnings** and confirm in MetaMask.

**Outcome:**

- The claimable reserve (amount above the minimum floor) transfers to the treasury wallet.
- The reserve floor is preserved to safeguard future repayments.
- The liquidity guard ensures outstanding loans and the liquidity buffer remain protected.

---

### 4. Trigger Liquidation

Admin can liquidate under-collateralised borrowing positions.

**Health Factor classifications:**

| Health Factor | Status | Meaning |
|---|---|---|
| <= 1.1 | At Risk | Eligible for liquidation |
| 1.1 - 1.2 | Warning | High risk if prices continue declining |
| > 1.2 | Healthy | Safe under current conditions |

> **Refreshing data:** Run `npm run oracle:update` in a terminal first, then click **Refresh** on the page. The contract cannot auto-fetch live prices; prices are only updated on-chain when the oracle update command is executed.

**Process:**

1. On the **Trigger Liquidation** page, click **Liquidate** next to an at-risk position.
2. In the confirmation dialog, click **Confirm Liquidation**, then confirm in MetaMask.

**Outcome:**

- USDT is transferred from the admin wallet to the pool to cover the repaid debt.
- A portion of the borrower's collateral (plus the 5% liquidation bonus) is transferred to the admin wallet.
