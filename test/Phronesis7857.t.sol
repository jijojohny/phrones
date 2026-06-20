// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";
import {PhronesisOracle} from "../contracts/PhronesisOracle.sol";
import {IntentBridge} from "../contracts/IntentBridge.sol";

contract Phronesis7857Test is Test {
    PhronesisFund fund;
    PhronesisOracle oracle;

    address seller = address(0xA11CE);
    address buyer = address(0xB0B);
    bytes constant PROOF_SUFFIX = "tee-reencryption-attestation-v1";
    bytes32 newHash;
    bytes proof;

    function setUp() public {
        oracle = new PhronesisOracle();
        vm.prank(seller);
        fund = new PhronesisFund(address(oracle), address(0xCAFE), 100 ether);
        vm.prank(seller);
        fund.initialize(bytes32(uint256(1)), "0g://old");

        newHash = bytes32(uint256(99));
        proof = abi.encodePacked(newHash, PROOF_SUFFIX);
        oracle.registerTransferProof(keccak256(proof), bytes32(uint256(1)), newHash, true);
    }

    function testErc7857Transfer() public {
        bytes memory sealedKey = hex"deadbeef";

        fund.transfer(seller, buyer, 1, sealedKey, proof);

        assertEq(fund.ownerOf(1), buyer);
        assertEq(fund.metadataHash(1), newHash);
        assertEq(fund.fundOwner(), buyer);
    }

    function testErc7857Clone() public {
        bytes memory sealedKey = hex"cafebabe";

        vm.prank(seller);
        uint256 newId = fund.clone(buyer, 1, sealedKey, proof);

        assertEq(newId, 2);
        assertEq(fund.ownerOf(1), seller);
        assertEq(fund.ownerOf(2), buyer);
        assertEq(fund.metadataHash(2), newHash);
    }

    function testAuthorizeUsageForToken() public {
        bytes memory perms = '{"role":"executor"}';
        vm.prank(seller);
        fund.authorizeUsage(1, buyer, perms);
        // no revert — UsageAuthorizedForToken emitted
    }
}

contract IntentBridgeTest is Test {
    IntentBridge bridge;
    uint256 sellerKey = 0xA11CE;
    address seller;

    function setUp() public {
        bridge = new IntentBridge();
        seller = vm.addr(sellerKey);
    }

    function testSubmitAndMarkExecuted() public {
        bytes32 intentHash = keccak256("intent-1");
        uint256 targetChain = 137;
        bytes memory payload = hex"010203";
        bytes memory inner = abi.encode(intentHash, targetChain, payload);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(inner)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sellerKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(seller);
        bridge.submitIntent(intentHash, targetChain, "0xmarket", payload, sig);

        assertEq(bridge.intentCount(), 1);

        bytes32 polyTx = keccak256("polygon-tx");
        bridge.markExecuted(intentHash, polyTx);

        (,,,,, bool executed, bytes32 execHash) = bridge.intents(intentHash);
        assertTrue(executed);
        assertEq(execHash, polyTx);
    }
}
