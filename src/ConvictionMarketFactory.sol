// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ConvictionMarket} from "./ConvictionMarket.sol";

contract ConvictionMarketFactory {
    error ZeroAddress();

    address public immutable hook;
    address[] public markets;
    mapping(address market => bool exists) public isMarket;

    event MarketCreated(address indexed market, bytes32 indexed marketId, string question, uint256 deadline);
    event MarketManagerAssigned(address indexed market, address indexed manager);

    constructor(address hook_) {
        if (hook_ == address(0)) revert ZeroAddress();
        hook = hook_;
    }

    function createMarket(
        string memory question,
        address collateralToken,
        address resolver,
        uint256 deadline,
        uint256 maxCollateral
    ) external returns (address marketAddress) {
        ConvictionMarket market =
            new ConvictionMarket(question, collateralToken, resolver, hook, deadline, maxCollateral);
        market.setManager(msg.sender);
        marketAddress = address(market);
        markets.push(marketAddress);
        isMarket[marketAddress] = true;
        emit MarketCreated(marketAddress, market.marketId(), question, deadline);
        emit MarketManagerAssigned(marketAddress, msg.sender);
    }

    function marketsLength() external view returns (uint256) {
        return markets.length;
    }

    function marketAt(uint256 index) external view returns (address) {
        return markets[index];
    }

    function marketsSlice(uint256 start, uint256 count) external view returns (address[] memory slice) {
        uint256 length = markets.length;
        if (start >= length) return new address[](0);

        uint256 end = start + count;
        if (end > length) end = length;

        slice = new address[](end - start);
        for (uint256 i = start; i < end; ++i) {
            slice[i - start] = markets[i];
        }
    }
}
