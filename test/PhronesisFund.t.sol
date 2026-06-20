// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";
import {PhronesisOracle} from "../contracts/PhronesisOracle.sol";

contract PhronesisFundTest is Test {
    PhronesisFund fund;
    PhronesisOracle oracle;
    address investor = address(0xBEEF);
    address smartAccount = address(0xCAFE);

    function setUp() public {
        oracle = new PhronesisOracle();
        fund = new PhronesisFund(address(oracle), smartAccount, 100 ether);
    }

    function testDepositAndRedeem() public {
        vm.deal(investor, 10 ether);

        vm.prank(investor);
        uint256 shares = fund.deposit{value: 1 ether}();
        assertEq(shares, 1 ether);
        assertEq(fund.shareToken().balanceOf(investor), 1 ether);
        assertEq(fund.totalAssets(), 1 ether);

        vm.prank(investor);
        fund.redeem(shares);
        assertEq(fund.shareToken().balanceOf(investor), 0);
        assertEq(investor.balance, 10 ether);
    }

    function testAuthorizeUsage() public {
        bytes memory perms = '{"role":"investor"}';
        fund.authorizeUsage(investor, perms, block.timestamp + 1 days);
        assertTrue(fund.isAuthorized(investor));

        fund.revokeUsage(investor);
        assertFalse(fund.isAuthorized(investor));
    }

    function testInitializeMetadata() public {
        fund.initialize(bytes32(uint256(42)), "0g://encrypted/metadata");
        (bytes32 hash,,,) = fund.config();
        assertEq(hash, bytes32(uint256(42)));
    }

    function testOracleProof() public {
        bytes memory proof = "tee-attestation-quote";
        bytes32 h = keccak256(proof);
        oracle.registerProof(h);
        assertTrue(oracle.verifyProof(proof));
    }
}
