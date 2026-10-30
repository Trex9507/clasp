// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClaspEscrow.sol";

contract ClaspEscrowTest is Test {
    ClaspEscrow escrow;

    function setUp() public {
        escrow = new ClaspEscrow();
    }

    function test_deploy() public view {
        assertTrue(address(escrow) != address(0));
    }
}
