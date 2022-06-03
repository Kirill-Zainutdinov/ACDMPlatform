// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.0;

struct deposit{
    uint256 frozenToken;
    uint256 unFrozentime;
}

interface IDAO{

    function getDeposit(address) external view returns(deposit memory);
}