pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./GovernorAlpha.sol";

contract TestGovernorAlpha is GovernorAlpha {
    constructor(address timelock_, address tdropStaking_)
        public
        GovernorAlpha(timelock_, tdropStaking_)
    {}

    function setVotingDelay(uint256 votingDelay_) public {
        votingDelay = votingDelay_;
    }

    function setVotingPeriod(uint256 votingPeriod_) public {
        votingPeriod = votingPeriod_;
    }
}
