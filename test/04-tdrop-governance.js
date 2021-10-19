const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { BigNumber } = require("@ethersproject/bignumber");
const { getContractAddress } = require('@ethersproject/address');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

describe("TDrop Governance", function () {

    let TDropToken;
    let tdropToken;

    let TDropParams;
    let tdropParams;

    let TDropStaking;
    let tdropStaking;

    let Governor;
    let governor;

    let Timelock;
    let timelock;

    let deployer;
    let admin;
    let airdropper;
    let addrs;

    beforeEach(async function () {
        TDropToken = await ethers.getContractFactory("TDropToken");
        TDropParams = await ethers.getContractFactory("TDropParams");
        TDropStaking = await ethers.getContractFactory("TDropStaking");
        Governor = await ethers.getContractFactory("TestGovernorAlpha");
        Timelock = await ethers.getContractFactory("TestTimelock");


        [deployer, superAdmin, admin, airdropper, ...addrs] = await ethers.getSigners();

        tdropToken = await TDropToken.deploy(superAdmin.address, admin.address);
        await tdropToken.deployed();

        tdropParams = await TDropParams.deploy(superAdmin.address, admin.address);
        await tdropParams.deployed();

        tdropStaking = await TDropStaking.deploy(superAdmin.address, admin.address, tdropToken.address, tdropParams.address);
        await tdropStaking.deployed();

        const transactionCount = await deployer.getTransactionCount()

        const gonvernorAddr = getContractAddress({
            from: deployer.address,
            nonce: transactionCount
        });

        const timelockAddr = getContractAddress({
            from: deployer.address,
            nonce: transactionCount + 1
        });

        governor = await Governor.deploy(timelockAddr, tdropStaking.address);
        await governor.deployed();

        // timelock = await Timelock.deploy(gonvernorAddr, 2 * 86400);
        timelock = await Timelock.deploy(gonvernorAddr, 3);
        await timelock.deployed();

        await tdropToken.connect(admin).setAirdropper(airdropper.address);
        await tdropToken.connect(admin).setStakingPool(tdropStaking.address);
        await tdropToken.connect(admin).unpause();
        await tdropStaking.connect(admin).unpause();

        await tdropParams.connect(superAdmin).setAdmin(timelock.address);

        await governor.setVotingPeriod(3);
    });


    it("should be able to execute proposal to update metapool.redeemer", async function () {
        let alice = addrs[2];
        let amount = expandTo18Decimals(123e7);

        await expect(tdropToken.connect(airdropper).airdrop([alice.address], [amount]));
        await tdropToken.connect(alice).approve(tdropStaking.address, amount);
        await tdropStaking.connect(alice).stake(amount);
        await tdropStaking.connect(alice).delegate(alice.address);

        const targets = [tdropParams.address];
        const values = [0];
        const signatures = [""];
        const calldatas = [tdropParams.interface.encodeFunctionData("setStakingRewardPerBlock", [789])];

        const pid = 1;

        // Propose
        await ethers.provider.send('evm_mine', []);
        await governor.connect(alice).propose(targets, values, signatures, calldatas, "");

        // Cast vote
        for (let i = 0; i < 2; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.connect(alice).castVote(pid, true);

        // Queue
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.queue(pid);

        // Execute
        const { timestamp } = await ethers.provider.getBlock('latest');
        await ethers.provider.send('evm_mine', [timestamp + 100]);
        await governor.execute(pid);

        // Verify
        expect(await tdropParams.stakingRewardPerBlock()).to.eq(789);
    });

    it("should be update to update timelock itself", async function () {
        let alice = addrs[2];
        let amount = expandTo18Decimals(123e7);

        await expect(tdropToken.connect(airdropper).airdrop([alice.address], [amount]));
        await tdropToken.connect(alice).approve(tdropStaking.address, amount);
        await tdropStaking.connect(alice).stake(amount);
        await tdropStaking.connect(alice).delegate(alice.address);

        const targets = [timelock.address];
        const values = [0];
        const signatures = [""];
        const calldatas = [Timelock.interface.encodeFunctionData("setDelay", [2 * 86400])];

        const pid = 1;

        // Propose
        await ethers.provider.send('evm_mine', []);
        await governor.connect(alice).propose(targets, values, signatures, calldatas, "");

        // Cast vote
        for (let i = 0; i < 2; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.connect(alice).castVote(pid, true);

        // Queue
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.queue(pid);

        // Execute
        const { timestamp } = await ethers.provider.getBlock('latest');
        await ethers.provider.send('evm_mine', [timestamp + 100]);
        await governor.execute(pid);

        // Verify
        expect(await timelock.delay()).to.eq(2 * 86400);
    });

    it("should reject if proposal has expired", async function () {
        let alice = addrs[2];
        let amount = expandTo18Decimals(123e7);

        await expect(tdropToken.connect(airdropper).airdrop([alice.address], [amount]));
        await tdropToken.connect(alice).approve(tdropStaking.address, amount);
        await tdropStaking.connect(alice).stake(amount);
        await tdropStaking.connect(alice).delegate(alice.address);

        const targets = [timelock.address];
        const values = [0];
        const signatures = [""];
        const calldatas = [Timelock.interface.encodeFunctionData("setDelay", [2 * 86400])];

        const pid = 1;

        // Propose
        await ethers.provider.send('evm_mine', []);
        await governor.connect(alice).propose(targets, values, signatures, calldatas, "");

        // Cast vote
        for (let i = 0; i < 2; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.connect(alice).castVote(pid, true);

        // Set timelock.grace_period to a small value
        await timelock.setGracePeriod(6);

        // Queue
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.queue(pid);

        // Execute
        const { timestamp } = await ethers.provider.getBlock('latest');
        await ethers.provider.send('evm_mine', [timestamp + 100]);
        await expect(governor.execute(pid)).to.be.reverted; // should have expired.

        // Verify
        expect(await timelock.delay()).to.eq(3); // has not changed
    });

    it("should reject not enough votes", async function() {
        let alice = addrs[2];
        let amount = expandTo18Decimals(123e7);

        await expect(tdropToken.connect(airdropper).airdrop([alice.address], [amount]));
        await tdropToken.connect(alice).approve(tdropStaking.address, amount);
        await tdropStaking.connect(alice).stake(expandTo18Decimals(2e7));
        await tdropStaking.connect(alice).delegate(alice.address);

        const targets = [timelock.address];
        const values = [0];
        const signatures = [""];
        const calldatas = [Timelock.interface.encodeFunctionData("setDelay", [2 * 86400])];

        const pid = 1;

        // Propose
        await ethers.provider.send('evm_mine', []);
        await governor.connect(alice).propose(targets, values, signatures, calldatas, "");

        // Cast vote
        for (let i = 0; i < 2; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await governor.connect(alice).castVote(pid, true);

        // Queue
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send('evm_mine', []);
        }
        await expect(governor.queue(pid)).to.be.reverted;

        // Execute
        const { timestamp } = await ethers.provider.getBlock('latest');
        await ethers.provider.send('evm_mine', [timestamp + 100]);
        await expect(governor.execute(pid)).to.be.reverted;

        // Verify
        expect(await timelock.delay()).to.eq(3);
    });



});

function expandTo18Decimals(n) {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}