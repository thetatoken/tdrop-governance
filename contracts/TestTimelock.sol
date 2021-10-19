pragma solidity ^0.5.16;

import "./Timelock.sol";

contract TestTimelock is Timelock {
    constructor(address admin_, uint256 delay_)
        public
        Timelock(admin_, MINIMUM_DELAY)
    {
        delay = delay_;
    }

    function setMinDelay(uint256 minDelay_) public {
        MINIMUM_DELAY = minDelay_;
    }

    function setMaxDelay(uint256 maxDelay_) public {
        MAXIMUM_DELAY = maxDelay_;
    }

    function setGracePeriod(uint256 gracePeriod_) public {
        GRACE_PERIOD = gracePeriod_;
    }
}
