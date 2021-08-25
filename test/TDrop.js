const { expect } = require("chai");

describe("TDrop Token Contract", function () {

  let TDropToken;
  let tdropToken;
  let deployer;
  let admin;
  let minter;
  let addrs;

  beforeEach(async function () {
    TDropToken = await ethers.getContractFactory("TDrop");
    [deployer, superAdmin, admin, minter, ...addrs] = await ethers.getSigners();

    tdropToken = await TDropToken.deploy(superAdmin.address, admin.address, minter.address);
    await tdropToken.deployed();
  });

  describe("Deployment", function () {
    this.timeout(50000); 

    it("Should correctly initialize the TDrop token", async function () {
      expect(await tdropToken.superAdmin()).to.equal(superAdmin.address);
      expect(await tdropToken.admin()).to.equal(admin.address);
      expect(await tdropToken.minter()).to.equal(minter.address);
      expect(await tdropToken.totalSupply()).to.equal(0);
      expect(await tdropToken.paused()).to.equal(true);
    });

    it("Should correctly set super admin", async function () {
      let superAdmin2 = addrs[0];
      
      await expect(tdropToken.connect(admin).setSuperAdmin(superAdmin2)).to.be.reverted;
      await tdropToken.connect(superAdmin).setSuperAdmin(superAdmin2.address);
      expect(await tdropToken.superAdmin()).to.equal(superAdmin2.address);
    });

    it("Should correctly set admin and minter", async function () {
      let admin2 = addrs[1];
      let minter2 = addrs[2];

      await expect(tdropToken.connect(admin).setAdmin(admin2)).to.be.reverted;
      await expect(tdropToken.connect(superAdmin).setAdmin(minter2)).to.be.reverted;
      await expect(tdropToken.connect(minter).setAdmin(minter2)).to.be.reverted;

      await tdropToken.connect(admin).setMinter(minter2.address);
      expect(await tdropToken.minter()).to.equal(minter2.address);

      await tdropToken.connect(superAdmin).setAdmin(admin2.address);
      expect(await tdropToken.admin()).to.equal(admin2.address);

      await expect(tdropToken.connect(admin).setAdmin(admin2.address)).to.be.reverted;
      await expect(tdropToken.connect(admin).setMinter(minter.address)).to.be.reverted;

      await tdropToken.connect(admin2).setMinter(minter.address);
      expect(await tdropToken.minter()).to.equal(minter.address);
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