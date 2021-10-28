# TDROP Token and Governance

## Introduction

This repository contains the smart contracts for the [TNT-20 TDROP Token](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/TDropToken.sol), the [staking contract](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/TDropStaking.sol) and the [on-chain governance](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/GovernorAlpha.sol) module. For more information, please read Section 3 and 4 of the [Theta 2022 Ecosystem whitepaper](https://s3.us-east-2.amazonaws.com/assets.thetatoken.org/Theta-Ecosystem-2022-and-TDROP-Whitepaper.pdf?v=1635386388.501)

### TDROP Token

The TDROP token is a TNT-20 Token (similar to the Ethereum ERC20 token) which forms the basis of the decentralized governance of the Theta Drop NFT Marketplace. The token is implemented by [this smart contract](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/TDropToken.sol). [This](https://github.com/thetatoken/tdrop-governance/blob/master/test/01-tdrop-token-tnt20-basics.js) and [this](https://github.com/thetatoken/tdrop-governance/blob/master/test/02-tdrop-token-special-features.js) test case verify its TNT-20 token interface, and also cover some specicial features.

### Staking

The TDROP staking feature is implemented by [this smart contract](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/TDropStaking.sol). This [test case](https://github.com/thetatoken/tdrop-governance/blob/master/test/03-tdrop-staking.js) demonstrates how to interact with the contract with Javascript for TDROP staking and unstaking. There is no minimum requirement for staking. The staked TDROP can be partially unstaked. Upon unstaking, the staking reward corresponding to the unstaked amount will be sent to the user's wallet along with the principal unstaked. A total of 4 Billion TDROP (20% of total supply) is allocated over a 4-year period as rewards for staking TDROP, which also allows users to participate in the decentralized governance of the network. Each year 1 Billion TDROP will be distributed proportionally to all TDROP stakers. At the end of the 4-year period, the community can propose and vote on possibly extending this.

### Governance

The TDROP on-chain governance feature is implemented by [this smart contract](https://github.com/thetatoken/tdrop-governance/blob/master/contracts/GovernorAlpha.sol). This [test case](https://github.com/thetatoken/tdrop-governance/blob/master/test/04-tdrop-governance.js) illustrates how to interact with the contract using Javascript for submitting and voting for proposals. TDROP serves as the governance token for ThetaDrop and the NFT Marketplace. TDROP holders can stake their tokens to gain voting rights for proposed changes to ThetaDrop. Each user's voting rights for a given proposal will be equal to their share of staked TDROP as a percentage of total TDROP staked. The first TDROP vote proposal is expected to be the earning rate of TDROP for staking and/or liquidity miners, subject to change. As the voting process progresses and stabilizes, TDROP holders will be responsible for creating new proposals to be voted on. Similar to the governance mechanism of prominent DeFi projects like Compound and Uniswap, TDROP governance voting will be conducted fully on-chain through smart contract calls. These community proposals will also serve as the testbed for community governance features to be implemented on the Theta blockchain itself, to be voted on by holders of the Theta token.

## Setup

```
git clone https://github.com/thetatoken/tdrop-governance
cd tdrop-governance
npm install
```

## Compilation

```
npx hardhat compile
```

## Unit Tests

### Test against ganache

To test against ganache, first install ganache following the steps [here](https://www.trufflesuite.com/ganache). Then, start `ganache-cli` in a terminal with the following commond:

```bash
ganache-cli
```

Next, in another terminal, run the tests with

```bash
# run all tests
npx hardhat test --network ganache

# run an individual test
npx hardhat test test/02-tdrop-token-special-features.js --network ganache
```

### Test against the Theta local privatenet

We need to run the unit tests against the Theta local privatenet to make sure the smart contracts behave as expected on the Theta EVM. 

First we need to setup the Theta local privatenet with the Theta/Ethereum RPC Adaptor [following this guide](https://docs.thetatoken.org/docs/setup-local-theta-ethereum-rpc-adaptor). The ETH RPC adaptor running at `http://localhost:18888/rpc` interacts with the ethers.js library by translating the Theta RPC interface into the ETH RPC interface.

Next, run the test suite with

```bash
# run all tests
npx hardhat test --network theta_privatenet

# run an individual test
npx hardhat test test/02-tdrop-token-special-features.js --network theta_privatenet
```