// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title MemoriaRegistry — anchors Merkle roots of Phronesis audit blobs on 0G Chain
contract MemoriaRegistry {
    struct RootEntry {
        bytes32 root;
        bytes32 storageHash;
        uint256 ts;
    }

    address public owner;
    address public agent;
    RootEntry[] private _roots;

    event RootAnchored(bytes32 indexed merkleRoot, bytes32 indexed storageHash, uint256 ts);
    event AgentUpdated(address indexed agent);

    error NotOwner();
    error NotAgent();
    error NoRoots();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent && msg.sender != owner) revert NotAgent();
        _;
    }

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    function updateRoot(bytes32 merkleRoot, bytes32 storageRootHash) external onlyAgent {
        _roots.push(RootEntry({root: merkleRoot, storageHash: storageRootHash, ts: block.timestamp}));
        emit RootAnchored(merkleRoot, storageRootHash, block.timestamp);
    }

    function latestRoot() external view returns (RootEntry memory) {
        if (_roots.length == 0) revert NoRoots();
        return _roots[_roots.length - 1];
    }

    function rootCount() external view returns (uint256) {
        return _roots.length;
    }

    function rootAt(uint256 index) external view returns (RootEntry memory) {
        return _roots[index];
    }
}
