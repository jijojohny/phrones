// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PhronesisShare} from "./PhronesisShare.sol";
import {PhronesisOracle} from "./PhronesisOracle.sol";
import {IERC7857} from "./interfaces/IERC7857.sol";
import {IAgentOracle} from "./interfaces/IAgentOracle.sol";

/// @title PhronesisFund — ERC-7857 agentic fund with fractional shares
contract PhronesisFund is IERC7857 {
    struct FundConfig {
        bytes32 metadataHash;
        string encryptedURI;
        address smartAccount;
        uint256 maxAUM;
    }

    struct UsageAuth {
        bytes permissions;
        uint256 expiresAt;
        bool active;
    }

    struct TokenData {
        address owner;
        bytes32 metadataHash;
        string encryptedURI;
        uint256 clonedFrom;
        bool exists;
    }

    uint256 public constant INITIAL_TOKEN_ID = 1;

    address public fundOwner;
    PhronesisShare public immutable shareToken;
    PhronesisOracle public immutable oracle;

    FundConfig public config;
    uint256 public navPerShare;
    uint256 public totalAssets;
    uint256 public nextTokenId = INITIAL_TOKEN_ID + 1;

    mapping(uint256 => TokenData) private _tokens;
    mapping(uint256 => mapping(address => bytes)) private _sealedKeys;
    mapping(uint256 => mapping(address => UsageAuth)) public executorAuth;
    mapping(address => UsageAuth) public investorAuth;

    event FundInitialized(bytes32 metadataHash, string encryptedURI);
    event Deposited(address indexed investor, uint256 amount, uint256 shares);
    event Redeemed(address indexed investor, uint256 shares, uint256 amount);
    event UsageAuthorized(address indexed investor, uint256 expiresAt);
    event UsageRevoked(address indexed investor);
    event NavUpdated(uint256 navPerShare, uint256 totalAssets);
    event MetadataUpdated(bytes32 metadataHash, string encryptedURI);
    event MetadataRotated(bytes32 indexed oldHash, bytes32 indexed newHash, string newURI);

    error NotOwner();
    error NotAuthorized();
    error NotTokenOwner();
    error ZeroAmount();
    error ExceedsMaxAUM();
    error Expired();
    error TransferFailed();
    error InvalidOracleProof();
    error InvalidRecipient();
    error TokenNotFound();

    modifier onlyFundOwner() {
        if (msg.sender != fundOwner) revert NotOwner();
        _;
    }

    constructor(address _oracle, address _smartAccount, uint256 _maxAUM) {
        fundOwner = msg.sender;
        oracle = PhronesisOracle(_oracle);
        shareToken = new PhronesisShare(address(this));
        navPerShare = 1e18;
        config = FundConfig({
            metadataHash: bytes32(0),
            encryptedURI: "",
            smartAccount: _smartAccount,
            maxAUM: _maxAUM
        });

        _tokens[INITIAL_TOKEN_ID] = TokenData({
            owner: msg.sender,
            metadataHash: bytes32(0),
            encryptedURI: "",
            clonedFrom: 0,
            exists: true
        });
    }

    /// @dev Legacy alias — fund deployer
    function owner() external view returns (address) {
        return fundOwner;
    }

    function initialize(bytes32 metadataHash, string calldata encryptedURI) external onlyFundOwner {
        config.metadataHash = metadataHash;
        config.encryptedURI = encryptedURI;
        _tokens[INITIAL_TOKEN_ID].metadataHash = metadataHash;
        _tokens[INITIAL_TOKEN_ID].encryptedURI = encryptedURI;
        emit FundInitialized(metadataHash, encryptedURI);
    }

    function setMetadata(bytes32 metadataHash, string calldata encryptedURI) external onlyFundOwner {
        config.metadataHash = metadataHash;
        config.encryptedURI = encryptedURI;
        _tokens[INITIAL_TOKEN_ID].metadataHash = metadataHash;
        _tokens[INITIAL_TOKEN_ID].encryptedURI = encryptedURI;
        emit MetadataUpdated(metadataHash, encryptedURI);
    }

    function rotateMetadata(bytes32 newMetadataHash, string calldata newURI, bytes calldata oracleProof)
        external
        onlyFundOwner
    {
        if (!oracle.verifyTransfer(oracleProof, newMetadataHash)) revert InvalidOracleProof();
        bytes32 oldHash = config.metadataHash;
        config.metadataHash = newMetadataHash;
        config.encryptedURI = newURI;
        _tokens[INITIAL_TOKEN_ID].metadataHash = newMetadataHash;
        _tokens[INITIAL_TOKEN_ID].encryptedURI = newURI;
        emit MetadataRotated(oldHash, newMetadataHash, newURI);
    }

    // ─── IERC7857 ───────────────────────────────────────────────────────────

    function ownerOf(uint256 tokenId) external view returns (address) {
        TokenData memory t = _tokens[tokenId];
        if (!t.exists) revert TokenNotFound();
        return t.owner;
    }

    function metadataHash(uint256 tokenId) external view returns (bytes32) {
        if (!_tokens[tokenId].exists) revert TokenNotFound();
        return _tokens[tokenId].metadataHash;
    }

    function encryptedURI(uint256 tokenId) external view returns (string memory) {
        if (!_tokens[tokenId].exists) revert TokenNotFound();
        return _tokens[tokenId].encryptedURI;
    }

    function sealedKeyOf(uint256 tokenId, address holder) external view returns (bytes memory) {
        return _sealedKeys[tokenId][holder];
    }

    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external {
        TokenData storage t = _tokens[tokenId];
        if (!t.exists) revert TokenNotFound();
        if (t.owner != from) revert NotTokenOwner();
        if (to == address(0)) revert InvalidRecipient();
        if (!oracle.verifyProof(proof)) revert InvalidOracleProof();

        bytes32 newHash = _extractNewHash(proof);
        IAgentOracle.TransferValidity memory v = oracle.verifyTransferValidity(proof, newHash);
        if (!v.receiverHasAccess) revert InvalidOracleProof();

        t.owner = to;
        t.metadataHash = v.newDataHash;
        if (bytes(sealedKey).length > 0) {
            _sealedKeys[tokenId][to] = sealedKey;
        }

        if (tokenId == INITIAL_TOKEN_ID) {
            fundOwner = to;
            config.metadataHash = v.newDataHash;
        }

        emit AgentTransferred(tokenId, from, to, v.newDataHash);
        emit SealedKeyPublished(tokenId, to, sealedKey);
    }

    function clone(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external returns (uint256 newTokenId) {
        TokenData storage src = _tokens[tokenId];
        if (!src.exists) revert TokenNotFound();
        if (src.owner != msg.sender && msg.sender != fundOwner) revert NotTokenOwner();
        if (to == address(0)) revert InvalidRecipient();
        if (!oracle.verifyProof(proof)) revert InvalidOracleProof();

        bytes32 newHash = _extractNewHash(proof);
        IAgentOracle.TransferValidity memory v = oracle.verifyTransferValidity(proof, newHash);
        if (!v.receiverHasAccess) revert InvalidOracleProof();

        newTokenId = nextTokenId++;
        _tokens[newTokenId] = TokenData({
            owner: to,
            metadataHash: v.newDataHash,
            encryptedURI: src.encryptedURI,
            clonedFrom: tokenId,
            exists: true
        });

        if (bytes(sealedKey).length > 0) {
            _sealedKeys[newTokenId][to] = sealedKey;
        }

        emit AgentCloned(tokenId, newTokenId, to);
        emit SealedKeyPublished(newTokenId, to, sealedKey);
    }

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external {
        TokenData storage t = _tokens[tokenId];
        if (!t.exists) revert TokenNotFound();
        if (t.owner != msg.sender) revert NotTokenOwner();

        executorAuth[tokenId][executor] = UsageAuth({
            permissions: permissions,
            expiresAt: 0,
            active: true
        });
        emit UsageAuthorizedForToken(tokenId, executor);
    }

    function _extractNewHash(bytes calldata proof) internal pure returns (bytes32) {
        if (proof.length < 32) revert InvalidOracleProof();
        bytes32 h;
        assembly {
            h := calldataload(proof.offset)
        }
        return h;
    }

    // ─── Fractional shares ──────────────────────────────────────────────────

    function deposit() external payable returns (uint256 shares) {
        if (msg.value == 0) revert ZeroAmount();
        if (totalAssets + msg.value > config.maxAUM) revert ExceedsMaxAUM();

        shares = (msg.value * 1e18) / navPerShare;
        if (shares == 0) revert ZeroAmount();

        totalAssets += msg.value;
        shareToken.mint(msg.sender, shares);

        emit Deposited(msg.sender, msg.value, shares);
    }

    function redeem(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (shareToken.balanceOf(msg.sender) < shares) revert NotAuthorized();

        uint256 amount = (shares * navPerShare) / 1e18;
        if (amount == 0) revert ZeroAmount();
        if (amount > totalAssets) revert ZeroAmount();

        shareToken.burn(msg.sender, shares);
        totalAssets -= amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Redeemed(msg.sender, shares, amount);
    }

    /// @dev Legacy alias for investor authorizeUsage (address-first overload)
    function authorizeUsage(address investor, bytes calldata permissions, uint256 expiresAt)
        external
        onlyFundOwner
    {
        investorAuth[investor] = UsageAuth({permissions: permissions, expiresAt: expiresAt, active: true});
        emit UsageAuthorized(investor, expiresAt);
    }

    function revokeUsage(address investor) external onlyFundOwner {
        delete investorAuth[investor];
        emit UsageRevoked(investor);
    }

    function isAuthorized(address investor) public view returns (bool) {
        UsageAuth memory auth = investorAuth[investor];
        if (!auth.active) return false;
        if (auth.expiresAt != 0 && block.timestamp > auth.expiresAt) return false;
        return true;
    }

    function updateNav(uint256 newNavPerShare) external onlyFundOwner {
        navPerShare = newNavPerShare;
        emit NavUpdated(navPerShare, totalAssets);
    }

    receive() external payable {
        totalAssets += msg.value;
    }
}
