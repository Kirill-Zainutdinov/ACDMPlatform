//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyERC20 is AccessControl {
    address owner;
    string public name;
    string public symbol;
    uint8 public decimals;
    uint public totalSupply;

    // роли
    bytes32 public constant tokenOwner = keccak256("owner");
    bytes32 public constant administrator = keccak256("administrator");
    // словарь с ролями
    mapping(bytes32 => RoleData) public _roles;

    mapping (address => uint) private balances;
    mapping(address => mapping(address => uint)) private allowed;
    
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        _setRoleAdmin(tokenOwner, tokenOwner);
        _grantRole(tokenOwner, msg.sender);
        _setRoleAdmin(administrator, tokenOwner);
        _grantRole(administrator, msg.sender);
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = 0;
    }
    
    modifier onlyOwner(){
    require(owner == msg.sender || hasRole(administrator, msg.sender), "ERC20: You are not owner");
    _;
    }

    modifier tokenAmount(address adr, uint256 value){
        require(balances[adr] >= value, "ERC20: not enough tokens");
        _;
    }
    
    function mint(address _to, uint _value) public onlyOwner  {
        totalSupply += _value;
        balances[_to] += _value;
        emit Transfer(address(0), _to, _value);
    }
    
    function burn(address _from, uint _value) public onlyOwner tokenAmount(_from, _value) {
        balances[_from] -= _value;
        totalSupply -= _value;
        emit Transfer(_from, address(0), _value);
    }

    function balanceOf(address _owner) public view returns(uint) {
        return balances[_owner];
    }
    
    function transfer(address _to, uint _value) public tokenAmount(msg.sender, _value) returns(bool){
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint _value) public tokenAmount(_from, _value) returns(bool){
        require(allowed[_from][msg.sender] >= _value, "ERC20: no permission to spend");
        balances[_from] -= _value;
        balances[_to] += _value;
        allowed[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        emit Approval(_from, msg.sender, allowed[_from][msg.sender]);
        return true;
    }
    
    function approve(address _spender, uint _value) public {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }
    
    function allowance(address _owner, address _spender) public view returns(uint) {
        return allowed[_owner][_spender];
    }
}
