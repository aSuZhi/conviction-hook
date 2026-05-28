// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOutcomeResolver} from "./interfaces/IOutcomeResolver.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

contract ManualResolver is IOutcomeResolver, Ownable {
    error OutcomeUnset();
    error OutcomeAlreadySet();

    mapping(bytes32 marketId => MarketTypes.Outcome outcome) private outcomes;

    event OutcomeSet(bytes32 indexed marketId, MarketTypes.Outcome outcome);

    constructor(address owner_) Ownable(owner_) {}

    function setOutcome(bytes32 marketId, MarketTypes.Outcome outcome) external onlyOwner {
        require(outcome == MarketTypes.Outcome.Yes || outcome == MarketTypes.Outcome.No, "invalid outcome");
        if (outcomes[marketId] != MarketTypes.Outcome.Unset) revert OutcomeAlreadySet();
        outcomes[marketId] = outcome;
        emit OutcomeSet(marketId, outcome);
    }

    function resolve(bytes32 marketId) external view returns (MarketTypes.Outcome winningOutcome) {
        winningOutcome = outcomes[marketId];
        if (winningOutcome == MarketTypes.Outcome.Unset) revert OutcomeUnset();
    }
}
