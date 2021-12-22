pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";

contract TDropToken {
    /// @notice EIP-20 token name for this token
    string public constant name = "TDrop Token";

    /// @notice EIP-20 token symbol for this token
    string public constant symbol = "TDROP";

    /// @notice EIP-20 token decimals for this token
    uint8 public constant decimals = 18;

    /// @notice Max number of tokens
    // Note that 2**96 > 20 * 10**9 * 10**18, therefore it is safe to use uint96 to represent the TDrop token (2**96/10**18 is roughly 79 billion).
    uint public constant maxSupply = 20_000_000_000e18; // 20 billion TDrop. 

    /// @notice Max token minted through airdrop
    uint public constant maxAirdrop = 10_000_000_000e18; // 10 billion TDrop. 

    /// @notice Max token minted for staking reward
    uint public constant maxStakeReward = 4_000_000_000e18; // 4 billion TDrop. 

    /// @notice Max token minted through liquidity mining
    uint public constant maxLiquidityMiningReward = 6_000_000_000e18; // 6 billion TDrop. 

    /// @notice Total number of tokens in circulation
    uint public totalSupply = 0; 

    /// @notice Accumulated token minted through airdrop
    uint public airdropAccumulated = 0;

    /// @notice Accumulated token minted for staking reward
    uint public stakeRewardAccumulated = 0;

    /// @notice Accumulated token minted through liquidity mining
    uint public liquidityMiningAccumulated = 0;

    /// @notice The super admin address
    address public superAdmin;

    /// @notice The admin address
    address public admin;

    /// @notice Address which may airdrop new tokens
    address public airdropper;

    // @notice Address which may mint stake reward
    address public stakingPool;

    /// @notice The liquidity miner address (i.e., the marketplace contract address)
    address public liquidityMiner;

    /// @notice if the token is allowed to be transferred
    bool public paused;

    /// @notice Allowance amounts on behalf of others
    mapping (address => mapping (address => uint96)) internal allowances;

    /// @notice Official record of token balances for each account
    mapping (address => uint96) internal balances;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the permit struct used by the contract
    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice An event thats emitted when the super admin address is changed
    event SuperAdminChanged(address superAdmin, address newSuperAdmin);

    /// @notice An event thats emitted when the admin address is changed
    event AdminChanged(address admin, address newAdmin);

    /// @notice An event thats emitted when the airdropper address is changed
    event AirdropperChanged(address airdropper, address newAirdropper);

    /// @notice An event thats emitted when the staking pool address is changed
    event StakingPoolChanged(address stakingPool, address newStakingPool);

    /// @notice An event thats emitted when the liquidityMiner address is changed
    event LiquidityMinerChanged(address liquidityMiner, address newLiquidityMiner);

    /// @notice An event thats emitted when the token contract is paused
    event TokenPaused();

    /// @notice An event thats emitted when the token contract is unpaused
    event TokenUnpaused();

    /// @notice An event thats emitted when new tokens are mined through NFT liquidity mining
    event TokenMined(address recipient, uint amount);

    /// @notice An event thats emitted when tokens are airdropped
    event TokenAirdropped(address airdropper);

    /// @notice An event thats emitted when tokens issued for staking reward
    event StakingRewwardIssued(address recipient, uint amount);

    /// @notice The standard EIP-20 transfer event
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /// @notice The standard EIP-20 approval event
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    /**
     * @notice Construct a new TDrop token
     * @param superAdmin_ The account with super admin permission
     * @param admin_ The account with admin permission
     */
    constructor(address superAdmin_, address admin_) public {
        require(superAdmin_ != address(0), "superAdmin_ is address0"); 
        require(admin_ != address(0), "admin_ is address0");

        superAdmin = superAdmin_;
        emit SuperAdminChanged(address(0), superAdmin);
        admin = admin_;
        emit AdminChanged(address(0), admin);
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
     * @notice Change the airdropper address
     * @param airdropper_ The address of the new airdropper
     */
    function setAirdropper(address airdropper_) onlyAdmin external {
        emit AirdropperChanged(airdropper, airdropper_);
        airdropper = airdropper_;
    }

    /**
     * @notice Change the stakingPool address
     * @param stakingPool_ The address of the new airdropper
     */
    function setStakingPool(address stakingPool_) onlyAdmin external {
        emit StakingPoolChanged(stakingPool, stakingPool_);
        stakingPool = stakingPool_;
    }

    /**
     * @notice Change the liquidity miner address
     * @param liquidityMiner_ The address of the new liquidity miner
     */
    function setLiquidityMiner(address liquidityMiner_) onlyAdmin external {
        emit LiquidityMinerChanged(liquidityMiner, liquidityMiner_);
        liquidityMiner = liquidityMiner_;
    }

    /**
     * @notice Pause token transfer
     */
    function pause() onlyAdmin external {
        paused = true;
        emit TokenPaused();
    }

    /**
     * @notice Unpause token transfer
     */
    function unpause() onlyAdmin external {
        paused = false;
        emit TokenUnpaused();
    }

    /**
     * @notice Mint new tokens
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to be minted
     */
    function _mint(address dst, uint rawAmount) onlyMinters internal {
        require(dst != address(0), "TDrop::mint: cannot transfer to the zero address");

        // mint the amount
        uint96 amount = safe96(rawAmount, "TDrop::mint: amount exceeds 96 bits");
        totalSupply = safe96(SafeMath.add(totalSupply, amount), "TDrop::mint: totalSupply exceeds 96 bits");
        require(totalSupply <= maxSupply, "TDrop::mint: totalSupply exceeds maxSupply");

        // transfer the amount to the recipient
        balances[dst] = add96(balances[dst], amount, "TDrop::mint: transfer amount overflows");
        emit Transfer(address(0), dst, amount);
    }

    /**
     * @notice Mine new tokens through liquidity mining, only the liquidity miner, i.e. the marketplace contract can call this method
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to be minted
     */
    function mine(address dst, uint rawAmount) onlyLiquidityMiner external {
        _mint(dst, rawAmount);

        uint96 amount = safe96(rawAmount, "TDrop::mine: amount exceeds 96 bits");
        liquidityMiningAccumulated = safe96(SafeMath.add(liquidityMiningAccumulated, amount), "TDrop::mine: liquidityMiningAccumulated exceeds 96 bits");
        require(liquidityMiningAccumulated <= maxLiquidityMiningReward, "TDrop::mine: accumlated airdrop token exceeds the max");

        emit TokenMined(dst, amount);
    }

    /**
     * @notice Airdrop tokens for the given list of addresses
     * @param dsts The addresses of the destination accounts
     * @param rawAmounts The number of tokens to be airdropped to each destination account
     */
    function airdrop(address[] calldata dsts, uint[] calldata rawAmounts) onlyAirdropper external {
        require(dsts.length == rawAmounts.length);
        uint numDsts = dsts.length;
        for (uint i = 0; i < numDsts; i ++) {
            address dst = dsts[i];
            uint rawAmount = rawAmounts[i];
            if (rawAmount == 0) {
                continue;
            }

            _mint(dst, rawAmount);

            uint96 amount = safe96(rawAmount, "TDrop::airdrop: amount exceeds 96 bits");
            airdropAccumulated = safe96(SafeMath.add(airdropAccumulated, amount), "TDrop::airdrop: airdropAccumulated exceeds 96 bits");
            require(airdropAccumulated <= maxAirdrop, "TDrop::airdrop: accumlated airdrop token exceeds the max");
        }

        emit TokenAirdropped(airdropper);
    }

    /**
     * @notice Mine new tokens for staking reward, only the staking contract can call this method
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to be minted
     */
    function stakeReward(address dst, uint rawAmount) onlyStakingPool external {
        _mint(dst, rawAmount);

        uint96 amount = safe96(rawAmount, "TDrop::stakeReward: amount exceeds 96 bits");
        stakeRewardAccumulated = safe96(SafeMath.add(stakeRewardAccumulated, amount), "TDrop::stakeReward: stakeRewardAccumulated exceeds 96 bits");
        require(stakeRewardAccumulated <= maxStakeReward, "TDrop::stakeReward: accumlated stakeReward token exceeds the max");

        emit StakingRewwardIssued(dst, amount);
    }

    /**
     * @notice Get the number of tokens `spender` is approved to spend on behalf of `account`
     * @param account The address of the account holding the funds
     * @param spender The address of the account spending the funds
     * @return The number of tokens approved
     */
    function allowance(address account, address spender) external view returns (uint) {
        return allowances[account][spender];
    }

    /**
     * @notice Approve `spender` to transfer up to `amount` from `src`
     * @dev This will overwrite the approval amount for `spender`
     *  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
     * @param spender The address of the account which may transfer tokens
     * @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
     * @return Whether or not the approval succeeded
     */
    function approve(address spender, uint rawAmount) onlyWhenUnpaused external returns (bool) {
        uint96 amount;
        if (rawAmount == uint(-1)) {
            amount = uint96(-1);
        } else {
            amount = safe96(rawAmount, "TDrop::approve: amount exceeds 96 bits");
        }

        allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Triggers an approval from owner to spends
     * @param owner The address to approve from
     * @param spender The address to be approved
     * @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
     * @param deadline The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function permit(address owner, address spender, uint rawAmount, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
        uint96 amount;
        if (rawAmount == uint(-1)) {
            amount = uint96(-1);
        } else {
            amount = safe96(rawAmount, "TDrop::permit: amount exceeds 96 bits");
        }

        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, rawAmount, nonces[owner]++, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = _recover(digest, v, r, s);
        require(signatory != address(0), "TDrop::permit: invalid signature");
        require(signatory == owner, "TDrop::permit: unauthorized");
        require(now <= deadline, "TDrop::permit: signature expired");

        allowances[owner][spender] = amount;

        emit Approval(owner, spender, amount);
    }

    function _recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (281): 0 < s < secp256k1n ÷ 2 + 1, and for v in (282): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "ECDSA: invalid signature 's' value");
        require(v == 27 || v == 28, "ECDSA: invalid signature 'v' value");

        // If the signature is valid (and not malleable), return the signer address
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }

    /**
     * @notice Get the number of tokens held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of tokens held
     */
    function balanceOf(address account) external view returns (uint) {
        return balances[account];
    }

    /**
     * @notice Transfer `amount` tokens from `msg.sender` to `dst`
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transfer(address dst, uint rawAmount) external returns (bool) {
        uint96 amount = safe96(rawAmount, "TDrop::transfer: amount exceeds 96 bits");
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /**
     * @notice Transfer `amount` tokens from `src` to `dst`
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferFrom(address src, address dst, uint rawAmount) external returns (bool) {
        address spender = msg.sender;
        uint96 spenderAllowance = allowances[src][spender];
        uint96 amount = safe96(rawAmount, "TDrop::approve: amount exceeds 96 bits");

        if (spender != src && spenderAllowance != uint96(-1)) {
            uint96 newAllowance = sub96(spenderAllowance, amount, "TDrop::transferFrom: transfer amount exceeds spender allowance");
            allowances[src][spender] = newAllowance;

            emit Approval(src, spender, newAllowance);
        }

        _transferTokens(src, dst, amount);
        return true;
    }

    function _transferTokens(address src, address dst, uint96 amount) onlyWhenUnpaused internal {
        require(src != address(0), "TDrop::_transferTokens: cannot transfer from the zero address");
        require(dst != address(0), "TDrop::_transferTokens: cannot transfer to the zero address");

        balances[src] = sub96(balances[src], amount, "TDrop::_transferTokens: transfer amount exceeds balance");
        balances[dst] = add96(balances[dst], amount, "TDrop::_transferTokens: transfer amount overflows");
        emit Transfer(src, dst, amount);
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

    modifier onlyLiquidityMiner { 
        require(msg.sender == liquidityMiner, "TDrop::onlyLiquidityMiner: only the liquidity miner can perform this action");
        _; 
    }

    modifier onlyAirdropper { 
        require(msg.sender == airdropper, "TDrop::onlyAirdropper: only the airdropper can perform this action");
        _; 
    }

    modifier onlyStakingPool { 
        require(msg.sender == stakingPool, "TDrop::onlyStakingPool: only the stakingpool can perform this action");
        _; 
    }

    modifier onlyMinters { 
        require(msg.sender == airdropper || msg.sender == liquidityMiner || msg.sender == stakingPool, "TDrop::onlyMinters: only the minters can perform this action");
        _; 
    }

    modifier onlyWhenUnpaused {
        require(!paused, "TDrop::onlyWhenUnpaused: token is paused");
        _;
    }
}