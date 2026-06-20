// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";
import {PhronesisOracle} from "../contracts/PhronesisOracle.sol";

contract PhronesisTransferTest is Test {
    PhronesisFund fund;
    PhronesisOracle oracle;

    bytes constant PROOF_SUFFIX = "tee-reencryption-attestation-v1";
    bytes proof;

    function setUp() public {
        oracle = new PhronesisOracle();
        fund = new PhronesisFund(address(oracle), address(0xCAFE), 100 ether);
        fund.initialize(bytes32(uint256(1)), "0g://old");
    }

    function testRotateMetadataWithOracleProof() public {
        bytes32 newHash = bytes32(uint256(99));
        proof = abi.encodePacked(newHash, PROOF_SUFFIX);
        oracle.registerTransferProof(keccak256(proof), bytes32(uint256(1)), newHash, true);

        fund.rotateMetadata(newHash, "0g://new-metadata", proof);

        (bytes32 hash, string memory uri,,) = fund.config();
        assertEq(hash, newHash);
        assertEq(uri, "0g://new-metadata");
    }

    function testRotateRejectsInvalidProof() public {
        vm.expectRevert(PhronesisFund.InvalidOracleProof.selector);
        fund.rotateMetadata(bytes32(uint256(2)), "0g://bad", "invalid-proof");
    }
}
