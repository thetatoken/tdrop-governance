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

### Setup Theta local privatenet

First we need to setup the Theta local privatenet with the Theta/Ethereum RPC Adaptor [following this guide](https://docs.thetatoken.org/docs/setup-local-theta-ethereum-rpc-adaptor). The ETH RPC adaptor running at `http://localhost:18888/rpc` interacts with the ethers.js library by translating the Theta RPC interface into the ETH RPC interface.

### Run tests

Run all tests

```
npx hardhat test --network theta_privatenet
```

Run an individual test

```
npx hardhat test tests/tdrop.js --network theta_privatenet
```