// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClaspEscrow.sol";

/// @notice Deploys ClaspEscrow against the USDC token given in USDC_ADDRESS.
contract Deploy is Script {
    function run() external returns (ClaspEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        vm.startBroadcast();
        escrow = new ClaspEscrow(usdc);
        vm.stopBroadcast();
    }
}
