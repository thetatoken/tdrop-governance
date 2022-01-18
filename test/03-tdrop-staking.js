const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;
const { getBlockHeight, mineNBlocks, expandTo18Decimals } = require('./utils');

describe("TDrop Staking", function () {

    let TDropToken;
    let tdropToken;

    let TDropParams;
    let tdropParams;

    let TDropStaking;
    let tdropStaking;

    let deployer;
    let admin;
    let airdropper;
    let addrs;

    beforeEach(async function () {
        TDropToken = await ethers.getContractFactory("TDropToken");
        TDropParams = await ethers.getContractFactory("TDropParams");
        TDropStaking = await ethers.getContractFactory("TestTDropStaking");

        [deployer, superAdmin, admin, airdropper, ...addrs] = await ethers.getSigners();

        tdropToken = await TDropToken.deploy(superAdmin.address, admin.address);
        await tdropToken.deployed();

        tdropParams = await TDropParams.deploy(superAdmin.address, admin.address);
        await tdropParams.deployed();

        tdropStaking = await TDropStaking.deploy(superAdmin.address, admin.address, tdropToken.address, tdropParams.address);
        await tdropStaking.deployed();

        await tdropToken.connect(admin).setAirdropper(airdropper.address);
        await tdropToken.connect(admin).setStakingPool(tdropStaking.address);
        await tdropToken.connect(admin).unpause();
    });

    describe("Contract Initialization", function () {
        this.timeout(50000);

        it("Should correctly initialize the Contract", async function () {
            expect(await tdropStaking.superAdmin()).to.equal(superAdmin.address);
            expect(await tdropStaking.admin()).to.equal(admin.address);
            expect(await tdropStaking.tdrop()).to.equal(tdropToken.address);
            expect(await tdropStaking.tdropParams()).to.equal(tdropParams.address);
            expect(await tdropStaking.totalShares()).to.equal(0);
            expect(await tdropStaking.paused()).to.equal(true);
        });

        it("Should correctly set super admin", async function () {
            let superAdmin2 = addrs[0];

            // only super admin can set super admin
            await expect(tdropStaking.connect(admin).setSuperAdmin(superAdmin2)).to.be.reverted;
            await tdropStaking.connect(superAdmin).setSuperAdmin(superAdmin2.address);
            expect(await tdropStaking.superAdmin()).to.equal(superAdmin2.address);
        });

        it("Should correctly set admin", async function () {
            let admin2 = addrs[1];
            let airdropper2 = addrs[2];

            // only the super admin can set admin
            await expect(tdropStaking.connect(admin).setAdmin(admin2.address)).to.be.reverted;
            await expect(tdropStaking.connect(admin2).setAdmin(airdropper2.address)).to.be.reverted;
            expect(await tdropStaking.admin()).to.equal(admin.address);

            // the super admin can successfully change the admin
            await tdropStaking.connect(superAdmin).setAdmin(admin2.address);
            expect(await tdropStaking.admin()).to.equal(admin2.address);
        });

        it("Only the admin can pause/unpause the token", async function () {
            let admin2 = addrs[0];

            await expect(tdropStaking.connect(admin2).unpause()).to.be.reverted;
            expect(await tdropStaking.paused()).to.equal(true);
            await expect(tdropStaking.connect(admin2).pause()).to.be.reverted;

            await tdropStaking.connect(admin).unpause();
            expect(await tdropStaking.paused()).to.equal(false);
            await tdropStaking.connect(admin).pause();
            expect(await tdropStaking.paused()).to.equal(true);
        });

    });

    describe("Stake/Unstake", function () {
        this.timeout(50000);

        beforeEach(async () => {
            await tdropStaking.connect(admin).unpause();
        });

        it("mint shares 1:1 when balance is zero", async function () {
            let recipient1 = addrs[2];
            let recipient2 = addrs[3];
            let amount1 = 998;
            let amount2 = 72327847929;

            await expect(tdropToken.connect(airdropper).airdrop([recipient1.address, recipient2.address], [amount1, amount2]));

            // initially the recipient should have no shares
            expect(await tdropStaking.balanceOf(recipient1.address)).to.be.equal(0);

            await tdropToken.connect(recipient1).approve(tdropStaking.address, 100);
            await tdropStaking.connect(recipient1).stake(100);
            expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1 - 100);
            expect(await tdropStaking.balanceOf(recipient1.address)).to.be.equal(100);
        });

        it("mint shares pro rata when balance is non-zero", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let amount1 = 10000;
            let amount2 = 10000;

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address], [amount1, amount2]));

            // initially the recipient should have no shares
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(0);

            // alice stake 100 
            await tdropToken.connect(alice).approve(tdropStaking.address, 100);
            await tdropStaking.connect(alice).stake(100);
            expect(await tdropToken.balanceOf(alice.address)).to.be.equal(amount1 - 100);
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(100);

            // bob stake 100 
            await tdropToken.connect(bob).approve(tdropStaking.address, 100);
            await tdropStaking.connect(bob).stake(100);
            // Make sure staking pool balance is 200(minting is not enabled) so the calculation matches
            expect(await tdropToken.balanceOf(tdropStaking.address)).to.equal(200);
            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(amount2 - 100);
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(100);

            // Add balance to staking pool without staking
            await expect(tdropToken.connect(airdropper).airdrop([tdropStaking.address], [200]));

            // bob stakes another 100 and gets 50 shares
            await tdropToken.connect(bob).approve(tdropStaking.address, 100);
            await tdropStaking.connect(bob).stake(100);
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(100 + 50);
        });

        it("burn shares and return tdrop", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let amount1 = 10000;
            let amount2 = 10000;

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address], [amount1, amount2]));

            // initially the recipient should have no shares
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(0);

            // alice stake 100 
            await tdropToken.connect(alice).approve(tdropStaking.address, 100);
            await tdropStaking.connect(alice).stake(100);
            expect(await tdropToken.balanceOf(alice.address)).to.be.equal(amount1 - 100);
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(100);

            // bob stake 100 
            await tdropToken.connect(bob).approve(tdropStaking.address, 100);
            await tdropStaking.connect(bob).stake(100);
            // Make sure staking pool balance is 200(minting is not enabled) so the calculation matches
            expect(await tdropToken.balanceOf(tdropStaking.address)).to.equal(200);
            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(amount2 - 100);
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(100);

            // Add balance to staking pool without staking. share price = $2
            await expect(tdropToken.connect(airdropper).airdrop([tdropStaking.address], [200]));

            // bob stakes another 100 and gets 50 shares
            await tdropToken.connect(bob).approve(tdropStaking.address, 100);
            await tdropStaking.connect(bob).stake(100);
            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(amount2 - 100 - 100);
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(100 + 50);
            expect(await tdropStaking.totalShares()).to.equal(100 + 100 + 50);

            // bob unstake 50 shares
            await tdropStaking.connect(bob).unstake(50);
            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(amount2 - 100);
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(100);
            expect(await tdropStaking.totalShares()).to.equal(100 + 100);

            // alice unstake 100 shares
            await tdropStaking.connect(alice).unstake(100);
            expect(await tdropToken.balanceOf(alice.address)).to.be.equal(amount1 - 100 + 200);
            expect(await tdropStaking.balanceOf(alice.address)).to.equal(0);
            expect(await tdropStaking.totalShares()).to.equal(100);

            // bob unstake remaining 100 shares
            await tdropStaking.connect(bob).unstake(100);
            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(amount2 - 100 + 200);
            expect(await tdropStaking.balanceOf(bob.address)).to.equal(0);
            expect(await tdropStaking.totalShares()).to.equal(0);
        });

        it("distriute minted tdrop correctly", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let carol = addrs[4];
            let amount = expandTo18Decimals(10000);

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address, carol.address], [amount, amount, amount]));

            await tdropStaking.setLastRewardMintHeight(1); // Start minting rewards

            // initially the recipient should have no shares
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(0);

            // alice stake 100 
            await tdropToken.connect(alice).approve(tdropStaking.address, expandTo18Decimals(100));
            await tdropStaking.connect(alice).stake(expandTo18Decimals(100));
            expect(await tdropToken.balanceOf(alice.address)).to.be.equal(amount.sub(expandTo18Decimals(100)));
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(expandTo18Decimals(100));

            const rewardPerBlock = await tdropParams.stakingRewardPerBlock();

            // staking pool reward should been minted
            const height1 = await getBlockHeight();
            const expectedReward1 = rewardPerBlock.mul(height1 - 1);
            const rewardBalance1 = await tdropToken.balanceOf(tdropStaking.address);
            expect(rewardBalance1).to.be.equal(expectedReward1.add(expandTo18Decimals(100)));

            // Mine some blocks
            await mineNBlocks(7);

            // bob stake 100 
            await tdropToken.connect(bob).approve(tdropStaking.address, expandTo18Decimals(100));
            await tdropStaking.connect(bob).stake(expandTo18Decimals(100));
            const height2 = await getBlockHeight();
            let expectedReward2 = rewardPerBlock.mul(height2 - height1);
            const rewardBalance2 = await tdropToken.balanceOf(tdropStaking.address);
            expect(rewardBalance2).to.be.equal(expectedReward1.add(expandTo18Decimals(200)).add(expectedReward2));
            const expectedBobShares = BigNumber.from(expandTo18Decimals(100)).mul(expandTo18Decimals(100)).div(rewardBalance2.sub(expandTo18Decimals(100)));
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(expectedBobShares);

            // Mine some blocks
            await mineNBlocks(7);

            // carol stake 100 
            await tdropToken.connect(carol).approve(tdropStaking.address, expandTo18Decimals(100));
            await tdropStaking.connect(carol).stake(expandTo18Decimals(100));
            const height3 = await getBlockHeight();
            let expectedReward3 = rewardPerBlock.mul(height3 - height2);
            const rewardBalance3 = await tdropToken.balanceOf(tdropStaking.address);
            expect(rewardBalance3).to.be.equal(rewardBalance2.add(expandTo18Decimals(100)).add(expectedReward3));
            const expectedCarolShares = expandTo18Decimals(100).mul(expandTo18Decimals(100).add(expectedBobShares)).div(rewardBalance3.sub(expandTo18Decimals(100)));
            expect(await tdropStaking.balanceOf(carol.address)).to.be.equal(expectedCarolShares);

            // Mine some blocks
            await mineNBlocks(7);

            // alice unstake  
            await tdropStaking.connect(alice).unstake(expandTo18Decimals(100));

            const height4 = await getBlockHeight();
            const expectedRewardBalance = rewardPerBlock.mul(height4 - 1).add(expandTo18Decimals(300));
            const expectedAliceTotalReward = expectedRewardBalance.mul(expandTo18Decimals(100)).div(expectedCarolShares.add(expectedBobShares).add(expandTo18Decimals(100)));

            expect(await tdropToken.balanceOf(alice.address)).to.be.equal(expectedAliceTotalReward.add(amount).sub(expandTo18Decimals(100)));
            expect(await tdropStaking.balanceOf(alice.address)).to.be.equal(0);

            // Mine some blocks
            await mineNBlocks(7);

            // bob unstake  
            const rewardBalance5 = await tdropToken.balanceOf(tdropStaking.address);

            await tdropStaking.connect(bob).unstake(expectedBobShares);

            const expectedBobTotalReward = rewardBalance5.add(rewardPerBlock.mul(7+1)).mul(expectedBobShares).div(expectedCarolShares.add(expectedBobShares));

            expect(await tdropToken.balanceOf(bob.address)).to.be.equal(expectedBobTotalReward.add(amount).sub(expandTo18Decimals(100)));
            expect(await tdropStaking.balanceOf(bob.address)).to.be.equal(0);
        });
    });

    describe("Votes", function () {
        this.timeout(50000);

        beforeEach(async () => {
            await tdropStaking.connect(admin).unpause();
        });

        it("votes should go to delegatee", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let carol = addrs[4];
            let amount = 10000;

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address], [amount, amount]));

            await tdropToken.connect(alice).approve(tdropStaking.address, 100);
            await tdropStaking.connect(alice).stake(100);

            // Have zero votes before delegation
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(0);

            await tdropStaking.connect(alice).delegate(carol.address);

            // Votes go to delegatee
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(100);
        });

        it("votes should be removed after unstake", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let carol = addrs[4];
            let amount = 10000;

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address], [amount, amount]));

            await tdropToken.connect(alice).approve(tdropStaking.address, 100);
            await tdropStaking.connect(alice).stake(100);

            // Have zero votes before delegation
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(0);

            await tdropStaking.connect(alice).delegate(carol.address);

            // Votes go to delegatee
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(100);

            // Unstake should remove votes
            await tdropStaking.connect(alice).unstake(77);
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(23);
        });

        it("delegatee can be shared", async function () {
            let alice = addrs[2];
            let bob = addrs[3];
            let carol = addrs[4];
            let amount = 10000;

            await expect(tdropToken.connect(airdropper).airdrop([alice.address, bob.address], [amount, amount]));

            await tdropToken.connect(alice).approve(tdropStaking.address, 100);
            await tdropStaking.connect(alice).stake(100);
            await tdropToken.connect(bob).approve(tdropStaking.address, 100);
            await tdropStaking.connect(bob).stake(100);

            // Have zero votes before delegation
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(0);

            // Alice delegate
            await tdropStaking.connect(alice).delegate(carol.address);

            // Votes go to delegatee
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(100);

            // Bob delegate
            await tdropStaking.connect(bob).delegate(carol.address);

            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(200);

            // Unstake should remove votes
            await tdropStaking.connect(alice).unstake(100);
            expect(await tdropStaking.getCurrentVotes(alice.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(bob.address)).to.be.equal(0);
            expect(await tdropStaking.getCurrentVotes(carol.address)).to.be.equal(100);
        });
    });

    describe("Pause Staking", function () {
        this.timeout(50000);

        it("Cannot stake when paused", async function () {
            let recipient1 = addrs[2];
            let amount1 = 998;

            await expect(tdropToken.connect(airdropper).airdrop([recipient1.address], [amount1]));

            expect(await tdropStaking.balanceOf(recipient1.address)).to.be.equal(0);

            // stake
            await tdropToken.connect(recipient1).approve(tdropStaking.address, 100);
            await expect(tdropStaking.connect(recipient1).stake(100)).to.be.revertedWith('TDropStaking::onlyWhenUnpaused: staking is paused');

            await tdropStaking.connect(admin).unpause();

            await tdropStaking.connect(recipient1).stake(100);

            expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1 - 100);
            expect(await tdropStaking.balanceOf(recipient1.address)).to.be.equal(100);

            // unstake
            await tdropStaking.connect(admin).pause();

            await expect(tdropStaking.connect(recipient1).unstake(100)).to.be.revertedWith('TDropStaking::onlyWhenUnpaused: staking is paused');

            await tdropStaking.connect(admin).unpause();

            await tdropStaking.connect(recipient1).unstake(100);

            expect(await tdropToken.balanceOf(recipient1.address)).to.be.equal(amount1);
            expect(await tdropStaking.balanceOf(recipient1.address)).to.be.equal(0);

        });
    });

});

