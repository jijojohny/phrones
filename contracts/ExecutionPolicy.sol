// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title ExecutionPolicy — on-chain mirror of Phase 3 session policy (ERC-7579 hook target)
/// @notice Stores spending limits and contract whitelist for off-chain + on-chain validation
contract ExecutionPolicy {
    struct PolicyConfig {
        uint64 validUntil;
        uint256 dailyLimitUsdc;
        uint256 perTxLimitUsdc;
        uint256 maxNavUsdc;
        bool paused;
    }

    PolicyConfig public policy;
    address public owner;
    address public sessionSigner;

    mapping(address => bool) public allowedContract;
    mapping(bytes4 => bool) public allowedSelector;

    event PolicyUpdated(uint64 validUntil, uint256 dailyLimit, uint256 perTxLimit);
    event SessionSignerUpdated(address indexed signer);
    event ContractAllowed(address indexed target, bool allowed);
    event SelectorAllowed(bytes4 indexed selector, bool allowed);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        uint64 validUntil_,
        uint256 dailyLimitUsdc_,
        uint256 perTxLimitUsdc_,
        uint256 maxNavUsdc_
    ) {
        owner = msg.sender;
        policy = PolicyConfig({
            validUntil: validUntil_,
            dailyLimitUsdc: dailyLimitUsdc_,
            perTxLimitUsdc: perTxLimitUsdc_,
            maxNavUsdc: maxNavUsdc_,
            paused: false
        });
    }

    function updatePolicy(
        uint64 validUntil_,
        uint256 dailyLimitUsdc_,
        uint256 perTxLimitUsdc_,
        uint256 maxNavUsdc_
    ) external onlyOwner {
        policy.validUntil = validUntil_;
        policy.dailyLimitUsdc = dailyLimitUsdc_;
        policy.perTxLimitUsdc = perTxLimitUsdc_;
        policy.maxNavUsdc = maxNavUsdc_;
        emit PolicyUpdated(validUntil_, dailyLimitUsdc_, perTxLimitUsdc_);
    }

    function setSessionSigner(address signer_) external onlyOwner {
        sessionSigner = signer_;
        emit SessionSignerUpdated(signer_);
    }

    function setContractAllowed(address target, bool allowed) external onlyOwner {
        allowedContract[target] = allowed;
        emit ContractAllowed(target, allowed);
    }

    function setSelectorAllowed(bytes4 selector, bool allowed) external onlyOwner {
        allowedSelector[selector] = allowed;
        emit SelectorAllowed(selector, allowed);
    }

    function setPaused(bool paused_) external onlyOwner {
        policy.paused = paused_;
        emit Paused(paused_);
    }

    /// @dev sizeUsd6 — intent size with 6 decimal places (micro-USDC)
    function isOrderAllowed(
        address target,
        bytes4 selector,
        uint256 sizeUsd6
    ) external view returns (bool) {
        PolicyConfig memory p = policy;
        if (p.paused) return false;
        if (block.timestamp > p.validUntil) return false;
        if (!allowedContract[target]) return false;
        if (!allowedSelector[selector]) return false;
        if (sizeUsd6 > p.perTxLimitUsdc) return false;
        if (sizeUsd6 > p.maxNavUsdc) return false;
        return true;
    }
}
