pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";

contract TDropParams {
    /// @notice The super admin address
    address public superAdmin;

    /// @notice The admin address
    address public admin;

    /// @notice The staking reward per block
    uint public stakingRewardPerBlock = 100; // TODO: set a proper initial value

    /// @notice An event thats emitted when the super admin address is changed
    event SuperAdminChanged(address superAdmin, address newSuperAdmin);

    /// @notice An event thats emitted when the admin address is changed
    event AdminChanged(address admin, address newAdmin);

    /// @notice An event thats emitted when the staking reward per block is changed
    event StakingRewardPerBlockChanged(uint oldVal, uint newVal);

    /**
     * @notice Construct a new TDrop token
     * @param superAdmin_ The account with super admin permission
     * @param admin_ The account with admin permission
     */
    constructor(address superAdmin_, address admin_) public {
        require(superAdmin_ != address(0), "superAdmin_ is address 0");
        require(admin_ != address(0), "admin_ is address0");
        
        superAdmin = superAdmin_;
        emit SuperAdminChanged(address(0), superAdmin);
        admin = admin_;
        emit AdminChanged(address(0), admin);
    }

    /**
     * @notice Change the admin address
     * @param superAdmin_ The address of the new super admin
     */
    function setSuperAdmin(address superAdmin_) onlySuperAdmin external {
        emit SuperAdminChanged(superAdmin, superAdmin_);
        superAdmin = superAdmin_;
    }

    /**
     * @notice Change the admin address
     * @param admin_ The address of the new admin
     *
     * Only superAdmin can change the admin to avoid potential mistakes. For example, 
     * consider a senario where the admin can call both setAdmin() and setAirdropper().
     * The admin might want to call setAirdropper(0x0) to temporarily disable airdrop. However,
     * due to some implementation bugs, the admin could mistakenly call setAdmin(0x0), which
     * puts the contract into an irrecoverable state.
     */
    function setAdmin(address admin_) onlySuperAdmin external {
        emit AdminChanged(admin, admin_);
        admin = admin_;
    }

        /**
     * @notice Change the staking reward per block parameter.
     * @param stakingRewardPerBlock_ The new value.
     *
     * Only admin can change.
     */
    function setStakingRewardPerBlock(uint stakingRewardPerBlock_) onlyAdmin external {
        emit StakingRewardPerBlockChanged(stakingRewardPerBlock, stakingRewardPerBlock_);
        stakingRewardPerBlock = stakingRewardPerBlock_;
    }

    modifier onlySuperAdmin { 
        require(msg.sender == superAdmin, "TDrop::onlySuperAdmin: only the super admin can perform this action");
        _; 
    }

    modifier onlyAdmin { 
        require(msg.sender == admin, "TDrop::onlyAdmin: only the admin can perform this action");
        _; 
    }
}