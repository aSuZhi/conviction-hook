// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OutcomeToken} from "./OutcomeToken.sol";
import {IOutcomeResolver} from "./interfaces/IOutcomeResolver.sol";
import {ConvictionMath} from "./libraries/ConvictionMath.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

contract ConvictionMarket {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NotHook();
    error MarketExpired();
    error MarketResolved();
    error MarketNotExpired();
    error InvalidOutcome();
    error InsufficientPosition();
    error NotResolved();
    error AlreadyClaimed();
    error NoClaim();
    error CollateralCapExceeded();
    error InsufficientCollateralBalance();
    error NotManager();
    error MarketPaused();
    error MarketVoided();
    error NotVoided();

    IERC20 public immutable collateralToken;
    IOutcomeResolver public immutable resolver;
    OutcomeToken public immutable yesToken;
    OutcomeToken public immutable noToken;
    address public immutable hook;
    bytes32 public immutable marketId;
    address public manager;
    string public question;
    uint256 public immutable createdAt;
    uint256 public immutable deadline;
    uint256 public immutable maxCollateral;

    uint256 public yesExposure;
    uint256 public noExposure;
    uint256 public collateralPool;
    uint256 public resolvedCollateralPool;
    uint256 public totalYesWeight;
    uint256 public totalNoWeight;
    bool public resolved;
    bool public paused;
    bool public voided;
    MarketTypes.Outcome public winningOutcome;
    string public voidEvidenceURI;
    string public resolutionEvidenceURI;

    mapping(address user => MarketTypes.Position position) private positions;

    event ConvictionEntered(
        address indexed user, bytes32 indexed marketId, MarketTypes.Outcome outcome, uint256 amount, uint256 weight
    );
    event ConvictionExited(
        address indexed user,
        bytes32 indexed marketId,
        MarketTypes.Outcome outcome,
        uint256 amount,
        uint256 returnedAmount,
        uint256 tax
    );
    event ProbabilityUpdated(bytes32 indexed marketId, uint256 yesProbability, uint256 noProbability);
    event MarketResolvedEvent(bytes32 indexed marketId, MarketTypes.Outcome winningOutcome);
    event MarketEarlyResolved(bytes32 indexed marketId, MarketTypes.Outcome winningOutcome, string evidenceURI);
    event MarketPausedEvent(bytes32 indexed marketId);
    event MarketUnpausedEvent(bytes32 indexed marketId);
    event MarketVoidedEvent(bytes32 indexed marketId, string evidenceURI);
    event VoidedRefunded(address indexed user, bytes32 indexed marketId, uint256 amount);
    event ManagerSet(address indexed manager);
    event Claimed(address indexed user, bytes32 indexed marketId, uint256 amount, uint256 weight);

    modifier onlyHook() {
        if (msg.sender != hook) revert NotHook();
        _;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    constructor(
        string memory question_,
        address collateralToken_,
        address resolver_,
        address hook_,
        uint256 deadline_,
        uint256 maxCollateral_
    ) {
        if (collateralToken_ == address(0) || resolver_ == address(0) || hook_ == address(0)) {
            revert ZeroAddress();
        }
        require(deadline_ > block.timestamp, "deadline in past");

        question = question_;
        collateralToken = IERC20(collateralToken_);
        resolver = IOutcomeResolver(resolver_);
        hook = hook_;
        createdAt = block.timestamp;
        deadline = deadline_;
        maxCollateral = maxCollateral_;
        manager = msg.sender;
        marketId = keccak256(abi.encode(block.chainid, address(this), question_, deadline_));
        yesToken = new OutcomeToken("Conviction YES", "cvYES", address(this));
        noToken = new OutcomeToken("Conviction NO", "cvNO", address(this));
        emit ManagerSet(msg.sender);
    }

    function setManager(address manager_) external onlyManager {
        if (manager_ == address(0)) revert ZeroAddress();
        manager = manager_;
        emit ManagerSet(manager_);
    }

    function pause() external onlyManager {
        if (voided) revert MarketVoided();
        if (resolved) revert MarketResolved();
        paused = true;
        emit MarketPausedEvent(marketId);
    }

    function unpause() external onlyManager {
        if (voided) revert MarketVoided();
        if (resolved) revert MarketResolved();
        paused = false;
        emit MarketUnpausedEvent(marketId);
    }

    function voidMarket(string calldata evidenceURI) external onlyManager {
        if (resolved) revert MarketResolved();
        if (voided) revert MarketVoided();
        voided = true;
        paused = true;
        voidEvidenceURI = evidenceURI;
        emit MarketVoidedEvent(marketId, evidenceURI);
    }

    function earlyResolve(MarketTypes.Outcome outcome, string calldata evidenceURI) external onlyManager {
        if (voided) revert MarketVoided();
        if (resolved) revert MarketResolved();
        _requireOutcome(outcome);

        winningOutcome = outcome;
        resolvedCollateralPool = collateralPool;
        resolved = true;
        resolutionEvidenceURI = evidenceURI;

        emit MarketEarlyResolved(marketId, outcome, evidenceURI);
        emit MarketResolvedEvent(marketId, outcome);
    }

    function enter(address user, MarketTypes.Outcome outcome, uint256 amount)
        external
        onlyHook
        returns (uint256 weight)
    {
        _requireActive();
        _requireOutcome(outcome);

        uint256 newCollateralPool = collateralPool + amount;
        if (newCollateralPool > maxCollateral) revert CollateralCapExceeded();
        if (collateralToken.balanceOf(address(this)) < newCollateralPool) revert InsufficientCollateralBalance();

        (uint256 yesProbability, uint256 noProbability) = probabilities();
        uint256 sideProbabilityWad = outcome == MarketTypes.Outcome.Yes ? yesProbability : noProbability;
        weight = ConvictionMath.combinedWeight(
            amount, block.timestamp, block.timestamp, createdAt, deadline, sideProbabilityWad
        );

        MarketTypes.Position storage position = positions[user];
        if (outcome == MarketTypes.Outcome.Yes) {
            yesExposure += amount;
            totalYesWeight += weight;
            position.yesAmount += amount;
            position.yesWeight += weight;
            position.lastYesEntryTime = block.timestamp;
            yesToken.mint(user, amount);
        } else {
            noExposure += amount;
            totalNoWeight += weight;
            position.noAmount += amount;
            position.noWeight += weight;
            position.lastNoEntryTime = block.timestamp;
            noToken.mint(user, amount);
        }

        collateralPool = newCollateralPool;

        emit ConvictionEntered(user, marketId, outcome, amount, weight);
        _emitProbability();
    }

    function exit(address user, MarketTypes.Outcome outcome, uint256 amount)
        external
        onlyHook
        returns (uint256 returnedAmount, uint256 tax)
    {
        _requireActive();
        _requireOutcome(outcome);

        MarketTypes.Position storage position = positions[user];
        (uint256 yesProbability, uint256 noProbability) = probabilities();
        uint256 sideProbabilityWad = outcome == MarketTypes.Outcome.Yes ? yesProbability : noProbability;
        uint256 taxBps = ConvictionMath.exitTaxBps(block.timestamp, createdAt, deadline, sideProbabilityWad);
        (returnedAmount, tax) = ConvictionMath.applyTax(amount, taxBps);

        if (outcome == MarketTypes.Outcome.Yes) {
            if (position.yesAmount < amount) revert InsufficientPosition();
            uint256 removedWeight = (position.yesWeight * amount) / position.yesAmount;
            position.yesAmount -= amount;
            position.yesWeight -= removedWeight;
            yesExposure -= amount;
            totalYesWeight -= removedWeight;
            yesToken.burn(user, amount);
        } else {
            if (position.noAmount < amount) revert InsufficientPosition();
            uint256 removedWeight = (position.noWeight * amount) / position.noAmount;
            position.noAmount -= amount;
            position.noWeight -= removedWeight;
            noExposure -= amount;
            totalNoWeight -= removedWeight;
            noToken.burn(user, amount);
        }

        collateralPool -= returnedAmount;
        collateralToken.safeTransfer(user, returnedAmount);

        emit ConvictionExited(user, marketId, outcome, amount, returnedAmount, tax);
        _emitProbability();
    }

    function resolve() external {
        if (voided) revert MarketVoided();
        if (block.timestamp < deadline) revert MarketNotExpired();
        if (resolved) revert MarketResolved();

        winningOutcome = resolver.resolve(marketId);
        _requireOutcome(winningOutcome);
        resolvedCollateralPool = collateralPool;
        resolved = true;

        emit MarketResolvedEvent(marketId, winningOutcome);
    }

    function claim(address user) external returns (uint256 amount) {
        if (voided) revert MarketVoided();
        if (!resolved) revert NotResolved();

        MarketTypes.Position storage position = positions[user];
        if (position.claimed) revert AlreadyClaimed();

        uint256 userWeight = winningOutcome == MarketTypes.Outcome.Yes ? position.yesWeight : position.noWeight;
        uint256 totalWeight = winningOutcome == MarketTypes.Outcome.Yes ? totalYesWeight : totalNoWeight;
        if (userWeight == 0 || totalWeight == 0) revert NoClaim();

        position.claimed = true;
        amount = (resolvedCollateralPool * userWeight) / totalWeight;
        collateralToken.safeTransfer(user, amount);

        emit Claimed(user, marketId, amount, userWeight);
    }

    function refundVoided(address user) external returns (uint256 amount) {
        if (!voided) revert NotVoided();

        MarketTypes.Position storage position = positions[user];
        uint256 yesAmount = position.yesAmount;
        uint256 noAmount = position.noAmount;
        amount = yesAmount + noAmount;
        if (amount == 0) revert NoClaim();

        if (yesAmount > 0) {
            yesExposure -= yesAmount;
            totalYesWeight -= position.yesWeight;
            yesToken.burn(user, yesAmount);
        }
        if (noAmount > 0) {
            noExposure -= noAmount;
            totalNoWeight -= position.noWeight;
            noToken.burn(user, noAmount);
        }

        position.yesAmount = 0;
        position.noAmount = 0;
        position.yesWeight = 0;
        position.noWeight = 0;
        position.claimed = true;
        collateralPool -= amount;

        collateralToken.safeTransfer(user, amount);

        emit VoidedRefunded(user, marketId, amount);
        _emitProbability();
    }

    function claimable(address user) external view returns (uint256) {
        if (voided || !resolved) return 0;

        MarketTypes.Position storage position = positions[user];
        if (position.claimed) return 0;

        uint256 userWeight = winningOutcome == MarketTypes.Outcome.Yes ? position.yesWeight : position.noWeight;
        uint256 totalWeight = winningOutcome == MarketTypes.Outcome.Yes ? totalYesWeight : totalNoWeight;
        if (userWeight == 0 || totalWeight == 0) return 0;

        return (resolvedCollateralPool * userWeight) / totalWeight;
    }

    function positionOf(address user) external view returns (MarketTypes.Position memory) {
        return positions[user];
    }

    function probabilities() public view returns (uint256 yesProbability, uint256 noProbability) {
        return ConvictionMath.probabilitySplit(yesExposure, noExposure);
    }

    function _requireActive() internal view {
        if (voided) revert MarketVoided();
        if (paused) revert MarketPaused();
        if (resolved) revert MarketResolved();
        if (block.timestamp >= deadline) revert MarketExpired();
    }

    function _requireOutcome(MarketTypes.Outcome outcome) internal pure {
        if (outcome != MarketTypes.Outcome.Yes && outcome != MarketTypes.Outcome.No) revert InvalidOutcome();
    }

    function _emitProbability() internal {
        (uint256 yesProbability, uint256 noProbability) = probabilities();
        emit ProbabilityUpdated(marketId, yesProbability, noProbability);
    }
}
