// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MarketTypes} from "../libraries/MarketTypes.sol";

interface IOutcomeResolver {
    function resolve(bytes32 marketId) external view returns (MarketTypes.Outcome winningOutcome);
}
