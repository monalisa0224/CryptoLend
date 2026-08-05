// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Token {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPriceOracle {
    function getPriceUsdt(bytes32 assetId) external view returns (uint256);
}

contract LendingPool {
    struct CollateralAsset {
        address token;
        uint8 decimals;
        uint256 ltvBps;
        uint256 liquidationThresholdBps;
        bool enabled;
    }

    struct LoanPosition {
        uint256 collateralWei;
        uint256 borrowedUsdt;
        uint256 updatedAt;
    }

    IERC20Token public immutable mockUsdt;
    IPriceOracle public immutable priceOracle;
    address public immutable treasury;

    uint256 public constant USDT_DECIMALS = 1e6;
    uint256 public constant ETH_DECIMALS = 1e18;
    uint256 public constant MAX_LTV_BPS = 7000;
    uint256 public constant INTEREST_BPS = 400;
    uint256 public constant STAKING_APY_BPS = 1200;
    uint256 public constant RESERVE_FACTOR_BPS = 1000;
    uint256 public constant LIQUIDATION_CLOSE_FACTOR_BPS = 5000;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant LIQUIDATION_HEALTH_FACTOR_BPS = 11000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant YEAR_SECONDS = 365 days;

    bool private locked;
    bytes32 public constant ETH_ASSET = bytes32("ETH");
    uint256 public ethLiquidationThresholdBps = 8500;
    mapping(address => LoanPosition) public positions;
    mapping(bytes32 => CollateralAsset) public collateralAssets;
    bytes32[] public collateralAssetIds;
    mapping(address => mapping(bytes32 => uint256)) public tokenCollateral;
    mapping(bytes32 => uint256) public totalTokenCollateral;
    mapping(address => uint256) public stakedUsdt;
    mapping(address => uint256) public lastRewardAt;
    uint256 public totalBorrowedUsdt;
    uint256 public totalStakedUsdt;
    uint256 public protocolReserveUsdt;
    uint256 public minReserveUsdt;
    uint256 public minLiquidityBufferBps = 3000;

    event Borrowed(
        address indexed borrower,
        uint256 collateralWei,
        uint256 borrowAmountUsdt,
        uint256 collateralValueUsdt,
        uint256 maxBorrowUsdt
    );
    event LiquidityFunded(address indexed funder, uint256 amountUsdt);
    event ProtocolReserveWithdrawn(address indexed treasury, uint256 amountUsdt);
    event MinReserveUpdated(uint256 minReserveUsdt);
    event LiquidityBufferUpdated(uint256 minLiquidityBufferBps);
    event CollateralAssetConfigured(bytes32 indexed assetId, address token, uint8 decimals, uint256 ltvBps, uint256 liquidationThresholdBps);
    event TokenBorrowed(address indexed borrower, bytes32 indexed assetId, uint256 collateralAmount, uint256 borrowAmountUsdt, uint256 collateralValueUsdt, uint256 maxBorrowUsdt);
    event Staked(address indexed investor, uint256 amountUsdt);
    event Unstaked(address indexed investor, uint256 amountUsdt);
    event RewardClaimed(address indexed investor, uint256 rewardUsdt);
    event Repaid(address indexed borrower, uint256 amountUsdt, uint256 interestPaidUsdt, uint256 principalPaidUsdt);
    event CollateralWithdrawn(address indexed borrower, uint256 ethCollateralWei);
    event LiquidationThresholdUpdated(bytes32 indexed assetId, uint256 liquidationThresholdBps);
    event Liquidated(address indexed liquidator, address indexed borrower, bytes32 indexed assetId, uint256 repayAmountUsdt, uint256 collateralSeized, uint256 bonusUsdt);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "Not treasury");
        _;
    }

    constructor(address mockUsdtAddress, address priceOracleAddress) {
        require(mockUsdtAddress != address(0), "Invalid USDT");
        require(priceOracleAddress != address(0), "Invalid oracle");
        mockUsdt = IERC20Token(mockUsdtAddress);
        priceOracle = IPriceOracle(priceOracleAddress);
        treasury = msg.sender;
    }

    function configureCollateralAsset(
        bytes32 assetId,
        address token,
        uint8 decimals_,
        uint256 ltvBps,
        uint256 liquidationThresholdBps_
    ) external onlyTreasury {
        require(assetId != bytes32(0), "Invalid asset");
        require(token != address(0), "Invalid token");
        require(ltvBps > 0 && ltvBps <= BPS_DENOMINATOR, "Invalid LTV");
        require(liquidationThresholdBps_ >= ltvBps && liquidationThresholdBps_ <= BPS_DENOMINATOR, "Invalid threshold");

        if (!collateralAssets[assetId].enabled) {
            collateralAssetIds.push(assetId);
        }

        collateralAssets[assetId] = CollateralAsset({
            token: token,
            decimals: decimals_,
            ltvBps: ltvBps,
            liquidationThresholdBps: liquidationThresholdBps_,
            enabled: true
        });

        emit CollateralAssetConfigured(assetId, token, decimals_, ltvBps, liquidationThresholdBps_);
    }

    function setEthLiquidationThresholdBps(uint256 liquidationThresholdBps_) external onlyTreasury {
        require(liquidationThresholdBps_ >= MAX_LTV_BPS && liquidationThresholdBps_ <= BPS_DENOMINATOR, "Invalid threshold");
        ethLiquidationThresholdBps = liquidationThresholdBps_;
        emit LiquidationThresholdUpdated(ETH_ASSET, liquidationThresholdBps_);
    }

    function setCollateralLiquidationThresholdBps(bytes32 assetId, uint256 liquidationThresholdBps_) external onlyTreasury {
        CollateralAsset storage asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        require(liquidationThresholdBps_ >= asset.ltvBps && liquidationThresholdBps_ <= BPS_DENOMINATOR, "Invalid threshold");
        asset.liquidationThresholdBps = liquidationThresholdBps_;
        emit LiquidationThresholdUpdated(assetId, liquidationThresholdBps_);
    }

    function setMinReserveUsdt(uint256 minReserveUsdt_) external onlyTreasury {
        minReserveUsdt = minReserveUsdt_;
        emit MinReserveUpdated(minReserveUsdt_);
    }

    function setMinLiquidityBufferBps(uint256 minLiquidityBufferBps_) external onlyTreasury {
        require(minLiquidityBufferBps_ <= BPS_DENOMINATOR, "Invalid buffer");
        minLiquidityBufferBps = minLiquidityBufferBps_;
        emit LiquidityBufferUpdated(minLiquidityBufferBps_);
    }

    function addLiquidity(uint256 usdtAmount) external onlyTreasury nonReentrant {
        require(usdtAmount > 0, "Liquidity required");
        require(mockUsdt.transferFrom(msg.sender, address(this), usdtAmount), "Liquidity transfer failed");
        _stake(msg.sender, usdtAmount);
        emit LiquidityFunded(msg.sender, usdtAmount);
    }

    function borrowWithEthCollateral(uint256 borrowAmountUsdt) external payable nonReentrant {
        require(msg.value > 0, "Collateral required");
        require(borrowAmountUsdt > 0, "Borrow amount required");
        require(positions[msg.sender].borrowedUsdt == 0, "Active loan exists");

        uint256 collateralValue = getCollateralValueUsdt(msg.value);
        uint256 maxBorrow = getMaxBorrowUsdt(msg.value);

        require(borrowAmountUsdt <= maxBorrow, "Exceeds max LTV");
        require(mockUsdt.balanceOf(address(this)) >= borrowAmountUsdt, "Pool liquidity low");
        require(mockUsdt.transfer(msg.sender, borrowAmountUsdt), "USDT transfer failed");

        LoanPosition storage position = positions[msg.sender];
        position.collateralWei += msg.value;
        position.borrowedUsdt += borrowAmountUsdt;
        position.updatedAt = block.timestamp;
        totalBorrowedUsdt += borrowAmountUsdt;

        emit Borrowed(msg.sender, msg.value, borrowAmountUsdt, collateralValue, maxBorrow);
    }

    function borrowWithTokenCollateral(
        bytes32 assetId,
        uint256 collateralAmount,
        uint256 borrowAmountUsdt
    ) external nonReentrant {
        CollateralAsset memory asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        require(collateralAmount > 0, "Collateral required");
        require(borrowAmountUsdt > 0, "Borrow amount required");
        require(positions[msg.sender].borrowedUsdt == 0, "Active loan exists");

        uint256 collateralValue = getTokenCollateralValueUsdt(assetId, collateralAmount);
        uint256 maxBorrow = (collateralValue * asset.ltvBps) / BPS_DENOMINATOR;

        require(borrowAmountUsdt <= maxBorrow, "Exceeds max LTV");
        require(mockUsdt.balanceOf(address(this)) >= borrowAmountUsdt, "Pool liquidity low");
        require(IERC20Token(asset.token).transferFrom(msg.sender, address(this), collateralAmount), "Collateral transfer failed");
        require(mockUsdt.transfer(msg.sender, borrowAmountUsdt), "USDT transfer failed");

        tokenCollateral[msg.sender][assetId] += collateralAmount;
        totalTokenCollateral[assetId] += collateralAmount;
        positions[msg.sender].borrowedUsdt += borrowAmountUsdt;
        positions[msg.sender].updatedAt = block.timestamp;
        totalBorrowedUsdt += borrowAmountUsdt;

        emit TokenBorrowed(msg.sender, assetId, collateralAmount, borrowAmountUsdt, collateralValue, maxBorrow);
    }

    function repayUsdt(uint256 amountUsdt) external nonReentrant {
        require(amountUsdt > 0, "Repay amount required");

        LoanPosition storage position = positions[msg.sender];
        require(position.borrowedUsdt > 0, "No active loan");

        uint256 interest = getAccruedInterestUsdt(msg.sender);
        uint256 totalDebt = position.borrowedUsdt + interest;
        require(amountUsdt <= totalDebt, "Repay exceeds debt");
        require(amountUsdt >= interest, "Repay interest first");
        require(mockUsdt.transferFrom(msg.sender, address(this), amountUsdt), "Repay transfer failed");

        uint256 interestPaid = amountUsdt > interest ? interest : amountUsdt;
        uint256 principalPaid = amountUsdt - interestPaid;
        protocolReserveUsdt += (interestPaid * RESERVE_FACTOR_BPS) / BPS_DENOMINATOR;

        if (principalPaid > 0) {
            position.borrowedUsdt -= principalPaid;
            totalBorrowedUsdt -= principalPaid;
        }

        position.updatedAt = block.timestamp;

        emit Repaid(msg.sender, amountUsdt, interestPaid, principalPaid);
    }

    function repayFullLoan() external nonReentrant {
        LoanPosition storage position = positions[msg.sender];
        require(position.borrowedUsdt > 0, "No active loan");

        uint256 interest = getAccruedInterestUsdt(msg.sender);
        uint256 principal = position.borrowedUsdt;
        uint256 totalDebt = principal + interest;
        protocolReserveUsdt += (interest * RESERVE_FACTOR_BPS) / BPS_DENOMINATOR;

        require(mockUsdt.transferFrom(msg.sender, address(this), totalDebt), "Repay transfer failed");

        position.borrowedUsdt = 0;
        position.updatedAt = block.timestamp;
        totalBorrowedUsdt -= principal;

        emit Repaid(msg.sender, totalDebt, interest, principal);
    }

    function liquidate(
        address borrower,
        bytes32 assetId,
        uint256 repayAmountUsdt
    ) external onlyTreasury nonReentrant {
        require(borrower != address(0), "Invalid borrower");
        require(borrower != msg.sender, "Cannot self liquidate");
        require(repayAmountUsdt > 0, "Repay amount required");

        LoanPosition storage position = positions[borrower];
        require(position.borrowedUsdt > 0, "No active loan");

        (,, uint256 totalDebt, uint256 healthFactorBps) = getBorrowerRiskData(borrower);
        require(healthFactorBps <= LIQUIDATION_HEALTH_FACTOR_BPS, "Position healthy");
        require(repayAmountUsdt <= totalDebt, "Repay exceeds debt");

        uint256 maxRepay = (totalDebt * LIQUIDATION_CLOSE_FACTOR_BPS) / BPS_DENOMINATOR;
        require(repayAmountUsdt <= maxRepay || repayAmountUsdt == totalDebt, "Exceeds close factor");

        (uint256 seizeAmount,, uint256 bonusUsdt) = previewLiquidation(borrower, assetId, repayAmountUsdt);

        require(mockUsdt.transferFrom(msg.sender, address(this), repayAmountUsdt), "Repay transfer failed");
        _applyDebtPayment(borrower, repayAmountUsdt);
        _seizeCollateral(borrower, msg.sender, assetId, seizeAmount);

        emit Liquidated(msg.sender, borrower, assetId, repayAmountUsdt, seizeAmount, bonusUsdt);
    }

    function _applyDebtPayment(address borrower, uint256 amountUsdt) private {
        LoanPosition storage position = positions[borrower];
        uint256 interest = getAccruedInterestUsdt(borrower);
        uint256 interestPaid = amountUsdt > interest ? interest : amountUsdt;
        uint256 principalPaid = amountUsdt - interestPaid;
        protocolReserveUsdt += (interestPaid * RESERVE_FACTOR_BPS) / BPS_DENOMINATOR;

        if (principalPaid > 0) {
            if (principalPaid >= position.borrowedUsdt) {
                totalBorrowedUsdt -= position.borrowedUsdt;
                position.borrowedUsdt = 0;
            } else {
                position.borrowedUsdt -= principalPaid;
                totalBorrowedUsdt -= principalPaid;
            }
        }

        position.updatedAt = block.timestamp;
    }

    function _seizeCollateral(address borrower, address liquidator, bytes32 assetId, uint256 seizeAmount) private {
        if (assetId == ETH_ASSET) {
            LoanPosition storage position = positions[borrower];
            require(seizeAmount <= position.collateralWei, "Insufficient collateral");
            position.collateralWei -= seizeAmount;
            (bool sent, ) = liquidator.call{value: seizeAmount}("");
            require(sent, "ETH transfer failed");
            return;
        }

        CollateralAsset memory asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        require(seizeAmount <= tokenCollateral[borrower][assetId], "Insufficient collateral");
        tokenCollateral[borrower][assetId] -= seizeAmount;
        totalTokenCollateral[assetId] -= seizeAmount;
        require(IERC20Token(asset.token).transfer(liquidator, seizeAmount), "Collateral transfer failed");
    }

    function withdrawAllCollateral() external nonReentrant {
        LoanPosition storage position = positions[msg.sender];
        require(position.borrowedUsdt == 0, "Repay loan first");

        uint256 ethCollateral = position.collateralWei;
        position.collateralWei = 0;
        position.updatedAt = block.timestamp;

        if (ethCollateral > 0) {
            (bool sent, ) = msg.sender.call{value: ethCollateral}("");
            require(sent, "ETH withdraw failed");
        }

        for (uint256 i = 0; i < collateralAssetIds.length; i++) {
            bytes32 assetId = collateralAssetIds[i];
            uint256 amount = tokenCollateral[msg.sender][assetId];
            if (amount == 0) continue;

            CollateralAsset memory asset = collateralAssets[assetId];
            tokenCollateral[msg.sender][assetId] = 0;
            totalTokenCollateral[assetId] -= amount;
            require(IERC20Token(asset.token).transfer(msg.sender, amount), "Token withdraw failed");
        }

        emit CollateralWithdrawn(msg.sender, ethCollateral);
    }

    function stakeUsdt(uint256 amountUsdt) external nonReentrant {
        require(amountUsdt > 0, "Stake amount required");
        require(mockUsdt.transferFrom(msg.sender, address(this), amountUsdt), "Stake transfer failed");
        _stake(msg.sender, amountUsdt);
    }

    function _stake(address user, uint256 amountUsdt) private {
        uint256 reward = pendingRewardUsdt(user);
        if (reward > 0) {
            require(mockUsdt.balanceOf(address(this)) >= reward, "Reward reserve low");
            require(mockUsdt.transfer(user, reward), "Reward transfer failed");
            emit RewardClaimed(user, reward);
        }
        stakedUsdt[user] += amountUsdt;
        totalStakedUsdt += amountUsdt;
        lastRewardAt[user] = block.timestamp;

        emit Staked(user, amountUsdt);
    }

    function unstakeUsdt(uint256 amountUsdt) external nonReentrant {
        require(amountUsdt > 0, "Unstake amount required");
        require(stakedUsdt[msg.sender] >= amountUsdt, "Insufficient stake");

        uint256 reward = pendingRewardUsdt(msg.sender);
        uint256 payout = amountUsdt + reward;
        require(mockUsdt.balanceOf(address(this)) >= payout, "Pool liquidity low");

        if (msg.sender == treasury) {
            _enforceLiquidityGuard(payout);
        }

        stakedUsdt[msg.sender] -= amountUsdt;
        totalStakedUsdt -= amountUsdt;
        lastRewardAt[msg.sender] = block.timestamp;

        require(mockUsdt.transfer(msg.sender, payout), "Unstake transfer failed");
        if (reward > 0) {
            emit RewardClaimed(msg.sender, reward);
        }
        emit Unstaked(msg.sender, amountUsdt);
    }

    function withdrawProtocolReserve(uint256 amountUsdt) external onlyTreasury nonReentrant {
        require(amountUsdt > 0, "Withdraw amount required");
        uint256 withdrawable = protocolReserveUsdt >= minReserveUsdt ? protocolReserveUsdt - minReserveUsdt : 0;
        require(amountUsdt <= withdrawable, "Reserve floor breached");
        _enforceLiquidityGuard(amountUsdt);

        protocolReserveUsdt -= amountUsdt;
        require(mockUsdt.transfer(msg.sender, amountUsdt), "Withdraw transfer failed");

        emit ProtocolReserveWithdrawn(msg.sender, amountUsdt);
    }

    function _enforceLiquidityGuard(uint256 outflowUsdt) private view {
        uint256 poolBalance = mockUsdt.balanceOf(address(this));
        uint256 available = poolBalance >= protocolReserveUsdt ? poolBalance - protocolReserveUsdt : 0;
        require(outflowUsdt <= available, "Withdrawal exceeds available liquidity");

        uint256 availableAfter = available - outflowUsdt;
        require(availableAfter >= totalBorrowedUsdt, "Withdrawal leaves pool unable to cover loans");
        require(availableAfter >= (poolBalance * minLiquidityBufferBps) / BPS_DENOMINATOR, "Withdrawal breaches liquidity buffer");
    }

    function claimRewards() external nonReentrant {
        uint256 reward = pendingRewardUsdt(msg.sender);
        require(reward > 0, "No rewards");
        require(mockUsdt.balanceOf(address(this)) >= reward, "Reward reserve low");

        lastRewardAt[msg.sender] = block.timestamp;
        require(mockUsdt.transfer(msg.sender, reward), "Reward transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    function pendingRewardUsdt(address investor) public view returns (uint256) {
        uint256 principal = stakedUsdt[investor];
        if (principal == 0 || lastRewardAt[investor] == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - lastRewardAt[investor];
        return (principal * STAKING_APY_BPS * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    }

    function getAccruedInterestUsdt(address borrower) public view returns (uint256) {
        LoanPosition memory position = positions[borrower];
        if (position.borrowedUsdt == 0 || position.updatedAt == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - position.updatedAt;
        return (position.borrowedUsdt * INTEREST_BPS * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    }

    function getTotalDebtUsdt(address borrower) public view returns (uint256) {
        LoanPosition memory position = positions[borrower];
        return position.borrowedUsdt + getAccruedInterestUsdt(borrower);
    }

    function getBorrowerRiskData(address borrower) public view returns (
        uint256 collateralValueUsdt,
        uint256 liquidationValueUsdt,
        uint256 debtUsdt,
        uint256 healthFactorBps
    ) {
        LoanPosition memory position = positions[borrower];

        if (position.collateralWei > 0) {
            uint256 ethValue = getCollateralValueUsdt(position.collateralWei);
            collateralValueUsdt += ethValue;
            liquidationValueUsdt += (ethValue * ethLiquidationThresholdBps) / BPS_DENOMINATOR;
        }

        for (uint256 i = 0; i < collateralAssetIds.length; i++) {
            bytes32 assetId = collateralAssetIds[i];
            uint256 amount = tokenCollateral[borrower][assetId];
            if (amount == 0) continue;

            CollateralAsset memory asset = collateralAssets[assetId];
            uint256 tokenValue = getTokenCollateralValueUsdt(assetId, amount);
            collateralValueUsdt += tokenValue;
            liquidationValueUsdt += (tokenValue * asset.liquidationThresholdBps) / BPS_DENOMINATOR;
        }

        debtUsdt = getTotalDebtUsdt(borrower);
        healthFactorBps = debtUsdt > 0 ? (liquidationValueUsdt * BPS_DENOMINATOR) / debtUsdt : type(uint256).max;
    }

    function previewLiquidation(
        address borrower,
        bytes32 assetId,
        uint256 repayAmountUsdt
    ) public view returns (
        uint256 seizeAmount,
        uint256 seizeValueUsdt,
        uint256 bonusUsdt
    ) {
        require(repayAmountUsdt > 0, "Repay amount required");
        bonusUsdt = (repayAmountUsdt * LIQUIDATION_BONUS_BPS) / BPS_DENOMINATOR;
        seizeValueUsdt = repayAmountUsdt + bonusUsdt;

        if (assetId == ETH_ASSET) {
            seizeAmount = (seizeValueUsdt * ETH_DECIMALS) / priceOracle.getPriceUsdt(ETH_ASSET);
            require(seizeAmount <= positions[borrower].collateralWei, "Insufficient collateral");
            return (seizeAmount, seizeValueUsdt, bonusUsdt);
        }

        CollateralAsset memory asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        seizeAmount = (seizeValueUsdt * (10 ** asset.decimals)) / priceOracle.getPriceUsdt(assetId);
        require(seizeAmount <= tokenCollateral[borrower][assetId], "Insufficient collateral");
    }

    function getCollateralValueUsdt(uint256 collateralWei) public view returns (uint256) {
        return (collateralWei * priceOracle.getPriceUsdt(ETH_ASSET)) / ETH_DECIMALS;
    }

    function getMaxBorrowUsdt(uint256 collateralWei) public view returns (uint256) {
        return (getCollateralValueUsdt(collateralWei) * MAX_LTV_BPS) / BPS_DENOMINATOR;
    }

    function getTokenCollateralValueUsdt(bytes32 assetId, uint256 collateralAmount) public view returns (uint256) {
        CollateralAsset memory asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        return (collateralAmount * priceOracle.getPriceUsdt(assetId)) / (10 ** asset.decimals);
    }

    function getTokenMaxBorrowUsdt(bytes32 assetId, uint256 collateralAmount) public view returns (uint256) {
        CollateralAsset memory asset = collateralAssets[assetId];
        require(asset.enabled, "Unsupported collateral");
        return (getTokenCollateralValueUsdt(assetId, collateralAmount) * asset.ltvBps) / BPS_DENOMINATOR;
    }

    function getPoolLiquidityUsdt() external view returns (uint256) {
        return mockUsdt.balanceOf(address(this));
    }

    function getAvailableLiquidityUsdt() external view returns (uint256) {
        uint256 balance = mockUsdt.balanceOf(address(this));
        return balance >= protocolReserveUsdt ? balance - protocolReserveUsdt : 0;
    }

    function getCompanyTreasuryUsdt() public view returns (uint256) {
        uint256 withdrawableReserve = protocolReserveUsdt >= minReserveUsdt ? protocolReserveUsdt - minReserveUsdt : 0;
        return stakedUsdt[treasury] + pendingRewardUsdt(treasury) + withdrawableReserve;
    }

    receive() external payable {}
}
