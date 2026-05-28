// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DemoCollateral} from "./DemoCollateral.sol";
import {IDemoPoolBootstrapper} from "./interfaces/IDemoPoolBootstrapper.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

interface IConvictionMarketManagerLike {
    function createMarketAndRegister(
        string calldata question,
        address collateralToken,
        address resolver,
        uint256 deadline,
        uint256 maxCollateral
    ) external returns (address market);

    function earlyResolveMarket(address market, MarketTypes.Outcome outcome, string calldata evidenceURI) external;
}

interface IJourneyMarketLike {
    function resolved() external view returns (bool);
    function voided() external view returns (bool);
    function deadline() external view returns (uint256);
}

contract DemoJourneyController is Ownable {
    error ZeroAddress();
    error InvalidSessionConfig();
    error ClaimCoolingDown(uint256 nextClaimAt);
    error BootstrapperUnset();
    error DemoMarketNotSet();
    error DemoMarketAlreadyResolved();
    error DemoSessionStillActive(address market);

    DemoCollateral public immutable collateral;
    IConvictionMarketManagerLike public immutable manager;
    IDemoPoolBootstrapper public bootstrapper;
    address public demoMarket;
    address public resolver;
    uint256 public immutable claimAmount;
    uint256 public immutable poolTokenAmount;
    uint256 public sessionDuration;
    uint256 public maxCollateral;
    string public demoQuestion;
    mapping(address user => uint256 timestamp) public nextClaimAt;
    mapping(address user => address market) public demoMarketOf;
    mapping(address user => uint256 nonce) public demoNonceOf;

    event BootstrapperSet(address indexed bootstrapper);
    event DemoMarketSet(address indexed market);
    event DemoMarketCreated(address indexed market, string question, uint256 deadline);
    event DemoSessionStarted(
        address indexed user, address indexed market, uint256 indexed nonce, string question, uint256 deadline
    );
    event DemoTokensClaimed(
        address indexed user, uint256 collateralAmount, uint256 poolTokenAmount, uint256 nextClaimAt
    );
    event DemoMarketSettled(
        address indexed market, MarketTypes.Outcome outcome, address indexed caller, string evidenceURI
    );

    constructor(
        DemoCollateral collateral_,
        address manager_,
        address owner_,
        uint256 claimAmount_,
        uint256 poolTokenAmount_,
        address resolver_,
        uint256 sessionDuration_,
        uint256 maxCollateral_,
        string memory demoQuestion_
    ) Ownable(owner_) {
        if (
            address(collateral_) == address(0) || manager_ == address(0) || owner_ == address(0)
                || resolver_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (sessionDuration_ == 0 || maxCollateral_ == 0 || bytes(demoQuestion_).length == 0) {
            revert InvalidSessionConfig();
        }
        collateral = collateral_;
        manager = IConvictionMarketManagerLike(manager_);
        claimAmount = claimAmount_;
        poolTokenAmount = poolTokenAmount_;
        resolver = resolver_;
        sessionDuration = sessionDuration_;
        maxCollateral = maxCollateral_;
        demoQuestion = demoQuestion_;
    }

    function setBootstrapper(address bootstrapper_) external onlyOwner {
        if (bootstrapper_ == address(0)) revert ZeroAddress();
        bootstrapper = IDemoPoolBootstrapper(bootstrapper_);
        emit BootstrapperSet(bootstrapper_);
    }

    function setDemoMarket(address market_) external onlyOwner {
        if (market_ == address(0)) revert ZeroAddress();
        demoMarket = market_;
        emit DemoMarketSet(market_);
    }

    function createDemoMarketAndRegister(
        string calldata question,
        address marketResolver,
        uint256 deadline,
        uint256 marketMaxCollateral
    ) external onlyOwner returns (address market) {
        market = manager.createMarketAndRegister(question, address(collateral), marketResolver, deadline, marketMaxCollateral);
        demoMarket = market;
        emit DemoMarketCreated(market, question, deadline);
        emit DemoMarketSet(market);
    }

    function startDemoSession() external returns (address market) {
        address currentMarket = demoMarketOf[msg.sender];
        if (currentMarket != address(0) && !_isSessionInactive(currentMarket)) {
            revert DemoSessionStillActive(currentMarket);
        }

        uint256 deadline = block.timestamp + sessionDuration;
        market = manager.createMarketAndRegister(demoQuestion, address(collateral), resolver, deadline, maxCollateral);
        uint256 nonce = demoNonceOf[msg.sender] + 1;
        demoNonceOf[msg.sender] = nonce;
        demoMarketOf[msg.sender] = market;
        demoMarket = market;

        emit DemoSessionStarted(msg.sender, market, nonce, demoQuestion, deadline);
        emit DemoMarketSet(market);
    }

    function claimDemoTokens() external {
        uint256 next = nextClaimAt[msg.sender];
        if (block.timestamp < next) revert ClaimCoolingDown(next);
        if (address(bootstrapper) == address(0)) revert BootstrapperUnset();

        uint256 nextTimestamp = block.timestamp + 1 days;
        nextClaimAt[msg.sender] = nextTimestamp;

        collateral.mint(msg.sender, claimAmount);
        bootstrapper.mintDemoPoolTokens(msg.sender, poolTokenAmount);

        emit DemoTokensClaimed(msg.sender, claimAmount, poolTokenAmount, nextTimestamp);
    }

    function settleDemoMarket(MarketTypes.Outcome outcome, string calldata evidenceURI) external {
        address market = demoMarketOf[msg.sender];
        if (market == address(0)) revert DemoMarketNotSet();
        if (IJourneyMarketLike(market).resolved()) revert DemoMarketAlreadyResolved();
        require(outcome == MarketTypes.Outcome.Yes || outcome == MarketTypes.Outcome.No, "invalid outcome");

        manager.earlyResolveMarket(market, outcome, evidenceURI);
        emit DemoMarketSettled(market, outcome, msg.sender, evidenceURI);
    }

    function _isSessionInactive(address market) internal view returns (bool) {
        IJourneyMarketLike journeyMarket = IJourneyMarketLike(market);
        return journeyMarket.resolved() || journeyMarket.voided() || block.timestamp >= journeyMarket.deadline();
    }
}
