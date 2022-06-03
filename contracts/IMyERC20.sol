// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMyERC20 {
    function name() external view returns(string memory);
    function totalSupply() external view returns(uint256);
    function decimals() external view returns(uint8);
    function balanceOf(address) external view returns(uint256);
    function mint(address, uint256) external;
    function burn(address, uint256) external;
    function transfer(address, uint256) external returns(bool);
    function transferFrom(address, address, uint256) external returns(bool);
}
