// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ExecutionPolicy} from "../contracts/ExecutionPolicy.sol";

contract ExecutionPolicyTest is Test {
    ExecutionPolicy policy;

    function setUp() public {
        policy = new ExecutionPolicy(
            uint64(block.timestamp + 1 days),
            5000,
            1000,
            1000
        );
        policy.setContractAllowed(0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E, true);
        policy.setSelectorAllowed(0x3629b973, true);
    }

    function testAllowsValidOrder() public view {
        assertTrue(
            policy.isOrderAllowed(
                0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E,
                0x3629b973,
                500
            )
        );
    }

    function testRejectsOverLimit() public view {
        assertFalse(
            policy.isOrderAllowed(
                0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E,
                0x3629b973,
                2000
            )
        );
    }

    function testRejectsUnknownContract() public view {
        assertFalse(
            policy.isOrderAllowed(
                address(uint160(0xBEEF)),
                0x3629b973,
                100
            )
        );
    }
}
