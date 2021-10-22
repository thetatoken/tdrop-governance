pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./TDropStaking.sol";

contract TestTDropStaking is TDropStaking {
    constructor(
        address superAdmin_,
        address admin_,
        address tdrop_,
        address tdropParams_
    ) public TDropStaking(superAdmin_, admin_, tdrop_, tdropParams_) {}

    function setLastRewardMintHeight(uint256 newVal) public {
        lastRewardMintHeight = newVal;
    }
}