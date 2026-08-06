const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("LendingPool", function () {
  async function deployFixture() {
    const [deployer, borrower, liquidator] = await ethers.getSigners();
    const parseUsdt = (value) => ethers.parseUnits(value, 6);
    const parseBtc = (value) => ethers.parseUnits(value, 8);
    const parseSol = (value) => ethers.parseUnits(value, 9);
    const assetId = (symbol) => ethers.encodeBytes32String(symbol);

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUsdt = await MockUSDT.deploy();

    const MockToken = await ethers.getContractFactory("MockToken");
    const mockBtc = await MockToken.deploy("BTC", "BTC", 8);
    const mockSol = await MockToken.deploy("Solana", "SOL", 9);

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.deploy(await mockUsdt.getAddress(), await priceOracle.getAddress());

    await mockUsdt.mint(deployer.address, parseUsdt("25000"));
    await mockUsdt.mint(borrower.address, parseUsdt("10000"));
    await mockUsdt.mint(liquidator.address, parseUsdt("10000"));
    await mockBtc.mint(borrower.address, parseBtc("1"));
    await mockSol.mint(borrower.address, parseSol("100"));
    await mockUsdt.transfer(await lendingPool.getAddress(), parseUsdt("5000"));
    await deployer.sendTransaction({
      to: await lendingPool.getAddress(),
      value: ethers.parseEther("1000")
    });
    await priceOracle.setPricesUsdt([assetId("ETH"), assetId("BTC"), assetId("SOL")], [parseUsdt("100"), parseUsdt("65000"), parseUsdt("150")]);
    await lendingPool.configureCollateralAsset(assetId("BTC"), await mockBtc.getAddress(), 8, 7000, 8500);
    await lendingPool.configureCollateralAsset(assetId("SOL"), await mockSol.getAddress(), 9, 6500, 8000);

    return { deployer, borrower, liquidator, mockUsdt, mockBtc, mockSol, priceOracle, lendingPool, parseUsdt, parseBtc, parseSol, assetId };
  }

  it("deploys MockUSDT and LendingPool with funded liquidity", async function () {
    const { lendingPool, mockUsdt, parseUsdt } = await loadFixture(deployFixture);

    expect(await mockUsdt.balanceOf(await lendingPool.getAddress())).to.equal(parseUsdt("5000"));
    expect(await lendingPool.getPoolLiquidityUsdt()).to.equal(parseUsdt("5000"));
    expect(await ethers.provider.getBalance(await lendingPool.getAddress())).to.equal(ethers.parseEther("1000"));
  });

  it("lets account2 borrow within 70% LTV using ETH collateral", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const collateral = ethers.parseEther("0.01");
    const borrowAmount = parseUsdt("0.7");

    await expect(
      lendingPool.connect(borrower).borrowWithEthCollateral(borrowAmount, { value: collateral })
    ).to.emit(lendingPool, "Borrowed");

    const position = await lendingPool.positions(borrower.address);
    expect(position.collateralWei).to.equal(collateral);
    expect(position.borrowedUsdt).to.equal(borrowAmount);
    expect(await mockUsdt.balanceOf(borrower.address)).to.equal(parseUsdt("10000.7"));
    expect(await ethers.provider.getBalance(await lendingPool.getAddress())).to.equal(ethers.parseEther("1000.01"));
    expect(await lendingPool.totalBorrowedUsdt()).to.equal(borrowAmount);
  });

  it("rejects borrow requests above max LTV", async function () {
    const { borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await expect(
      lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.71"), {
        value: ethers.parseEther("0.01")
      })
    ).to.be.revertedWith("Exceeds max LTV");
  });

  it("rejects borrow when pool has insufficient MockUSDT liquidity", async function () {
    const { borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await expect(
      lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("7000"), {
        value: ethers.parseEther("1000")
      })
    ).to.be.revertedWith("Pool liquidity low");
  });

  it("lets account2 borrow with BTC collateral after approval", async function () {
    const { borrower, mockUsdt, mockBtc, lendingPool, parseUsdt, parseBtc, assetId } = await loadFixture(deployFixture);
    const collateral = parseBtc("0.01");
    const borrowAmount = parseUsdt("450");

    await mockBtc.connect(borrower).approve(await lendingPool.getAddress(), collateral);

    await expect(
      lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("BTC"), collateral, borrowAmount)
    ).to.emit(lendingPool, "TokenBorrowed");

    expect(await lendingPool.tokenCollateral(borrower.address, assetId("BTC"))).to.equal(collateral);
    expect(await mockUsdt.balanceOf(borrower.address)).to.equal(parseUsdt("10450"));
  });

  it("lets account2 borrow with Solana collateral after approval", async function () {
    const { borrower, mockUsdt, mockSol, lendingPool, parseUsdt, parseSol, assetId } = await loadFixture(deployFixture);
    const collateral = parseSol("10");
    const borrowAmount = parseUsdt("900");

    await mockSol.connect(borrower).approve(await lendingPool.getAddress(), collateral);

    await expect(
      lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("SOL"), collateral, borrowAmount)
    ).to.emit(lendingPool, "TokenBorrowed");

    expect(await lendingPool.tokenCollateral(borrower.address, assetId("SOL"))).to.equal(collateral);
    expect(await mockUsdt.balanceOf(borrower.address)).to.equal(parseUsdt("10900"));
  });

  it("rejects token collateral borrow above LTV", async function () {
    const { borrower, mockBtc, lendingPool, parseUsdt, parseBtc, assetId } = await loadFixture(deployFixture);
    const collateral = parseBtc("0.01");

    await mockBtc.connect(borrower).approve(await lendingPool.getAddress(), collateral);

    await expect(
      lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("BTC"), collateral, parseUsdt("456"))
    ).to.be.revertedWith("Exceeds max LTV");
  });

  it("rejects a second ETH borrow while the borrower has an active loan", async function () {
    const { borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });

    await expect(
      lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Active loan exists");
  });

  it("rejects token collateral borrowing while the borrower has an active ETH loan", async function () {
    const { borrower, mockBtc, lendingPool, parseUsdt, parseBtc, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await mockBtc.connect(borrower).approve(await lendingPool.getAddress(), parseBtc("0.01"));

    await expect(
      lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("BTC"), parseBtc("0.01"), parseUsdt("450"))
    ).to.be.revertedWith("Active loan exists");
  });

  it("uses the oracle price for collateral valuation", async function () {
    const { borrower, priceOracle, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await priceOracle.setPriceUsdt(assetId("ETH"), parseUsdt("200"));

    expect(await lendingPool.getCollateralValueUsdt(ethers.parseEther("0.01"))).to.equal(parseUsdt("2"));
    await expect(
      lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("1.4"), { value: ethers.parseEther("0.01") })
    ).to.emit(lendingPool, "Borrowed");
  });

  it("accrues interest and lets a borrower repay the full ETH loan", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const collateral = ethers.parseEther("0.01");
    const borrowAmount = parseUsdt("0.7");

    await lendingPool.connect(borrower).borrowWithEthCollateral(borrowAmount, { value: collateral });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const interest = await lendingPool.getAccruedInterestUsdt(borrower.address);
    expect(interest).to.be.greaterThanOrEqual(parseUsdt("0.028"));
    expect(interest).to.be.lessThan(parseUsdt("0.0281"));

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));

    await expect(lendingPool.connect(borrower).repayFullLoan()).to.emit(lendingPool, "Repaid");

    const position = await lendingPool.positions(borrower.address);
    expect(position.borrowedUsdt).to.equal(0);
    expect(await lendingPool.totalBorrowedUsdt()).to.equal(0);
  });

  it("accrues borrower interest by completed days only", async function () {
    const { borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("1000"), { value: ethers.parseEther("15") });
    await ethers.provider.send("evm_increaseTime", [23 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    expect(await lendingPool.getAccruedInterestUsdt(borrower.address)).to.equal(0);

    await ethers.provider.send("evm_increaseTime", [60 * 60]);
    await ethers.provider.send("evm_mine");
    expect(await lendingPool.getAccruedInterestUsdt(borrower.address)).to.equal(parseUsdt("0.109589"));

    await ethers.provider.send("evm_increaseTime", [29 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    expect(await lendingPool.getAccruedInterestUsdt(borrower.address)).to.equal(parseUsdt("3.287671"));
  });

  it("rejects repayment that does not cover accrued interest", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), parseUsdt("0.01"));

    await expect(lendingPool.connect(borrower).repayUsdt(parseUsdt("0.01"))).to.be.revertedWith("Repay interest first");
  });

  it("lets a borrower withdraw ETH collateral after full repayment", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const collateral = ethers.parseEther("0.01");

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: collateral });
    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();

    await expect(lendingPool.connect(borrower).withdrawAllCollateral()).to.emit(lendingPool, "CollateralWithdrawn");
    const position = await lendingPool.positions(borrower.address);
    expect(position.collateralWei).to.equal(0);
  });

  it("lets a borrower withdraw BTC and Solana collateral after full repayment", async function () {
    const { borrower, mockUsdt, mockBtc, mockSol, lendingPool, parseUsdt, parseBtc, parseSol, assetId } = await loadFixture(deployFixture);

    await mockBtc.connect(borrower).approve(await lendingPool.getAddress(), parseBtc("0.01"));
    await lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("BTC"), parseBtc("0.01"), parseUsdt("450"));
    let totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();
    await lendingPool.connect(borrower).withdrawAllCollateral();

    await mockSol.connect(borrower).approve(await lendingPool.getAddress(), parseSol("10"));
    await lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("SOL"), parseSol("10"), parseUsdt("900"));
    totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();
    await lendingPool.connect(borrower).withdrawAllCollateral();

    expect(await lendingPool.tokenCollateral(borrower.address, assetId("BTC"))).to.equal(0);
    expect(await lendingPool.tokenCollateral(borrower.address, assetId("SOL"))).to.equal(0);
    expect(await mockBtc.balanceOf(borrower.address)).to.equal(parseBtc("1"));
    expect(await mockSol.balanceOf(borrower.address)).to.equal(parseSol("100"));
  });

  it("rejects liquidation while a position is healthy", async function () {
    const { deployer, borrower, mockUsdt, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await mockUsdt.connect(deployer).approve(await lendingPool.getAddress(), parseUsdt("0.35"));

    await expect(
      lendingPool.connect(deployer).liquidate(borrower.address, assetId("ETH"), parseUsdt("0.35"))
    ).to.be.revertedWith("Position healthy");
  });

  it("lets treasury liquidate when health factor is at or below 1.1", async function () {
    const { deployer, borrower, mockUsdt, priceOracle, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await priceOracle.setPriceUsdt(assetId("ETH"), parseUsdt("90"));

    const [, , , healthFactorBps] = await lendingPool.getBorrowerRiskData(borrower.address);
    expect(healthFactorBps).to.be.lessThanOrEqual(11000n);

    await mockUsdt.connect(deployer).approve(await lendingPool.getAddress(), parseUsdt("0.35"));
    await expect(
      lendingPool.connect(deployer).liquidate(borrower.address, assetId("ETH"), parseUsdt("0.35"))
    ).to.emit(lendingPool, "Liquidated");
  });

  it("rejects non-treasury liquidation", async function () {
    const { borrower, liquidator, mockUsdt, priceOracle, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await priceOracle.setPriceUsdt(assetId("ETH"), parseUsdt("80"));
    await mockUsdt.connect(liquidator).approve(await lendingPool.getAddress(), parseUsdt("0.35"));

    await expect(
      lendingPool.connect(liquidator).liquidate(borrower.address, assetId("ETH"), parseUsdt("0.35"))
    ).to.be.revertedWith("Not treasury");
  });

  it("lets treasury repay risky ETH debt and receive bonus collateral", async function () {
    const { deployer, borrower, mockUsdt, priceOracle, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await priceOracle.setPriceUsdt(assetId("ETH"), parseUsdt("80"));

    const repayAmount = parseUsdt("0.35");
    const [seizeAmount, seizeValue, bonus] = await lendingPool.previewLiquidation(borrower.address, assetId("ETH"), repayAmount);
    expect(seizeValue).to.equal(parseUsdt("0.3675"));
    expect(bonus).to.equal(parseUsdt("0.0175"));

    const beforeBalance = await mockUsdt.balanceOf(deployer.address);
    await mockUsdt.connect(deployer).approve(await lendingPool.getAddress(), repayAmount);
    await expect(
      lendingPool.connect(deployer).liquidate(borrower.address, assetId("ETH"), repayAmount)
    ).to.emit(lendingPool, "Liquidated");

    const position = await lendingPool.positions(borrower.address);
    expect(position.borrowedUsdt).to.equal(parseUsdt("0.35"));
    expect(position.collateralWei).to.equal(ethers.parseEther("0.01") - seizeAmount);
    expect(await mockUsdt.balanceOf(deployer.address)).to.equal(beforeBalance - repayAmount);
  });

  it("lets treasury repay risky token debt and receive bonus collateral", async function () {
    const { deployer, borrower, mockUsdt, mockBtc, priceOracle, lendingPool, parseUsdt, parseBtc, assetId } = await loadFixture(deployFixture);
    const collateral = parseBtc("0.01");
    const borrowAmount = parseUsdt("450");

    await mockBtc.connect(borrower).approve(await lendingPool.getAddress(), collateral);
    await lendingPool.connect(borrower).borrowWithTokenCollateral(assetId("BTC"), collateral, borrowAmount);
    await priceOracle.setPriceUsdt(assetId("BTC"), parseUsdt("50000"));

    const repayAmount = parseUsdt("225");
    const [seizeAmount] = await lendingPool.previewLiquidation(borrower.address, assetId("BTC"), repayAmount);

    await mockUsdt.connect(deployer).approve(await lendingPool.getAddress(), repayAmount);
    await expect(
      lendingPool.connect(deployer).liquidate(borrower.address, assetId("BTC"), repayAmount)
    ).to.emit(lendingPool, "Liquidated");

    expect(await lendingPool.tokenCollateral(borrower.address, assetId("BTC"))).to.equal(collateral - seizeAmount);
    expect(await mockBtc.balanceOf(deployer.address)).to.equal(seizeAmount);
    expect((await lendingPool.positions(borrower.address)).borrowedUsdt).to.be.closeTo(parseUsdt("225"), 2n);
  });

  it("rejects non-treasury liquidity funding", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), parseUsdt("100"));

    await expect(lendingPool.connect(borrower).addLiquidity(parseUsdt("100"))).to.be.revertedWith("Not treasury");
  });

  it("lets treasury add USDT liquidity", async function () {
    const { deployer, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    await mockUsdt.approve(await lendingPool.getAddress(), parseUsdt("100"));

    await expect(lendingPool.connect(deployer).addLiquidity(parseUsdt("100"))).to.emit(lendingPool, "LiquidityFunded");
    expect(await lendingPool.getPoolLiquidityUsdt()).to.equal(parseUsdt("5100"));
  });

  it("lets an investor stake mUSDT after approving the pool", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const stakeAmount = parseUsdt("100");

    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), stakeAmount);

    await expect(lendingPool.connect(borrower).stakeUsdt(stakeAmount))
      .to.emit(lendingPool, "Staked")
      .withArgs(borrower.address, stakeAmount);

    expect(await lendingPool.stakedUsdt(borrower.address)).to.equal(stakeAmount);
    expect(await lendingPool.totalStakedUsdt()).to.equal(stakeAmount);
    expect(await mockUsdt.balanceOf(borrower.address)).to.equal(parseUsdt("9900"));
  });

  it("rejects staking more mUSDT than the wallet balance", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const stakeAmount = parseUsdt("10001");

    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), stakeAmount);

    await expect(lendingPool.connect(borrower).stakeUsdt(stakeAmount)).to.be.revertedWith("Balance too low");
  });

  it("lets an investor claim rewards", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const stakeAmount = parseUsdt("1000");

    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), stakeAmount);
    await lendingPool.connect(borrower).stakeUsdt(stakeAmount);
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const reward = await lendingPool.pendingRewardUsdt(borrower.address);
    expect(reward).to.be.greaterThanOrEqual(parseUsdt("35"));
    expect(reward).to.be.lessThan(parseUsdt("35.01"));

    await expect(lendingPool.connect(borrower).claimRewards()).to.emit(lendingPool, "RewardClaimed");

    const borrowerBalance = await mockUsdt.balanceOf(borrower.address);
    expect(borrowerBalance).to.be.greaterThanOrEqual(parseUsdt("9035"));
    expect(borrowerBalance).to.be.lessThan(parseUsdt("9035.01"));
  });

  it("lets an investor unstake principal and rewards", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);
    const stakeAmount = parseUsdt("1000");

    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), stakeAmount);
    await lendingPool.connect(borrower).stakeUsdt(stakeAmount);
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await expect(lendingPool.connect(borrower).unstakeUsdt(stakeAmount)).to.emit(lendingPool, "Unstaked");

    expect(await lendingPool.stakedUsdt(borrower.address)).to.equal(0);
    expect(await lendingPool.totalStakedUsdt()).to.equal(0);
    const borrowerBalance = await mockUsdt.balanceOf(borrower.address);
    expect(borrowerBalance).to.be.greaterThanOrEqual(parseUsdt("10035"));
    expect(borrowerBalance).to.be.lessThan(parseUsdt("10035.01"));
  });

  it("accumulates protocol reserve from repayUsdt interest", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt);
    await lendingPool.connect(borrower).repayUsdt(totalDebt);

    expect(await lendingPool.protocolReserveUsdt()).to.equal(parseUsdt("0.0028"));
  });

  it("accumulates protocol reserve from repayFullLoan interest", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();

    expect(await lendingPool.protocolReserveUsdt()).to.equal(parseUsdt("0.0028"));
  });

  it("accumulates protocol reserve from liquidation interest", async function () {
    const { deployer, borrower, mockUsdt, priceOracle, lendingPool, parseUsdt, assetId } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await priceOracle.setPriceUsdt(assetId("ETH"), parseUsdt("90"));
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await mockUsdt.connect(deployer).approve(await lendingPool.getAddress(), parseUsdt("0.35"));
    await lendingPool.connect(deployer).liquidate(borrower.address, assetId("ETH"), parseUsdt("0.35"));

    expect(await lendingPool.protocolReserveUsdt()).to.equal(parseUsdt("0.0028"));
  });

  it("lets the treasury withdraw claimable reserve earnings", async function () {
    const { deployer, borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();

    await expect(lendingPool.connect(deployer).withdrawProtocolReserve(parseUsdt("0.0028"))).to.emit(lendingPool, "ProtocolReserveWithdrawn");
    expect(await lendingPool.protocolReserveUsdt()).to.equal(0);
  });

  it("rejects reserve withdrawal that breaches the min reserve floor", async function () {
    const { deployer, borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();

    await expect(
      lendingPool.connect(deployer).withdrawProtocolReserve(parseUsdt("0.0029"))
    ).to.be.revertedWith("Reserve floor breached");
  });

  it("rejects non-treasury reserve withdrawal", async function () {
    const { borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await expect(lendingPool.connect(borrower).withdrawProtocolReserve(parseUsdt("1"))).to.be.revertedWith("Not treasury");
  });

  it("only lets the treasury update min reserve and liquidity buffer", async function () {
    const { deployer, borrower, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await expect(lendingPool.connect(deployer).setMinReserveUsdt(parseUsdt("100")))
      .to.emit(lendingPool, "MinReserveUpdated")
      .withArgs(parseUsdt("100"));
    expect(await lendingPool.minReserveUsdt()).to.equal(parseUsdt("100"));

    await expect(lendingPool.connect(deployer).setMinLiquidityBufferBps(5000))
      .to.emit(lendingPool, "LiquidityBufferUpdated")
      .withArgs(5000n);
    expect(await lendingPool.minLiquidityBufferBps()).to.equal(5000n);

    await expect(lendingPool.connect(borrower).setMinReserveUsdt(parseUsdt("1"))).to.be.revertedWith("Not treasury");
    await expect(lendingPool.connect(borrower).setMinLiquidityBufferBps(5000)).to.be.revertedWith("Not treasury");
  });

  it("addLiquidity stakes the treasury and reports company treasury value", async function () {
    const { deployer, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await mockUsdt.approve(await lendingPool.getAddress(), parseUsdt("1000"));
    await lendingPool.connect(deployer).addLiquidity(parseUsdt("1000"));

    expect(await lendingPool.stakedUsdt(deployer.address)).to.equal(parseUsdt("1000"));
    expect(await lendingPool.totalStakedUsdt()).to.equal(parseUsdt("1000"));

    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    expect(await lendingPool.pendingRewardUsdt(deployer.address)).to.equal(parseUsdt("35"));
    expect(await lendingPool.getCompanyTreasuryUsdt()).to.equal(parseUsdt("1035"));
  });

  it("excludes the protocol reserve from available liquidity", async function () {
    const { borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("0.7"), { value: ethers.parseEther("0.01") });
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const totalDebt = await lendingPool.getTotalDebtUsdt(borrower.address);
    await mockUsdt.connect(borrower).approve(await lendingPool.getAddress(), totalDebt + parseUsdt("1"));
    await lendingPool.connect(borrower).repayFullLoan();

    const poolBalance = await mockUsdt.balanceOf(await lendingPool.getAddress());
    expect(await lendingPool.getAvailableLiquidityUsdt()).to.equal(poolBalance - parseUsdt("0.0028"));
  });

  it("rejects a treasury unstake that breaches the liquidity buffer", async function () {
    const { deployer, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await mockUsdt.approve(await lendingPool.getAddress(), parseUsdt("1000"));
    await lendingPool.connect(deployer).addLiquidity(parseUsdt("1000"));
    await lendingPool.connect(deployer).setMinLiquidityBufferBps(9500);

    await expect(lendingPool.connect(deployer).unstakeUsdt(parseUsdt("1000"))).to.be.revertedWith("Withdrawal breaches liquidity buffer");
  });

  it("rejects a treasury unstake that leaves the pool unable to cover loans", async function () {
    const { deployer, borrower, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await mockUsdt.approve(await lendingPool.getAddress(), parseUsdt("100"));
    await lendingPool.connect(deployer).addLiquidity(parseUsdt("100"));

    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("4000"), { value: ethers.parseEther("60") });

    await expect(lendingPool.connect(deployer).unstakeUsdt(parseUsdt("100"))).to.be.revertedWith("Withdrawal leaves pool unable to cover loans");
  });

  it("lets an investor unstake even when the pool is heavily borrowed", async function () {
    const { deployer, borrower, liquidator, mockUsdt, lendingPool, parseUsdt } = await loadFixture(deployFixture);

    await mockUsdt.approve(await lendingPool.getAddress(), parseUsdt("100"));
    await lendingPool.connect(deployer).addLiquidity(parseUsdt("100"));
    await lendingPool.connect(borrower).borrowWithEthCollateral(parseUsdt("4000"), { value: ethers.parseEther("60") });

    await mockUsdt.connect(liquidator).approve(await lendingPool.getAddress(), parseUsdt("100"));
    await lendingPool.connect(liquidator).stakeUsdt(parseUsdt("100"));

    await expect(lendingPool.connect(liquidator).unstakeUsdt(parseUsdt("100"))).to.emit(lendingPool, "Unstaked");
    expect(await lendingPool.stakedUsdt(liquidator.address)).to.equal(0);
  });
});
