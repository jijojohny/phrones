// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {PhronesisFund} from "../contracts/PhronesisFund.sol";
import {PhronesisOracle} from "../contracts/PhronesisOracle.sol";
import {MockStablecoin} from "../contracts/mocks/MockStablecoin.sol";

contract PhronesisFundTest is Test {
    PhronesisFund fund;
    PhronesisOracle oracle;
    MockStablecoin usdc;
    MockStablecoin usdt;
    address investor = address(0xBEEF);
    address smartAccount = address(0xCAFE);

    function setUp() public {
        oracle = new PhronesisOracle();
        fund = new PhronesisFund(address(oracle), smartAccount, 100 ether);
        usdc = new MockStablecoin("USD Coin", "USDC", 6);
        usdt = new MockStablecoin("Tether USD", "USDT", 6);
        fund.setStablecoinAllowed(address(usdc), true, 6);
        fund.setStablecoinAllowed(address(usdt), true, 6);
    }

    function testDepositAndRedeem() public {
        vm.deal(investor, 10 ether);

        vm.prank(investor);
        uint256 shares = fund.deposit{value: 1 ether}();
        assertEq(shares, 1 ether);
        assertEq(fund.shareToken().balanceOf(investor), 1 ether);
        assertEq(fund.totalAssets(), 1 ether);

        vm.prank(investor);
        fund.redeem(shares);
        assertEq(fund.shareToken().balanceOf(investor), 0);
        assertEq(investor.balance, 10 ether);
    }

    function testDepositAndRedeemUSDC() public {
        usdc.mint(investor, 10_000_000); // 10 USDC

        vm.startPrank(investor);
        usdc.approve(address(fund), 1_000_000); // 1 USDC
        uint256 shares = fund.depositERC20(address(usdc), 1_000_000);
        vm.stopPrank();

        assertEq(shares, 1 ether);
        assertEq(fund.stablecoinBalances(address(usdc)), 1_000_000);
        assertEq(fund.totalAssets(), 1 ether);

        vm.prank(investor);
        fund.redeemERC20(shares, address(usdc));
        assertEq(usdc.balanceOf(investor), 10_000_000);
        assertEq(fund.stablecoinBalances(address(usdc)), 0);
    }

    function testDepositAndRedeemUSDT() public {
        usdt.mint(investor, 5_000_000); // 5 USDT

        vm.startPrank(investor);
        usdt.approve(address(fund), 2_000_000); // 2 USDT
        uint256 shares = fund.depositERC20(address(usdt), 2_000_000);
        vm.stopPrank();

        assertEq(shares, 2 ether);
        assertEq(fund.stablecoinBalances(address(usdt)), 2_000_000);

        vm.prank(investor);
        fund.redeemERC20(shares, address(usdt));
        assertEq(usdt.balanceOf(investor), 5_000_000);
    }

    function testRejectsUnlistedStablecoin() public {
        MockStablecoin dai = new MockStablecoin("DAI", "DAI", 18);
        dai.mint(investor, 1 ether);
        vm.startPrank(investor);
        dai.approve(address(fund), 1 ether);
        vm.expectRevert(PhronesisFund.StablecoinNotAllowed.selector);
        fund.depositERC20(address(dai), 1 ether);
        vm.stopPrank();
    }

    function testAuthorizeUsage() public {
        bytes memory perms = '{"role":"investor"}';
        fund.authorizeUsage(investor, perms, block.timestamp + 1 days);
        assertTrue(fund.isAuthorized(investor));

        fund.revokeUsage(investor);
        assertFalse(fund.isAuthorized(investor));
    }

    function testInitializeMetadata() public {
        fund.initialize(bytes32(uint256(42)), "0g://encrypted/metadata");
        (bytes32 hash,,,) = fund.config();
        assertEq(hash, bytes32(uint256(42)));
    }

    function testOracleProof() public {
        bytes memory proof = "tee-attestation-quote";
        bytes32 h = keccak256(proof);
        oracle.registerProof(h);
        assertTrue(oracle.verifyProof(proof));
    }
}
