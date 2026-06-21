// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {ExecutionPolicy} from "../contracts/ExecutionPolicy.sol";

contract DeployExecutionPolicy is Script {
    address constant CTF_EXCHANGE = 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E;
    address constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;

    function run() external {
        uint64 validUntil = uint64(block.timestamp + 30 days);
        uint256 dailyLimit = 5000;
        uint256 perTxLimit = 1000;
        uint256 maxNav = 1000;

        vm.startBroadcast();
        ExecutionPolicy policy = new ExecutionPolicy(validUntil, dailyLimit, perTxLimit, maxNav);
        policy.setContractAllowed(CTF_EXCHANGE, true);
        policy.setContractAllowed(USDC, true);
        policy.setSelectorAllowed(0x3629b973, true);
        vm.stopBroadcast();

        console.log("ExecutionPolicy:", address(policy));
    }
}
