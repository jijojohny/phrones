// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";

/// @dev Allowlist USDC/USDT on an already-deployed PhronesisFund (0G testnet).
contract AllowStablecoins is Script {
    uint8 constant STABLE_DECIMALS = 6;

    function run() external {
        address fundAddr = vm.envAddress("PHRONESIS_FUND_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY_TESTNET");

        address usdc = vm.envOr("FUND_USDC_ADDRESS_0G", address(0));
        address usdt = vm.envOr("FUND_USDT_ADDRESS_0G", address(0));

        vm.startBroadcast(deployerKey);
        PhronesisFund fund = PhronesisFund(payable(fundAddr));

        if (usdc != address(0)) {
            fund.setStablecoinAllowed(usdc, true, STABLE_DECIMALS);
        }
        if (usdt != address(0)) {
            fund.setStablecoinAllowed(usdt, true, STABLE_DECIMALS);
        }
        vm.stopBroadcast();
    }
}
