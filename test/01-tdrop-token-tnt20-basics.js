const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

describe('TDrop Token TNT20 Basics', function () {
  this.timeout(100000); 

  const name = 'TDrop Token';
  const symbol = 'TDROP';
  const initialSupply = 100;

  let initialHolder;
  let recipient;
  let anotherAccount;
  let superAdmin;
  let admin;
  let airdropper;
  let liquidityMiner;

  beforeEach(async function () {
    TDropToken = await ethers.getContractFactory("TDropToken");
    [initialHolder, recipient, anotherAccount, superAdmin, admin, airdropper, liquidityMiner, ...addrs] = await ethers.getSigners();
    
    tdropToken = await TDropToken.deploy(superAdmin.address, admin.address);
    await tdropToken.deployed();
    await tdropToken.connect(admin).unpause();
    await tdropToken.connect(admin).setAirdropper(airdropper.address);
    await tdropToken.connect(airdropper).airdrop([initialHolder.address], [initialSupply]);
    await tdropToken.connect(admin).setLiquidityMiner(liquidityMiner.address);

    this.token = tdropToken;
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async function () {
    expect(await this.token.decimals()).to.be.equal(18);
  });

  describe('total supply', function () {
    it('returns the total amount of tokens', async function () {
      expect(await this.token.totalSupply()).to.be.equal(initialSupply);
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        expect(await this.token.balanceOf(anotherAccount.address)).to.be.equal(0);
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        expect(await this.token.balanceOf(initialHolder.address)).to.be.equal(initialSupply);
      });
    });
  });

  describe('transfer from', function () {

    describe('when the token owner is not the zero address', function () {

      describe('when the recipient is not the zero address', function () {

        describe('when the spender has enough approved balance', function () {
          beforeEach(async function () {
            const spender = recipient;
            await this.token.connect(initialHolder).approve(spender.address, initialSupply);
          });

          describe('when the token owner has enough balance', function () {

            it('transfers the requested amount', async function () {
              const tokenOwner = initialHolder;
              const to = anotherAccount;
              const amount = initialSupply;
              const spender = recipient;

              await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

              expect(await this.token.balanceOf(tokenOwner.address)).to.be.equal(0);
              expect(await this.token.balanceOf(to.address)).to.be.equal(amount);
            });

            it('decreases the spender allowance', async function () {
              const tokenOwner = initialHolder;
              const to = anotherAccount;
              const amount = initialSupply;
              const spender = recipient;

              await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

              expect(await this.token.allowance(tokenOwner.address, spender.address)).to.be.equal(0);
            });
          });

          describe('when the token owner does not have enough balance', function () {
            it('reverts', async function () {
              const tokenOwner = initialHolder;
              const to = anotherAccount;
              const amount = initialSupply + 1;
              const spender = recipient;
              await expect(this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)).to.be.reverted;
            });
          });
        });

        describe('when the spender does not have enough approved balance', function () {
          beforeEach(async function () {
            const tokenOwner = initialHolder;
            const spender = recipient;

            await this.token.connect(tokenOwner).approve(spender.address, initialSupply - 1);
          });

          describe('when the token owner has enough balance', function () {
            it('reverts', async function () {
              const tokenOwner = initialHolder;
              const to = anotherAccount;
              const amount = initialSupply;
              const spender = recipient;

              await expect(this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)).to.be.reverted;
            });
          });

          describe('when the token owner does not have enough balance', function () {
            it('reverts', async function () {
              const amount = initialSupply + 1;
              const tokenOwner = initialHolder;
              const to = anotherAccount;
              const spender = recipient;

              await expect(this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)).to.be.reverted;
            });
          });
        });
      });

      describe('when the recipient is the zero address', function () {
        beforeEach(async function () {
          const amount = initialSupply;
          const to = ZERO_ADDRESS;
          const tokenOwner = initialHolder;
          const spender = recipient;

          await this.token.connect(tokenOwner).approve(spender.address, amount);
        });

        it('reverts', async function () {
          const amount = initialSupply;
          const to = ZERO_ADDRESS;
          const tokenOwner = initialHolder;
          const spender = recipient;

          await expect(this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)).to.be.reverted
        });
      });
    });

    describe('when the token owner is the zero address', function () {
      it('reverts', async function () {
        const amount = 0;
        const tokenOwner = ZERO_ADDRESS;
        const to = recipient;
        const spender = recipient;

        await expect(this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)).to.be.reverted
      });
    });
  });

  describe('_mint', function () {
    const amount = 50;
    it('rejects a null account', async function () {ZERO_ADDRESS
      await expect(this.token.connect(ZERO_ADDRESS).mine(amount)).to.be.reverted
    });

    describe('for a non zero account', function () {
      beforeEach('minting', async function () {
        await this.token.connect(liquidityMiner).mine(recipient.address, amount);
      });

      it('increments totalSupply', async function () {
        const expectedSupply = initialSupply + amount;
        expect(await this.token.totalSupply()).to.be.equal(expectedSupply);
      });

      it('increments recipient balance', async function () {
        expect(await this.token.balanceOf(recipient.address)).to.be.equal(amount);
      });
    });
  });

  describe('transfer', function () {

    describe('when the recipient is not the zero address', function () {

      describe('when the sender does not have enough balance', function () {
        const amount = initialSupply + 1;
  
        it('reverts', async function () {
          const to = recipient;
          await expect(this.token.connect(initialHolder).transfer(to.address, amount)).to.be.reverted;
        });
      });
  
      describe('when the sender transfers all balance', function () {
        const amount = initialSupply;
  
        it('transfers the requested amount', async function () {
          const to = recipient;
          await this.token.connect(initialHolder).transfer(to.address, amount)
          
          expect(await this.token.balanceOf(initialHolder.address)).to.be.equal(0);
          expect(await this.token.balanceOf(to.address)).to.be.equal(amount);
        });

      });
  
      describe('when the sender transfers zero tokens', function () {
        const amount = 0;
  
        it('transfers the requested amount', async function () {
          const to = recipient;
          await this.token.connect(initialHolder).transfer(to.address, amount)
  
          expect(await this.token.balanceOf(initialHolder.address)).to.be.equal(initialSupply);  
          expect(await this.token.balanceOf(to.address)).to.be.equal(0);
        });

      });
    });
  
    describe('when the recipient is the zero address', function () {
      it('reverts', async function () {
        const amount = 10;
        await expect(this.token.connect(initialHolder).transfer(ZERO_ADDRESS, amount)).to.be.reverted
      });
    });

  });
  
  describe('approve', function () {

    describe('when the spender is not the zero address', function () {
      
      describe('when the sender has enough balance', function () {
        const amount = initialSupply;
  
        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            const owner = initialHolder;
            const spender = recipient;

            await this.token.connect(owner).approve(spender.address, amount);
  
            expect(await this.token.allowance(owner.address, spender.address)).to.be.equal(amount);
          });
        });
  
        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            const owner = initialHolder;
            const spender = recipient;

            await this.token.connect(owner).approve(spender.address, 1);
          });
  
          it('approves the requested amount and replaces the previous one', async function () {
            const owner = initialHolder;
            const spender = recipient;
            
            await this.token.connect(owner).approve(spender.address, amount);
  
            expect(await this.token.allowance(owner.address, spender.address)).to.be.equal(amount);
          });
        });
      });
  
      describe('when the sender does not have enough balance', function () {
        const amount = initialSupply + 1;
  
        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            const owner = initialHolder;
            const spender = recipient;
            
            await this.token.connect(owner).approve(spender.address, amount);
  
            expect(await this.token.allowance(owner.address, spender.address)).to.be.equal(amount);
          });
        });
  
        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            const owner = initialHolder;
            const spender = recipient;
            
            await this.token.connect(owner).approve(spender.address, 1);
          });
  
          it('approves the requested amount and replaces the previous one', async function () {
            const owner = initialHolder;
            const spender = recipient;
            
            await this.token.connect(owner).approve(spender.address, amount);
  
            expect(await this.token.allowance(owner.address, spender.address)).to.be.equal(amount);
          });
        });
      });
    });
  
  });

});
