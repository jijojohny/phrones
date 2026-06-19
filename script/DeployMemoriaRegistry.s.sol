// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {MemoriaRegistry} from "../contracts/MemoriaRegistry.sol";

contract DeployMemoriaRegistry is Script {
    function run() external returns (MemoriaRegistry registry) {
        address agent = vm.envOr("DEPLOYER_ADDRESS_TESTNET", msg.sender);
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY_TESTNET");

        vm.startBroadcast(deployerKey);
        registry = new MemoriaRegistry(agent);
        vm.stopBroadcast();
    }
}
