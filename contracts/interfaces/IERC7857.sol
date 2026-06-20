// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IERC7857 — Agentic ID (iNFT) with encrypted metadata
/// @notice ERC-7857-inspired interface for secure AI agent tokenization on 0G
interface IERC7857 {
    event AgentTransferred(
        uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newMetadataHash
    );
    event AgentCloned(uint256 indexed sourceTokenId, uint256 indexed newTokenId, address indexed to);
    event SealedKeyPublished(uint256 indexed tokenId, address indexed to, bytes sealedKey);
    event UsageAuthorizedForToken(uint256 indexed tokenId, address indexed executor);

    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external;

    function clone(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external returns (uint256 newTokenId);

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function metadataHash(uint256 tokenId) external view returns (bytes32);

    function encryptedURI(uint256 tokenId) external view returns (string memory);

    function sealedKeyOf(uint256 tokenId, address holder) external view returns (bytes memory);
}
