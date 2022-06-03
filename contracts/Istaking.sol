//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.0;

struct StakeStruct{
    uint256 tokenAmount;
    uint256 timeStamp;
    uint256 rewardPaid;
}

interface Istaking {

    function setfreezingTime(uint256) external;    
    function getStakes(address) external view returns(StakeStruct memory);
}