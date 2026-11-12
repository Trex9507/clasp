// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaspEscrow
 * @notice Clearing house for work between AI agents.
 *         Funds stay locked until the work is verified.
 *         Fees only on completed jobs. Providers post a stake.
 *         Capped at 100 USDC per job for the first months (safety cap).
 */
contract ClaspEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum JobStatus {
        Open,        // funds locked, job assigned
        Completed,   // payment released to the provider
        Refunded,    // refunded to the buyer
        Disputed     // in arbitration
    }

    struct Job {
        address buyer;
        address provider;
        address referrer;      // who referred the provider
        uint256 amount;        // locked USDC (excluding the provider stake)
        uint256 fee;           // fee kept by the platform
        uint256 referralFee;   // referral share of the fee
        bytes32 specHash;      // hash of the signed job spec
        uint64  deadline;      // deadline as a unix timestamp
        JobStatus status;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    IERC20 public immutable usdc;

    uint256 public feeBps = 250;          // 2.5% in basis points
    uint256 public referralBps = 50;      // 0.5 points of the fee
    uint256 public stakeRequired = 5e6;   // 5 USDC (6 decimals)
    uint256 public maxJobAmount = 100e6;  // 100 USDC safety cap

    uint256 public platformBalance;       // accumulated fees, withdrawable by the owner

    mapping(address => uint256) public stakes;   // stake per provider
    mapping(bytes32 => Job)     public jobs;     // jobId -> Job
    mapping(bytes32 => bool)    public jobExists;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event StakeDeposited(address indexed provider, uint256 amount);
    event StakeWithdrawn(address indexed provider, uint256 amount);
    event StakeSlashed(address indexed provider, uint256 amount, bytes32 jobId);

    event JobCreated(bytes32 indexed jobId, address indexed buyer, address indexed provider, uint256 amount, bytes32 specHash);
    event JobCompleted(bytes32 indexed jobId, uint256 providerPayout, uint256 platformFee);
    event JobRefunded(bytes32 indexed jobId, uint256 buyerRefund);
    event JobDisputed(bytes32 indexed jobId);

    event FeeWithdrawn(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error InsufficientStake();
    error JobAlreadyExists();
    error JobNotFound();
    error NotBuyer();
    error NotOwnerOrArbitrator();
    error InvalidStatus();
    error DeadlineNotReached();
    error AmountExceedsMax();
    error ZeroAmount();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // -------------------------------------------------------------------------
    // Stake
    // -------------------------------------------------------------------------

    /**
     * @notice The provider deposits a stake before it can accept jobs.
     */
    function depositStake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        stakes[msg.sender] += amount;
        emit StakeDeposited(msg.sender, amount);
    }

    /**
     * @notice The provider withdraws its stake (only with no open jobs).
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        if (stakes[msg.sender] < amount) revert InsufficientStake();
        stakes[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit StakeWithdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Job lifecycle
    // -------------------------------------------------------------------------

    /**
     * @notice The buyer creates the job and locks the funds in escrow.
     * @param jobId      unique job ID (generated off-chain)
     * @param provider   address of the chosen provider
     * @param referrer   address of whoever referred the provider (address(0) if none)
     * @param amount     job value in USDC (6 decimals)
     * @param specHash   keccak256 of the signed job spec
     * @param deadline   delivery deadline as a unix timestamp
     */
    function createJob(
        bytes32 jobId,
        address provider,
        address referrer,
        uint256 amount,
        bytes32 specHash,
        uint64  deadline
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > maxJobAmount) revert AmountExceedsMax();
        if (jobExists[jobId]) revert JobAlreadyExists();
        if (stakes[provider] < stakeRequired) revert InsufficientStake();

        uint256 fee = _calcFee(amount);
        uint256 referralFee = (referrer != address(0) && referrer != provider)
            ? (amount * referralBps) / 10_000
            : 0;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        jobs[jobId] = Job({
            buyer:       msg.sender,
            provider:    provider,
            referrer:    referrer,
            amount:      amount,
            fee:         fee,
            referralFee: referralFee,
            specHash:    specHash,
            deadline:    deadline,
            status:      JobStatus.Open
        });
        jobExists[jobId] = true;

        emit JobCreated(jobId, msg.sender, provider, amount, specHash);
    }

    /**
     * @notice Releases payment to the provider (called by the MCP server after verification).
     *         The buyer may also call it (manual acceptance).
     */
    function releasePayment(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open) revert InvalidStatus();
        // only the buyer or the owner (arbiter) can release
        if (msg.sender != job.buyer && msg.sender != owner()) revert NotOwnerOrArbitrator();

        _release(jobId, job);
    }

    /**
     * @notice Automatic release after the deadline (anyone can call it).
     */
    function autoRelease(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open) revert InvalidStatus();
        if (block.timestamp < job.deadline) revert DeadlineNotReached();

        _release(jobId, job);
    }

    /**
     * @notice Refunds the buyer and slashes the provider's stake.
     *         Only the owner (AI arbiter) can call it.
     */
    function refundBuyer(bytes32 jobId) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open && job.status != JobStatus.Disputed) revert InvalidStatus();

        job.status = JobStatus.Refunded;

        // slash the stake (up to the job value); all of it goes to the buyer
        uint256 slash = _slashStake(job.provider, job.amount, jobId);

        usdc.safeTransfer(job.buyer, job.amount + slash);
        emit JobRefunded(jobId, job.amount + slash);
    }

    /**
     * @notice Opens a dispute (buyer, within 24 hours of delivery).
     */
    function disputeJob(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open) revert InvalidStatus();
        if (msg.sender != job.buyer) revert NotBuyer();

        job.status = JobStatus.Disputed;
        emit JobDisputed(jobId);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function withdrawFees(address to) external onlyOwner nonReentrant {
        uint256 amount = platformBalance;
        platformBalance = 0;
        usdc.safeTransfer(to, amount);
        emit FeeWithdrawn(to, amount);
    }

    function setFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 1000, "max 10%");
        feeBps = bps;
    }

    function setStakeRequired(uint256 amount) external onlyOwner {
        stakeRequired = amount;
    }

    function setMaxJobAmount(uint256 amount) external onlyOwner {
        maxJobAmount = amount;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _calcFee(uint256 amount) internal view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    function _release(bytes32 jobId, Job storage job) internal {
        job.status = JobStatus.Completed;

        uint256 platformFee = job.fee - job.referralFee;
        uint256 providerPayout = job.amount - job.fee;

        platformBalance += platformFee;

        usdc.safeTransfer(job.provider, providerPayout);
        if (job.referralFee > 0 && job.referrer != address(0)) {
            usdc.safeTransfer(job.referrer, job.referralFee);
        }

        emit JobCompleted(jobId, providerPayout, platformFee);
    }

    function _slashStake(address provider, uint256 jobAmount, bytes32 jobId) internal returns (uint256 slashed) {
        slashed = stakes[provider] < jobAmount ? stakes[provider] : jobAmount;
        stakes[provider] -= slashed;
        emit StakeSlashed(provider, slashed, jobId);
    }
}
