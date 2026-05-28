// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library ConvictionMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant MIN_MULTIPLIER = 1e18;
    uint256 internal constant MAX_EARLY_BONUS = 5e17;
    uint256 internal constant MAX_HOLDING_BONUS = 3e17;
    uint256 internal constant MAX_CONTRARIAN_BONUS = 4e17;
    uint256 internal constant BASE_EXIT_TAX_BPS = 50;
    uint256 internal constant MAX_TIME_TAX_BPS = 250;
    uint256 internal constant MAX_IMBALANCE_TAX_BPS = 200;

    function earlyEntryMultiplier(uint256 entryTime, uint256 startTime, uint256 deadline)
        internal
        pure
        returns (uint256)
    {
        if (deadline <= startTime || entryTime >= deadline) return MIN_MULTIPLIER;

        uint256 duration = deadline - startTime;
        uint256 remaining = entryTime <= startTime ? duration : deadline - entryTime;

        return MIN_MULTIPLIER + ((remaining * MAX_EARLY_BONUS) / duration);
    }

    function holdingTimeMultiplier(uint256 entryTime, uint256 currentTime, uint256 deadline)
        internal
        pure
        returns (uint256)
    {
        if (currentTime <= entryTime || deadline <= entryTime) return MIN_MULTIPLIER;
        uint256 elapsed = currentTime - entryTime;
        uint256 window = deadline - entryTime;
        if (elapsed > window) elapsed = window;
        return MIN_MULTIPLIER + ((elapsed * MAX_HOLDING_BONUS) / window);
    }

    function _clampProbabilityWad(uint256 sideProbabilityWad) private pure returns (uint256) {
        return sideProbabilityWad > WAD ? WAD : sideProbabilityWad;
    }

    function contrarianMultiplier(uint256 sideProbabilityWad) internal pure returns (uint256) {
        uint256 clampedProbabilityWad = _clampProbabilityWad(sideProbabilityWad);
        if (clampedProbabilityWad >= 5e17) return MIN_MULTIPLIER;
        uint256 contrarianRatio = ((5e17 - clampedProbabilityWad) * WAD) / 5e17;
        return MIN_MULTIPLIER + ((contrarianRatio * MAX_CONTRARIAN_BONUS) / WAD);
    }

    function combinedWeight(
        uint256 amount,
        uint256 entryTime,
        uint256 currentTime,
        uint256 startTime,
        uint256 deadline,
        uint256 sideProbabilityWad
    ) internal pure returns (uint256) {
        uint256 weight = amount;
        weight = (weight * earlyEntryMultiplier(entryTime, startTime, deadline)) / WAD;
        weight = (weight * holdingTimeMultiplier(entryTime, currentTime, deadline)) / WAD;
        weight = (weight * contrarianMultiplier(sideProbabilityWad)) / WAD;
        return weight;
    }

    function exitTaxBps(uint256 currentTime, uint256 startTime, uint256 deadline, uint256 sideProbabilityWad)
        internal
        pure
        returns (uint256)
    {
        uint256 timeTax;
        if (deadline <= startTime) {
            timeTax = MAX_TIME_TAX_BPS;
        } else if (currentTime <= startTime) {
            timeTax = 0;
        } else if (currentTime >= deadline) {
            timeTax = MAX_TIME_TAX_BPS;
        } else {
            uint256 elapsed = currentTime - startTime;
            uint256 duration = deadline - startTime;
            timeTax = (elapsed * MAX_TIME_TAX_BPS) / duration;
        }

        uint256 imbalanceTax;
        uint256 clampedProbabilityWad = _clampProbabilityWad(sideProbabilityWad);
        if (clampedProbabilityWad > 5e17) {
            imbalanceTax = ((clampedProbabilityWad - 5e17) * MAX_IMBALANCE_TAX_BPS) / 5e17;
        }

        return BASE_EXIT_TAX_BPS + timeTax + imbalanceTax;
    }

    function probabilitySplit(uint256 yesExposure, uint256 noExposure)
        internal
        pure
        returns (uint256 yesProbability, uint256 noProbability)
    {
        uint256 total = yesExposure + noExposure;
        if (total == 0) return (5e17, 5e17);
        yesProbability = (yesExposure * WAD) / total;
        noProbability = WAD - yesProbability;
    }

    function applyTax(uint256 amount, uint256 taxBps) internal pure returns (uint256 afterTax, uint256 tax) {
        tax = (amount * taxBps) / BPS;
        afterTax = amount - tax;
    }
}
