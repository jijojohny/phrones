// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IAgentOracle} from "./interfaces/IAgentOracle.sol";

/// @title PhronesisOracle — TEE attestation oracle for ERC-7857 metadata re-encryption
contract PhronesisOracle is IAgentOracle {
    address public owner;
    mapping(bytes32 => bool) public verifiedProofs;

    struct RegisteredTransfer {
        bytes32 oldDataHash;
        bytes32 newDataHash;
        bool receiverHasAccess;
        bool registered;
    }

    mapping(bytes32 => RegisteredTransfer) public transferProofs;

    event ProofRegistered(bytes32 indexed proofHash);
    event TransferVerified(bytes32 indexed proofHash, bytes32 indexed newMetadataHash);
    event TransferProofRegistered(bytes32 indexed proofHash, bytes32 oldHash, bytes32 newHash);
    event OwnerUpdated(address indexed owner);

    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerProof(bytes32 proofHash) external onlyOwner {
        verifiedProofs[proofHash] = true;
        emit ProofRegistered(proofHash);
    }

    function registerTransferProof(
        bytes32 proofHash,
        bytes32 oldDataHash,
        bytes32 newDataHash,
        bool receiverHasAccess
    ) external onlyOwner {
        verifiedProofs[proofHash] = true;
        transferProofs[proofHash] = RegisteredTransfer({
            oldDataHash: oldDataHash,
            newDataHash: newDataHash,
            receiverHasAccess: receiverHasAccess,
            registered: true
        });
        emit TransferProofRegistered(proofHash, oldDataHash, newDataHash);
    }

    function verifyProof(bytes calldata proof) external view returns (bool) {
        return verifiedProofs[keccak256(proof)];
    }

    function verifyTransferValidity(bytes calldata proof, bytes32 newDataHash)
        external
        view
        returns (TransferValidity memory)
    {
        bytes32 proofHash = keccak256(proof);
        RegisteredTransfer memory reg = transferProofs[proofHash];
        if (!reg.registered || !verifiedProofs[proofHash]) {
            return TransferValidity({oldDataHash: bytes32(0), newDataHash: bytes32(0), receiverHasAccess: false});
        }
        if (reg.newDataHash != newDataHash) {
            return TransferValidity({oldDataHash: reg.oldDataHash, newDataHash: reg.newDataHash, receiverHasAccess: false});
        }
        return TransferValidity({
            oldDataHash: reg.oldDataHash,
            newDataHash: reg.newDataHash,
            receiverHasAccess: reg.receiverHasAccess
        });
    }

    /// @notice Record TEE-verified metadata rotation (legacy path for rotateMetadata)
    function verifyTransfer(bytes calldata proof, bytes32 newMetadataHash) external returns (bool) {
        TransferValidity memory v = this.verifyTransferValidity(proof, newMetadataHash);
        if (!v.receiverHasAccess) return false;
        emit TransferVerified(keccak256(proof), newMetadataHash);
        return true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }
}
