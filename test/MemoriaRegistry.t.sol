// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {MemoriaRegistry} from "../contracts/MemoriaRegistry.sol";

contract MemoriaRegistryTest is Test {
    function testUpdateRoot() public {
        address agent = address(0xBEEF);
        MemoriaRegistry registry = new MemoriaRegistry(agent);

        vm.prank(agent);
        registry.updateRoot(bytes32(uint256(1)), bytes32(uint256(2)));

        MemoriaRegistry.RootEntry memory latest = registry.latestRoot();
        assertEq(latest.root, bytes32(uint256(1)));
        assertEq(latest.storageHash, bytes32(uint256(2)));
        assertEq(registry.rootCount(), 1);
    }
}
