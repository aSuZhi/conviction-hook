// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library MarketTypes {
    enum Outcome {
        Unset,
        Yes,
        No
    }

    enum MarketState {
        Active,
        Expired,
        Resolved
    }

    struct MarketConfig {
        bytes32 marketId;
        string question;
        address collateralToken;
        address yesToken;
        address noToken;
        address resolver;
        uint256 createdAt;
        uint256 deadline;
        uint256 maxCollateral;
    }

    struct Position {
        uint256 yesAmount;
        uint256 noAmount;
        uint256 yesWeight;
        uint256 noWeight;
        uint256 lastYesEntryTime;
        uint256 lastNoEntryTime;
        bool claimed;
    }
}
