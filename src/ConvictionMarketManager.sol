// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ConvictionHook} from "./ConvictionHook.sol";
import {ConvictionMarket} from "./ConvictionMarket.sol";
import {ConvictionMarketFactory} from "./ConvictionMarketFactory.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

contract ConvictionMarketManager is Ownable {
    error ZeroAddress();
    error HookMismatch();

    ConvictionMarketFactory public immutable factory;
    ConvictionHook public immutable hook;

    event MarketCreatedAndRegistered(address indexed market, address indexed creator);
    event MarketPausedByManager(address indexed market);
    event MarketUnpausedByManager(address indexed market);
    event MarketVoidedByManager(address indexed market, string evidenceURI);
    event MarketEarlyResolvedByManager(address indexed market, MarketTypes.Outcome outcome, string evidenceURI);

    constructor(ConvictionMarketFactory factory_, ConvictionHook hook_, address owner_) Ownable(owner_) {
        if (address(factory_) == address(0) || address(hook_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (factory_.hook() != address(hook_)) revert HookMismatch();
        factory = factory_;
        hook = hook_;
    }

    function createMarketAndRegister(
        string calldata question,
        address collateralToken,
        address resolver,
        uint256 deadline,
        uint256 maxCollateral
    ) external onlyOwner returns (address market) {
        market = factory.createMarket(question, collateralToken, resolver, deadline, maxCollateral);
        hook.registerMarket(market);
        emit MarketCreatedAndRegistered(market, msg.sender);
    }

    function pauseMarket(ConvictionMarket market) external onlyOwner {
        market.pause();
        emit MarketPausedByManager(address(market));
    }

    function unpauseMarket(ConvictionMarket market) external onlyOwner {
        market.unpause();
        emit MarketUnpausedByManager(address(market));
    }

    function voidMarket(ConvictionMarket market, string calldata evidenceURI) external onlyOwner {
        market.voidMarket(evidenceURI);
        emit MarketVoidedByManager(address(market), evidenceURI);
    }

    function earlyResolveMarket(ConvictionMarket market, MarketTypes.Outcome outcome, string calldata evidenceURI)
        external
        onlyOwner
    {
        market.earlyResolve(outcome, evidenceURI);
        emit MarketEarlyResolvedByManager(address(market), outcome, evidenceURI);
    }

    function resolveMarket(ConvictionMarket market) external onlyOwner {
        market.resolve();
    }
}
