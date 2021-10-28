const { BigNumber } = require("@ethersproject/bignumber");

exports.getBlockHeight = async function () {
    const { number } = await ethers.provider.getBlock('latest');
    return number;
}

exports.expandTo18Decimals = function (n) {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

exports.mineNBlocks = async function (n) {
    for (let i = 0; i < n; i++) {
        await ethers.provider.send('evm_mine', []);
    }
}