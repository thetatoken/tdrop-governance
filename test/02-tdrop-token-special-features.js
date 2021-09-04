const { expect } = require("chai");

describe("TDrop Token Special Features", function () {

  let TDropToken;
  let tdropToken;
  let deployer;
  let admin;
  let airdropper;
  let addrs;

  beforeEach(async function () {
    TDropToken = await ethers.getContractFactory("TDropToken");
    [deployer, superAdmin, admin, airdropper, ...addrs] = await ethers.getSigners();

    tdropToken = await TDropToken.deploy(superAdmin.address, admin.address);
    await tdropToken.deployed();
  });

  describe("Deployment", function () {
    this.timeout(50000); 

    it("Should correctly initialize the TDrop token", async function () {
      expect(await tdropToken.superAdmin()).to.equal(superAdmin.address);
      expect(await tdropToken.admin()).to.equal(admin.address);
      expect(await tdropToken.airdropper()).to.equal("0x0000000000000000000000000000000000000000");
      expect(await tdropToken.totalSupply()).to.equal(0);
      expect(await tdropToken.paused()).to.equal(true);
    });

    it("Should correctly set super admin", async function () {
      let superAdmin2 = addrs[0];
      
      await expect(tdropToken.connect(admin).setSuperAdmin(superAdmin2)).to.be.reverted;
      await tdropToken.connect(superAdmin).setSuperAdmin(superAdmin2.address);
      expect(await tdropToken.superAdmin()).to.equal(superAdmin2.address);
    });

    it("Should correctly set admin and airdropper", async function () {
      let admin2 = addrs[1];
      let airdropper2 = addrs[2];

      await expect(tdropToken.connect(admin).setAdmin(admin2)).to.be.reverted;
      await expect(tdropToken.connect(superAdmin).setAdmin(airdropper2)).to.be.reverted;
      await expect(tdropToken.connect(airdropper).setAdmin(airdropper2)).to.be.reverted;

      await tdropToken.connect(admin).setAirdropper(airdropper2.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper2.address);

      await tdropToken.connect(superAdmin).setAdmin(admin2.address);
      expect(await tdropToken.admin()).to.equal(admin2.address);

      await expect(tdropToken.connect(admin).setAdmin(admin2.address)).to.be.reverted;
      await expect(tdropToken.connect(admin).setAirdropper(airdropper.address)).to.be.reverted;

      await tdropToken.connect(admin2).setAirdropper(airdropper.address);
      expect(await tdropToken.airdropper()).to.equal(airdropper.address);
      await tdropToken.connect(superAdmin).setAdmin(admin.address);
      expect(await tdropToken.admin()).to.equal(admin.address);
    });

    it("Should correctly set the pause attribute", async function () {
      let admin2 = addrs[0];

      await expect(tdropToken.connect(admin2).unpause()).to.be.reverted;
      expect(await tdropToken.paused()).to.equal(true);
      await expect(tdropToken.connect(admin2).pause()).to.be.reverted;

      await tdropToken.connect(admin).unpause();
      expect(await tdropToken.paused()).to.equal(false);
      await tdropToken.connect(admin).pause();
      expect(await tdropToken.paused()).to.equal(true);
    });

  });
});