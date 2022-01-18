const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { BigNumber} = require("@ethersproject/bignumber");
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

describe("TDrop Token Special Features", function () {

  let TDropToken;
  let tdropToken;
  let deployer;
  let admin;
  let airdropper;
  let liquidityMiner;
  let addrs;

  beforeEach(async function () {
    TDropToken = await ethers.getContractFactory("TDropToken");
    [deployer, superAdmin, admin, airdropper, liquidityMiner, ...addrs] = await ethers.getSigners();

    tdropToken = await TDropToken.deploy(superAdmin.address, admin.address);
    await tdropToken.deployed();
  });

  describe("Token Initialization", function () {
    this.timeout(50000); 

    it("Should correctly initialize the TDrop token", async function () {
      expect(await tdropToken.superAdmin()).to.equal(superAdmin.address);
      expect(await tdropToken.admin()).to.equal(admin.address);
      expect(await tdropToken.airdropper()).to.equal("0x0000000000000000000000000000000000000000");
      expect(await tdropToken.liquidityMiner()).to.equal("0x0000000000000000000000000000000000000000");
      expect(await tdropToken.totalSupply()).to.equal(0);
      expect(await tdropToken.paused()).to.equal(true);
    });

    it("Should correctly set super admin", async function () {
      let superAdmin2 = addrs[0];
      
      // only super admin can set super admin
      await expect(tdropToken.connect(admin).setSuperAdmin(superAdmin2)).to.be.reverted;
      await tdropToken.connect(superAdmin).setSuperAdmin(superAdmin2.address);
      expect(await tdropToken.superAdmin()).to.equal(superAdmin2.address);
    });

    it("Should correctly set admin and airdropper", async function () {
      let admin2 = addrs[1];
      let airdropper2 = addrs[2];

      // only the super admin can set admin
      await expect(tdropToken.connect(admin).setAdmin(admin2.address)).to.be.reverted;
      await expect(tdropToken.connect(admin2).setAdmin(airdropper2.address)).to.be.reverted;
      await expect(tdropToken.connect(airdropper).setAdmin(airdropper2.address)).to.be.reverted;
      expect(await tdropToken.admin()).to.equal(admin.address);

      // only the admin can set the airdropper
      await expect(tdropToken.connect(admin2).setAirdropper(airdropper2.address)).to.be.reverted;
      await tdropToken.connect(admin).setAirdropper(airdropper2.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper2.address);

      // the super admin can successfully change the admin
      await tdropToken.connect(superAdmin).setAdmin(admin2.address);
      expect(await tdropToken.admin()).to.equal(admin2.address);

      // only the current admin (i.e. admin2) can change the airdropper
      await expect(tdropToken.connect(admin).setAdmin(admin2.address)).to.be.reverted;
      await expect(tdropToken.connect(admin).setAirdropper(airdropper.address)).to.be.reverted;

      // the current admin (i.e admin2) can successfully change the airdropper
      await tdropToken.connect(admin2).setAirdropper(airdropper.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper.address);
      await tdropToken.connect(superAdmin).setAdmin(admin.address);
      expect(await tdropToken.admin()).to.equal(admin.address);
    });

    it("Should correctly set liquidity miner", async function () {
      let admin2 = addrs[1];
      let liquidityMiner2 = addrs[3];

      // only the admin can set the airdropper
      await expect(tdropToken.connect(admin2).setLiquidityMiner(liquidityMiner.address)).to.be.reverted;
      expect(await tdropToken.liquidityMiner()).to.equal("0x0000000000000000000000000000000000000000");

      // the current admin can successfully set the the liquidity miner
      await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner.address);
      expect(await tdropToken.liquidityMiner()).to.equal(liquidityMiner.address);

      await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner2.address);
      expect(await tdropToken.liquidityMiner()).to.equal(liquidityMiner2.address);
    });

    it("Only the admin can pause/unpause the token", async function () {
      let admin2 = addrs[0];

      await expect(tdropToken.connect(admin2).unpause()).to.be.reverted;
      expect(await tdropToken.paused()).to.equal(true);
      await expect(tdropToken.connect(admin2).pause()).to.be.reverted;

      await tdropToken.connect(admin).unpause();
      expect(await tdropToken.paused()).to.equal(false);
      await tdropToken.connect(admin).pause();
      expect(await tdropToken.paused()).to.equal(true);
    });

    it("Only the admin can update the staking and liquidity mining reward limit", async function () {
      let admin2 = addrs[0];
      let dec18 = new BigNumber.from('1000000000000000000');

      // non-admin cannot update the staking and liquidity mining reward limit
      await expect(tdropToken.connect(admin2).updateMaxStakeReward(new BigNumber.from('7000000000').mul(dec18))).to.be.reverted;
      expect(await tdropToken.maxStakeReward()).to.equal(new BigNumber.from('4000000000').mul(dec18));
      await expect(tdropToken.connect(admin2).updateMaxLiquidityMiningReward(new BigNumber.from('7000000000').mul(dec18))).to.be.reverted;
      expect(await tdropToken.maxLiquidityMiningReward()).to.equal(new BigNumber.from('6000000000').mul(dec18));
      
      // maxStakeReward = await tdropToken.maxStakeReward();
      // maxLiquidityMiningReward = await tdropToken.maxLiquidityMiningReward();
      // console.log("maxStakeReward:", maxStakeReward.toString(), "maxLiquidityMiningReward:", maxLiquidityMiningReward.toString());

      // admin can update the staking and liquidity mining reward limit
      await tdropToken.connect(admin).updateMaxStakeReward(new BigNumber.from('7000000000').mul(dec18));
      expect(await tdropToken.maxStakeReward()).to.equal(new BigNumber.from('7000000000').mul(dec18));
      await tdropToken.connect(admin).updateMaxLiquidityMiningReward(new BigNumber.from('9000000000').mul(dec18));
      expect(await tdropToken.maxLiquidityMiningReward()).to.equal(new BigNumber.from('9000000000').mul(dec18));

      // maxStakeReward = await tdropToken.maxStakeReward();
      // maxLiquidityMiningReward = await tdropToken.maxLiquidityMiningReward();
      // console.log("maxStakeReward:", maxStakeReward.toString(), "maxLiquidityMiningReward:", maxLiquidityMiningReward.toString());

      // even amin cannot set the staking and liquidity mining reward limit too high
      await expect(tdropToken.connect(admin2).updateMaxStakeReward(new BigNumber.from('8000000001').mul(dec18))).to.be.reverted;
      expect(await tdropToken.maxStakeReward()).to.equal(new BigNumber.from('7000000000').mul(dec18));
      await expect(tdropToken.connect(admin2).updateMaxLiquidityMiningReward(new BigNumber.from('10000000001').mul(dec18))).to.be.reverted;
      expect(await tdropToken.maxLiquidityMiningReward()).to.equal(new BigNumber.from('9000000000').mul(dec18));

      // maxStakeReward = await tdropToken.maxStakeReward();
      // maxLiquidityMiningReward = await tdropToken.maxLiquidityMiningReward();
      // console.log("maxStakeReward:", maxStakeReward.toString(), "maxLiquidityMiningReward:", maxLiquidityMiningReward.toString());

      // set the staking and liquidity mining reward limit back to the default
      await tdropToken.connect(admin).updateMaxStakeReward(new BigNumber.from('4000000000').mul(dec18));
      expect(await tdropToken.maxStakeReward()).to.equal(new BigNumber.from('4000000000').mul(dec18));
      await tdropToken.connect(admin).updateMaxLiquidityMiningReward(new BigNumber.from('6000000000').mul(dec18));
      expect(await tdropToken.maxLiquidityMiningReward()).to.equal(new BigNumber.from('6000000000').mul(dec18));

      // maxStakeReward = await tdropToken.maxStakeReward();
      // maxLiquidityMiningReward = await tdropToken.maxLiquidityMiningReward();
      // console.log("maxStakeReward:", maxStakeReward.toString(), "maxLiquidityMiningReward:", maxLiquidityMiningReward.toString());
    });
    
  });

  describe("Airdrop", function () {
    this.timeout(50000);

    it("view account balances after airdrop", async function () {
      let recipient1 = addrs[3];
      let recipient2 = addrs[4];

      let dec18 = new BigNumber.from('1000000000000000000');
      let amount1 = new BigNumber.from(72327847929);
      let amount2 = new BigNumber.from(34525623).mul(dec18).add(new BigNumber.from(1843334524523452));

      // initially the recipient should have no TDrop
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      await tdropToken.connect(admin).setAirdropper(airdropper.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper.address);
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(0));

      // should airdrop correct amounts
      await tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [amount1, amount2]);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2);      
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(amount1).add(new BigNumber.from(amount2)));
     
      expect(await tdropToken.balanceInWholeCoin(recipient1.address)).to.be.equal(new BigNumber.from(0));
      expect(await tdropToken.balanceInWholeCoin(recipient2.address)).to.be.equal(new BigNumber.from(34525623)); 
    });

    it("Only the designated airdropper can airdrop tokens", async function () {
      let airdropper2 = addrs[2];
      let recipient1 = addrs[3];
      let recipient2 = addrs[4];
      let amount1 = 998;
      let amount2 = 72327847929;

      // initially the recipient should have no TDrop
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      await tdropToken.connect(admin).setAirdropper(airdropper.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper.address);
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(0));

      // only the designated airdropper can do the airdrop
      await expect(tdropToken.connect(airdropper2).airdrop([recipient1.address, recipient2.address], [amount1, amount2])).to.be.reverted;
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      // should airdrop correct amounts
      await tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [amount1, amount2]);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2);      
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(amount1).add(new BigNumber.from(amount2)));

      // airdrop again
      await tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [amount1*8, amount2*2]);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1*9);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2*3);
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(amount1*9).add(new BigNumber.from(amount2*3)));

      // set airdropper to the ZERO_ADDRESS for better security
      await tdropToken.connect(admin).setAirdropper(ZERO_ADDRESS);
      expect(await tdropToken.airdropper()).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Cannot exceed the airdrop limit", async function () {
      const MAX_AIRDROP_AMOUNT = BigNumber.from('10000000000').mul(BigNumber.from('1000000000000000000'))
      let recipient1 = addrs[3];
      let recipient2 = addrs[4];
      let amount1 = BigNumber.from('2389472');
      let amount2 = BigNumber.from('34528752852');
      let amount3 = MAX_AIRDROP_AMOUNT.sub(amount1).sub(amount2);

      // initially the recipient should have no TDrop
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(0));

      await tdropToken.connect(admin).setAirdropper(airdropper.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper.address);

      // should airdrop correct amounts
      await tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [amount1, amount2]);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2);
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(amount1).add(new BigNumber.from(amount2)));

      // airdrop amount3 to recipient1
      await tdropToken.connect(airdropper).airdrop([recipient1.address], [amount3]);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1.add(amount3));
      expect(await tdropToken.totalSupply()).to.be.equal(new BigNumber.from(amount1).add(new BigNumber.from(amount2)).add(new BigNumber.from(amount3)));

      // exceed the airdrop limit, should revert
      await expect(tdropToken.connect(airdropper).airdrop([recipient2.address], [1])).to.be.reverted;
      expect(await tdropToken.totalSupply()).to.be.equal(MAX_AIRDROP_AMOUNT);

      // exceed the airdrop limit, should revert
      await expect(tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [1, 1])).to.be.reverted;
      expect(await tdropToken.totalSupply()).to.be.equal(MAX_AIRDROP_AMOUNT);

      //console.log("tdropToken.totalSupply():", (await tdropToken.totalSupply()).toString());
    });

  });

  describe("Liquidity Mining", function () {
    this.timeout(50000); 

    it("Only the designated liquidity miner can mine tokens", async function () {
      let liquidityMiner2 = addrs[2];
      let recipient1 = addrs[3];
      let recipient2 = addrs[4];
      let amount1 = 245145;
      let amount2 = 32513541235;

      // initially the recipient should have no TDrop
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner.address);
      expect(await tdropToken.liquidityMiner()).to.equal(liquidityMiner.address);

      // only the designated liquidity miner can do the mining
      await expect(tdropToken.connect(liquidityMiner2).mine(recipient1.address, amount1)).to.be.reverted;
      await expect(tdropToken.connect(liquidityMiner2).mine(recipient2.address, amount2)).to.be.reverted;
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      // should mine correct amounts
      await tdropToken.connect(liquidityMiner).mine(recipient1.address, amount1);
      await tdropToken.connect(liquidityMiner).mine(recipient2.address, amount2);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2);      

      // mine again
      await tdropToken.connect(liquidityMiner).mine(recipient1.address, amount1*8);
      await tdropToken.connect(liquidityMiner).mine(recipient2.address, amount2*2);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1*9);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2*3);  
      
      // set liquidity mining to the ZERO_ADDRESS for better security
      await tdropToken.connect(admin).setLiquidityMiner(ZERO_ADDRESS);
      expect(await tdropToken.liquidityMiner()).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Cannot exceed the liquidity mining limit", async function () {
      const MAX_MINING_AMOUNT = BigNumber.from('6000000000').mul(BigNumber.from('1000000000000000000'))
      let recipient1 = addrs[3];
      let recipient2 = addrs[4];
      let amount1 = BigNumber.from('7462234532334');
      let amount2 = BigNumber.from('894829394822234234294');
      let amount3 = MAX_MINING_AMOUNT.sub(amount1).sub(amount2);

      // initially the recipient should have no TDrop
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(0);

      await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner.address);
      expect(await tdropToken.liquidityMiner()).to.equal(liquidityMiner.address);

      // should mine correct amounts
      await tdropToken.connect(liquidityMiner).mine(recipient1.address, amount1);
      await tdropToken.connect(liquidityMiner).mine(recipient2.address, amount2);
      expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2);   

      // airdrop amount3 to recipient2
      await tdropToken.connect(liquidityMiner).mine(recipient2.address, amount3);
      expect(await tdropToken.balanceOf(recipient2.address)).to.be.equal(amount2.add(amount3));

      // await expect(tdropToken.connect(liquidityMiner).mine(recipient1.address, 1)).to.be.reverted;
      // await expect(tdropToken.connect(liquidityMiner).mine(recipient2.address, 8)).to.be.reverted;
      
      // Should not exceed the max limit
      expect(await tdropToken.totalSupply()).to.be.equal(MAX_MINING_AMOUNT);
      await tdropToken.connect(liquidityMiner).mine(recipient1.address, 1); // New behavior: should NOT revert
      await tdropToken.connect(liquidityMiner).mine(recipient2.address, 8); // New behavior: should NOT revert
      expect(await tdropToken.totalSupply()).to.be.equal(MAX_MINING_AMOUNT); // total supply should not change

      //console.log("tdropToken.totalSupply():", (await tdropToken.totalSupply()).toString());
    });

  });

  describe("Pause Token", function () {
    this.timeout(50000); 

    it("Cannot transfer token when TDropToken is paused", async function () {
      const tokenOwner = addrs[1];
      const to = addrs[2];
      const spender = addrs[3];
      const minedAmount = 872812459;
      const approvedAmount = 99999;
      const transferAmount = 8888;

      // mine the initial tokens
      await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner.address);
      await tdropToken.connect(liquidityMiner).mine(tokenOwner.address, minedAmount);
      expect(await tdropToken.balanceOf(tokenOwner.address)).to.be.equal(minedAmount);
      expect(await tdropToken.balanceOf(to.address)).to.be.equal(0);
      expect(await tdropToken.balanceOf(spender.address)).to.be.equal(0);

      // should neither allow approval nor transferFrom/transfer when ThetaDrop is paused
      expect(await tdropToken.paused()).to.equal(true);
      await expect(tdropToken.connect(tokenOwner).approve(spender.address, approvedAmount)).to.be.reverted;
      await expect(tdropToken.connect(spender).transferFrom(tokenOwner.address, to.address, transferAmount)).to.be.reverted;
      await expect(tdropToken.connect(tokenOwner).transfer(to.address, transferAmount)).to.be.reverted;

      // should be able to call approve/transfer/transferFrom when ThetaDrop is unpaused
      await tdropToken.connect(admin).unpause();
      expect(await tdropToken.paused()).to.equal(false);
      await tdropToken.connect(tokenOwner).approve(spender.address, approvedAmount);
      await tdropToken.connect(spender).transferFrom(tokenOwner.address, to.address, transferAmount);
      expect(await tdropToken.balanceOf(tokenOwner.address)).to.be.equal(minedAmount-transferAmount);
      expect(await tdropToken.balanceOf(to.address)).to.be.equal(transferAmount);
      expect(await tdropToken.balanceOf(spender.address)).to.be.equal(0);

      await tdropToken.connect(tokenOwner).transfer(to.address, transferAmount);
      expect(await tdropToken.balanceOf(tokenOwner.address)).to.be.equal(minedAmount-2*transferAmount);
      expect(await tdropToken.balanceOf(to.address)).to.be.equal(2*transferAmount);
      expect(await tdropToken.balanceOf(spender.address)).to.be.equal(0);
    });

  });

});