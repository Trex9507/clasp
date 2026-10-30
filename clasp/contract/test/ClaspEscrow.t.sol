// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClaspEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// USDC finto per i test
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract ClaspEscrowTest is Test {
    ClaspEscrow escrow;
    MockUSDC    usdc;

    address owner    = address(this);
    address buyer    = makeAddr("buyer");
    address provider = makeAddr("provider");
    address referrer = makeAddr("referrer");

    uint256 constant STAKE    = 5e6;   // 5 USDC
    uint256 constant JOB_AMT  = 20e6;  // 20 USDC
    uint256 constant FEE_BPS  = 250;   // 2,5%

    bytes32 constant JOB_ID   = keccak256("job-001");
    bytes32 constant SPEC     = keccak256("spec-001");

    function setUp() public {
        usdc   = new MockUSDC();
        escrow = new ClaspEscrow(address(usdc));

        // fondi iniziali
        usdc.mint(buyer,    1000e6);
        usdc.mint(provider, 1000e6);

        // approve
        vm.prank(buyer);    usdc.approve(address(escrow), type(uint256).max);
        vm.prank(provider); usdc.approve(address(escrow), type(uint256).max);
    }

    // ---------- stake ----------

    function test_depositStake() public {
        vm.prank(provider);
        escrow.depositStake(STAKE);
        assertEq(escrow.stakes(provider), STAKE);
    }

    function test_withdrawStake() public {
        vm.startPrank(provider);
        escrow.depositStake(STAKE);
        escrow.withdrawStake(STAKE);
        vm.stopPrank();
        assertEq(escrow.stakes(provider), 0);
    }

    function test_revert_withdrawStake_insufficient() public {
        vm.prank(provider);
        vm.expectRevert(ClaspEscrow.InsufficientStake.selector);
        escrow.withdrawStake(1);
    }

    // ---------- createJob ----------

    function _providerStaked() internal {
        vm.prank(provider);
        escrow.depositStake(STAKE);
    }

    function test_createJob() public {
        _providerStaked();
        vm.prank(buyer);
        escrow.createJob(JOB_ID, provider, address(0), JOB_AMT, SPEC, uint64(block.timestamp + 3600));

        (address b, address p,,,,,,,ClaspEscrow.JobStatus st) = _job(JOB_ID);
        assertEq(b, buyer);
        assertEq(p, provider);
        assertEq(uint8(st), uint8(ClaspEscrow.JobStatus.Open));
        assertEq(usdc.balanceOf(address(escrow)), JOB_AMT + STAKE);
    }

    function test_revert_createJob_noStake() public {
        vm.prank(buyer);
        vm.expectRevert(ClaspEscrow.InsufficientStake.selector);
        escrow.createJob(JOB_ID, provider, address(0), JOB_AMT, SPEC, uint64(block.timestamp + 3600));
    }

    function test_revert_createJob_duplicate() public {
        _providerStaked();
        vm.startPrank(buyer);
        escrow.createJob(JOB_ID, provider, address(0), JOB_AMT, SPEC, uint64(block.timestamp + 3600));
        vm.expectRevert(ClaspEscrow.JobAlreadyExists.selector);
        escrow.createJob(JOB_ID, provider, address(0), JOB_AMT, SPEC, uint64(block.timestamp + 3600));
        vm.stopPrank();
    }

    function test_revert_createJob_exceedsMax() public {
        _providerStaked();
        vm.prank(buyer);
        vm.expectRevert(ClaspEscrow.AmountExceedsMax.selector);
        escrow.createJob(JOB_ID, provider, address(0), 101e6, SPEC, uint64(block.timestamp + 3600));
    }

    // ---------- releasePayment ----------

    function _openJob() internal {
        _providerStaked();
        vm.prank(buyer);
        escrow.createJob(JOB_ID, provider, referrer, JOB_AMT, SPEC, uint64(block.timestamp + 3600));
    }

    function test_releasePayment_byBuyer() public {
        _openJob();
        uint256 provBefore = usdc.balanceOf(provider);
        uint256 refBefore  = usdc.balanceOf(referrer);

        vm.prank(buyer);
        escrow.releasePayment(JOB_ID);

        // fee totale = 2,5% di 20 = 0,50 USDC
        // referral   = 0,5% di 20 = 0,10 USDC → referrer
        // provider   = 20 - 0,50  = 19,50 USDC
        assertEq(usdc.balanceOf(provider) - provBefore, 19.5e6);
        assertEq(usdc.balanceOf(referrer) - refBefore,  0.1e6);
        assertEq(escrow.platformBalance(), 0.4e6);

        (,,,,,,,, ClaspEscrow.JobStatus st) = _job(JOB_ID);
        assertEq(uint8(st), uint8(ClaspEscrow.JobStatus.Completed));
    }

    function test_autoRelease_afterDeadline() public {
        _providerStaked();
        vm.prank(buyer);
        escrow.createJob(JOB_ID, provider, address(0), JOB_AMT, SPEC, uint64(block.timestamp + 100));

        vm.warp(block.timestamp + 101);
        escrow.autoRelease(JOB_ID); // chiunque può chiamarlo
        (,,,,,,,, ClaspEscrow.JobStatus st) = _job(JOB_ID);
        assertEq(uint8(st), uint8(ClaspEscrow.JobStatus.Completed));
    }

    function test_revert_autoRelease_beforeDeadline() public {
        _openJob();
        vm.expectRevert(ClaspEscrow.DeadlineNotReached.selector);
        escrow.autoRelease(JOB_ID);
    }

    // ---------- refundBuyer ----------

    function test_refundBuyer_slashesStake() public {
        _openJob();
        uint256 buyerBefore = usdc.balanceOf(buyer);

        escrow.refundBuyer(JOB_ID); // owner = arbitro

        // compratore riceve 20 USDC + 5 USDC di cauzione confiscata
        assertEq(usdc.balanceOf(buyer) - buyerBefore, JOB_AMT + STAKE);
        assertEq(escrow.stakes(provider), 0);
        (,,,,,,,, ClaspEscrow.JobStatus st) = _job(JOB_ID);
        assertEq(uint8(st), uint8(ClaspEscrow.JobStatus.Refunded));
    }

    function test_revert_refundBuyer_notOwner() public {
        _openJob();
        vm.prank(buyer);
        vm.expectRevert();
        escrow.refundBuyer(JOB_ID);
    }

    // ---------- disputeJob ----------

    function test_disputeJob() public {
        _openJob();
        vm.prank(buyer);
        escrow.disputeJob(JOB_ID);
        (,,,,,,,, ClaspEscrow.JobStatus st) = _job(JOB_ID);
        assertEq(uint8(st), uint8(ClaspEscrow.JobStatus.Disputed));
    }

    function test_revert_disputeJob_notBuyer() public {
        _openJob();
        vm.prank(provider);
        vm.expectRevert(ClaspEscrow.NotBuyer.selector);
        escrow.disputeJob(JOB_ID);
    }

    // ---------- admin ----------

    function test_withdrawFees() public {
        _openJob();
        vm.prank(buyer);
        escrow.releasePayment(JOB_ID);

        uint256 fees = escrow.platformBalance();
        assertTrue(fees > 0);
        escrow.withdrawFees(owner);
        assertEq(escrow.platformBalance(), 0);
        assertEq(usdc.balanceOf(owner), fees);
    }

    // ---------- helper ----------

    function _job(bytes32 id) internal view returns (
        address buyer, address provider, address referrer,
        uint256 amount, uint256 fee, uint256 referralFee,
        bytes32 specHash, uint64 deadline, ClaspEscrow.JobStatus status
    ) {
        return escrow.jobs(id);
    }
}
