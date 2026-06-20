// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IntentBridge — 0G control-plane registry for cross-chain trade intents
/// @notice Relayers watch IntentSubmitted events and execute on Polygon (chain 137)
contract IntentBridge {
    struct IntentRecord {
        address signer;
        uint256 targetChainId;
        bytes32 intentHash;
        bytes payload;
        uint256 submittedAt;
        bool executed;
        bytes32 executionTxHash;
    }

    address public owner;
    mapping(address => bool) public relayers;
    mapping(bytes32 => IntentRecord) public intents;
    uint256 public intentCount;

    event IntentSubmitted(
        bytes32 indexed intentHash,
        address indexed signer,
        uint256 targetChainId,
        string marketRef,
        uint256 submittedAt
    );
    event IntentExecuted(bytes32 indexed intentHash, address indexed relayer, bytes32 executionTxHash);
    event RelayerUpdated(address indexed relayer, bool allowed);

    error NotOwner();
    error NotRelayer();
    error IntentAlreadyExists();
    error IntentNotFound();
    error AlreadyExecuted();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (!relayers[msg.sender] && msg.sender != owner) revert NotRelayer();
        _;
    }

    constructor() {
        owner = msg.sender;
        relayers[msg.sender] = true;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        relayers[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    /// @notice Submit a signed cross-chain intent from 0G cognitive core
    function submitIntent(
        bytes32 intentHash,
        uint256 targetChainId,
        string calldata marketRef,
        bytes calldata payload,
        bytes calldata signature
    ) external {
        if (intents[intentHash].submittedAt != 0) revert IntentAlreadyExists();

        address signer = recoverSigner(intentHash, targetChainId, payload, signature);
        require(signer != address(0), "Invalid signature");

        intents[intentHash] = IntentRecord({
            signer: signer,
            targetChainId: targetChainId,
            intentHash: intentHash,
            payload: payload,
            submittedAt: block.timestamp,
            executed: false,
            executionTxHash: bytes32(0)
        });
        intentCount += 1;

        emit IntentSubmitted(intentHash, signer, targetChainId, marketRef, block.timestamp);
    }

    /// @notice Mark intent as executed after Polygon settlement
    function markExecuted(bytes32 intentHash, bytes32 executionTxHash) external onlyRelayer {
        IntentRecord storage rec = intents[intentHash];
        if (rec.submittedAt == 0) revert IntentNotFound();
        if (rec.executed) revert AlreadyExecuted();

        rec.executed = true;
        rec.executionTxHash = executionTxHash;
        emit IntentExecuted(intentHash, msg.sender, executionTxHash);
    }

    function recoverSigner(
        bytes32 intentHash,
        uint256 targetChainId,
        bytes calldata payload,
        bytes calldata signature
    ) public pure returns (address) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encode(intentHash, targetChainId, payload)))
        );
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(add(signature.offset, 0))
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
