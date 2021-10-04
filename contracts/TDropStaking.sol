pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";

contract TDropStaking {
    /// @notice name for this contract
    string public constant name = "TDrop Staking";

      /// @notice The TDrop contract
    TDrop public tdrop;

    /// @notice The TDropParams contract
    TDropParams public tdropParams;

    /// @notice The super admin address
    address public superAdmin;

    /// @notice The admin address
    address public admin;

    /// @notice if the token is allowed to be transferred
    bool public paused;

    /// @notice last block height that staking reward has been issued
    uint public lastRewardMintHeight = 111; // TODO: set proper initial value

    /// @notice Total number of shares
    uint public totalShares = 0; 

    /// @notice Official record of token balances for each account
    mapping (address => uint96) internal shares;

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping (address => mapping (uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping (address => uint32) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice An event thats emitted when the super admin address is changed
    event SuperAdminChanged(address superAdmin, address newSuperAdmin);

    /// @notice An event thats emitted when the admin address is changed
    event AdminChanged(address admin, address newAdmin);

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);

    /**
     * @notice Construct a new TDrop token
     * @param superAdmin_ The account with super admin permission
     * @param admin_ The account with admin permission
     * @param tdrop_ The TDrop TNT-20 contract address
     * @param tdropParams_ The system parameters contract address
     */
    constructor(address superAdmin_, address admin_, address tdrop_, address tdropParams_) public {
        superAdmin = superAdmin_;
        emit SuperAdminChanged(address(0), superAdmin);
        admin = admin_;
        emit AdminChanged(address(0), admin);
        
        tdrop = TDrop(tdrop_);
        tdropParams = TDropParams(tdropParams_);

        paused = true;
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
     * @notice Pause token transfer
     */
    function pause() onlyAdmin external {
        paused = true;
    }

    /**
     * @notice Unpause token transfer
     */
    function unpause() onlyAdmin external {
        paused = false;
    }

    /**
     * @notice TDrop balance of the pool(staked + reward)
     */
    function poolBalance() private view returns (uint)  {
        return tdrop.balanceOf(address(this));
    }

    /**
     * @notice Mint staking reward up to current block height
     */
    function updateReward() private {
        if (lastRewardMintHeight >= block.number) {
            return;
        }
        lastRewardMintHeight = block.number;

        uint96 amount = safe96(SafeMath.mul(tdropParams.stakingRewardPerBlock(), SafeMath.sub(block.number, lastRewardMintHeight)), "TDrop::stake: reward amount exceeds 96 bits");

        tdrop.stakeReward(address(this), amount);
    }

    /**
     * @notice Stake TDrop
     * @param rawAmount The number of tokens to be staked
     */
    function stake(uint rawAmount) external returns (uint) {
        uint96 amount = safe96(rawAmount, "TDrop::stake: amount exceeds 96 bits");

        // Make sure reward is up-to-date so that share price is accurate.
        updateReward();

        uint prevBalance = poolBalance();

		tdrop.transferFrom(msg.sender, address(this), amount);

        // Mint new shares
        uint96 newShares;
        if (totalShares == 0) {
            newShares = amount;
        } else {
            newShares = safe96(SafeMath.div(SafeMath.mul(totalShares, amount), prevBalance), "TDrop::stake: totalSupply exceeds 96 bits");
        }

        totalShares = safe96(SafeMath.add(totalShares, newShares), "TDrop::stake: totalSupply exceeds 96 bits");
        shares[msg.sender] = safe96(SafeMath.add(shares[msg.sender], newShares), "TDrop::stake: amount exceeds 96 bits");

        // move delegates
        _moveDelegates(address(0), delegates[msg.sender], newShares);

        return newShares;
    }

    /**
     * @notice Unstake TDrop
     * @param rawShares The number of shares to be unstaked
     */
    function unstake(uint rawShares) external returns (uint) {
        require(rawShares < shares[msg.sender], "TDrop::unstake: amount exceeds balance");
        require(rawShares > 0, "TDrop::unstake: invalid amount");

        updateReward();

        uint96 sharesAmount = safe96(rawShares, "TDrop::stake: amount exceeds 96 bits");

        uint amount  = safe96(SafeMath.div(SafeMath.mul(poolBalance(), sharesAmount), totalShares), "TDrop::unstake: invalid output amount");

        shares[msg.sender] = safe96(SafeMath.sub(shares[msg.sender], sharesAmount), "TDrop::unstake: invalid output shares");
        totalShares = safe96(SafeMath.sub(totalShares, sharesAmount), "TDrop::unstake: invalid total shares");

        // move delegates
        _moveDelegates(delegates[msg.sender], address(0), sharesAmount);

        tdrop.transfer(msg.sender, amount);

        return amount;
    }

    /**
     * @notice Get the number of shares held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of shares held
     */
    function balanceOf(address account) external view returns (uint) {
        return shares[account];
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s) public {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "TDrop::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "TDrop::delegateBySig: invalid nonce");
        require(now <= expiry, "TDrop::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint96) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "TDrop::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint96 delegatorBalance = shares[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(address srcRep, address dstRep, uint96 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint96 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint96 srcRepNew = sub96(srcRepOld, amount, "TDrop::_moveVotes: vote amount underflows");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint96 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint96 dstRepNew = add96(dstRepOld, amount, "TDrop::_moveVotes: vote amount overflows");
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint96 oldVotes, uint96 newVotes) internal {
      uint32 blockNumber = safe32(block.number, "TDrop::_writeCheckpoint: block number exceeds 32 bits");

      if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
          checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
      } else {
          checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
          numCheckpoints[delegatee] = nCheckpoints + 1;
      }

      emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function safe96(uint n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    function add96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }

    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }

    modifier onlySuperAdmin { 
        require(msg.sender == superAdmin, "TDrop::onlySuperAdmin: only the super admin can perform this action");
        _; 
    }

    modifier onlyAdmin { 
        require(msg.sender == admin, "TDrop::onlyAdmin: only the admin can perform this action");
        _; 
    }

    modifier onlyWhenUnpaused {
        require(!paused, "TDrop::onlyWhenUnpaused: token is paused");
        _;
    }
}

interface TDrop {
    function balanceOf(address account) external view returns (uint);
    function transfer(address dst, uint rawAmount) external returns (bool);
    function transferFrom(address src, address dst, uint rawAmount) external returns (bool);
    function stakeReward(address dst, uint rawAmount) external;
}

interface TDropParams {
    function stakingRewardPerBlock() external view returns (uint);
}