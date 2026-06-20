// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IntentBridge} from "../contracts/IntentBridge.sol";

contract DeployIntentBridge is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY_TESTNET");
        vm.startBroadcast(deployerPrivateKey);

        IntentBridge bridge = new IntentBridge();

        vm.stopBroadcast();

        console.log("IntentBridge deployed:", address(bridge));
    }
}
