// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IAgentOracle — TEE/ZKP oracle for ERC-7857 metadata re-encryption
interface IAgentOracle {
    struct TransferValidity {
        bytes32 oldDataHash;
        bytes32 newDataHash;
        bool receiverHasAccess;
    }

    event TransferProcessed(bytes32 indexed proofHash, bytes32 oldHash, bytes32 newHash);

    function verifyProof(bytes calldata proof) external view returns (bool);

    function verifyTransferValidity(bytes calldata proof, bytes32 newDataHash)
        external
        view
        returns (TransferValidity memory);

    function registerProof(bytes32 proofHash) external;

    function registerTransferProof(
        bytes32 proofHash,
        bytes32 oldDataHash,
        bytes32 newDataHash,
        bool receiverHasAccess
    ) external;
}
