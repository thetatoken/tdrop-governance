# tdrop-governance

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