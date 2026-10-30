// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaspEscrow
 * @notice Camera di compensazione per lavori tra agenti AI.
 *         I fondi restano bloccati finché il lavoro non è verificato.
 *         Fee solo sui lavori completati. Cauzione del fornitore.
 *         Limite di 100 USDC per lavoro nei primi mesi (safety cap).
 */
contract ClaspEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Tipi
    // -------------------------------------------------------------------------

    enum JobStatus {
        Open,        // fondi bloccati, lavoro assegnato
        Completed,   // pagamento rilasciato al fornitore
        Refunded,    // rimborso al compratore
        Disputed     // in arbitrato
    }

    struct Job {
        address buyer;
        address provider;
        address referrer;      // chi ha portato il provider (referral)
        uint256 amount;        // USDC bloccato (escl. cauzione provider)
        uint256 fee;           // fee trattenuta dalla piattaforma
        uint256 referralFee;   // quota referral sulla fee
        bytes32 specHash;      // hash della scheda lavoro firmata
        uint64  deadline;      // unix timestamp scadenza
        JobStatus status;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    IERC20 public immutable usdc;

    uint256 public feeBps = 250;          // 2,5% in basis points
    uint256 public referralBps = 50;      // 0,5 punti della fee
    uint256 public stakeRequired = 5e6;   // 5 USDC (6 decimali)
    uint256 public maxJobAmount = 100e6;  // 100 USDC safety cap

    uint256 public platformBalance;       // fee accumulate, prelevabili dal owner

    mapping(address => uint256) public stakes;   // cauzione per provider
    mapping(bytes32 => Job)     public jobs;     // jobId → Job
    mapping(bytes32 => bool)    public jobExists;

    // -------------------------------------------------------------------------
    // Eventi
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
    // Errori
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
    // Cauzione (stake)
    // -------------------------------------------------------------------------

    /**
     * @notice Il provider deposita la cauzione prima di poter accettare lavori.
     */
    function depositStake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        stakes[msg.sender] += amount;
        emit StakeDeposited(msg.sender, amount);
    }

    /**
     * @notice Il provider ritira la cauzione (solo se non ha lavori aperti).
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        if (stakes[msg.sender] < amount) revert InsufficientStake();
        stakes[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit StakeWithdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Ciclo di vita del lavoro
    // -------------------------------------------------------------------------

    /**
     * @notice Il compratore crea il lavoro e blocca i fondi in escrow.
     * @param jobId      ID univoco del lavoro (generato off-chain)
     * @param provider   indirizzo del provider scelto
     * @param referrer   indirizzo di chi ha portato il provider (address(0) se nessuno)
     * @param amount     valore del lavoro in USDC (6 decimali)
     * @param specHash   keccak256 della scheda lavoro firmata
     * @param deadline   unix timestamp scadenza consegna
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
     * @notice Rilascia il pagamento al provider (chiamato dal server MCP dopo verifica).
     *         Può essere chiamato anche dal compratore (accettazione manuale).
     */
    function releasePayment(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open) revert InvalidStatus();
        // solo il compratore o il owner (arbitro) possono rilasciare
        if (msg.sender != job.buyer && msg.sender != owner()) revert NotOwnerOrArbitrator();

        _release(jobId, job);
    }

    /**
     * @notice Rilascio automatico dopo deadline (chiunque può chiamarlo).
     */
    function autoRelease(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open) revert InvalidStatus();
        if (block.timestamp < job.deadline) revert DeadlineNotReached();

        _release(jobId, job);
    }

    /**
     * @notice Rimborsa il compratore e confisca la cauzione del provider.
     *         Solo il owner (arbitro AI) può chiamarlo.
     */
    function refundBuyer(bytes32 jobId) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];
        if (!jobExists[jobId]) revert JobNotFound();
        if (job.status != JobStatus.Open && job.status != JobStatus.Disputed) revert InvalidStatus();

        job.status = JobStatus.Refunded;

        // confisca cauzione (fino al valore del lavoro, va interamente al compratore)
        uint256 slash = _slashStake(job.provider, job.amount, jobId);

        usdc.safeTransfer(job.buyer, job.amount + slash);
        emit JobRefunded(jobId, job.amount + slash);
    }

    /**
     * @notice Apre una contestazione (compratore entro 24h dalla consegna).
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
    // Interni
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
