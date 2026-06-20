// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";
import {PhronesisOracle} from "../contracts/PhronesisOracle.sol";

contract DeployPhronesisFund is Script {
    function run() external returns (PhronesisFund fund, PhronesisOracle oracle) {
        address smartAccount = vm.envOr("SAFE_ADDRESS_OG", vm.envOr("DEPLOYER_ADDRESS_TESTNET", msg.sender));
        uint256 maxAum = vm.envOr("FUND_MAX_AUM_WEI", uint256(1000 ether));
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY_TESTNET");

        vm.startBroadcast(deployerKey);
        oracle = new PhronesisOracle();
        fund = new PhronesisFund(address(oracle), smartAccount, maxAum);
        vm.stopBroadcast();
    }
}
