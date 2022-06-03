//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IMyERC20.sol";


contract ACDMPlatform is AccessControl{

    // владелец контракта
    address owner;
    // адрес платформы
    address platformAddress;
    // адрес управляющего контракта dao
    address daoAddress;
    // интерфейс к токену
    IMyERC20 ACDMToken;

    // номер раунда
    // нечётный - sale
    // чётный - trade
    uint256 public roundNumber;
    // продолжительность раунда
    uint256 public roundTime;
    // сумма на котороую совершены продажи в раунде trade
    uint256 public saleAmount;
    // цена токенов на последнем раунде sale
    uint256 public tokenPrice;
    // количество токенов заминченных на последнем раунде sale
    uint256 public tokenMint;
    // время окончания текущего раунда
    uint256 public endRoundTime;
    // количество токенов, выставленных на торги
    uint256 public tradeTokens;
    // количество реферального эфира на контракте
    uint256 public referalReward;
    // количество эфира от торгволи ACDMToken на котракте
    uint256 public tradeEth;
    // количество нулей у ACDMToken;
    uint24 public decimals;

    // параметры ревардов
    // указываются в промилле, регулируются через DAO
    uint8 public saleReward1;
    uint8 public saleReward2;
    uint8 public tradeReward;


    // Ордеры
    struct Order {
        address seller;
        uint256 tokenAmount;
        uint256 cost;
    }
    Order[] orders;

    // реферальная программа
    // refer1 - мой рефер
    // refer2 - рефер моего рефера
    struct Refer {
        address refer1;
        address refer2;
    }
    // словарь с сохранёнными рефералми пользователей
    mapping(address => Refer) referals;
    // словарь с количеством реферального эфира
    mapping(address => uint256) referalRewards;
    // словарь с количеством эфира от продажи токенов
    mapping(address => uint256) tradeEths;

    // роли
    //bytes32 public constant tokenOwner = keccak256("owner");
    //bytes32 public constant administrator = keccak256("administrator");
    // словарь с ролями
    //mapping(bytes32 => RoleData) public _roles;

    modifier onlyDao(){
        require(msg.sender == daoAddress, "You are not DAO");
        _;
    }

    constructor(address _ACDMToken, address _daoAddress, uint256 _roundTime){
        owner = msg.sender;
        daoAddress = _daoAddress;
        platformAddress = address(this);
        ACDMToken = IMyERC20(_ACDMToken);
        decimals = 1_000_000;
        roundTime = _roundTime;
        // что за странные числа? А вот:
        // это число нужно, что бы правильно посчитать цену в первом раунде Sale
        // 5 825 242 718 447 * 103 / 100 + 4 000 000 000 000 = 10 000 000 000 000
        tokenPrice = 5_825_242_718_447;
        // это число нужно, что бы правильно посчитать сколько минтить токенов в первом раунде Sale
        // 1 000 000 000 000 000 000 * 1 000 000 / 10 000 000 000 000 = 100 000 000 000
        saleAmount = 1_000_000_000_000_000_000;
        roundNumber = 0;
        // параметры ревардов регулируются через дао
        saleReward1 = 50;
        saleReward2 = 30;
        tradeReward = 25;
    }

    function register(address refer) public {
        // В словарь Referals по адресу msg.sender добавляется новая структура Refer в которой
        // refer1 = refer - реферал для msg.sender
        // refer2 = referals[refer].refer1 - реферал моего реферала 
        referals[msg.sender] = Refer(refer, referals[refer].refer1);
        // здесь регистрируемся в реферальной системе
        // refer - адрес нашего рефера
        // ему падают вознаграждения за наши действия
        // если кто-то отправит наш адрес - нам будут падать вознаграждения за его действия
        // двухуровневая система!
    }

    function startSaleRound() public {
        // Условие окончания работы:
        // прошло три дня. Не проданные токены по окончании раунда сжигаются
        // Проданы все заминченные токены. Тогда можно сразу начать trade раунд не дожидаясь трёх дней
        require(roundNumber % 2 == 0, "The sale round has already begun");
        require(block.timestamp > endRoundTime, "The time of the trade round is not over");
        // сохраняем текущее количество токенов на платформе - это токены, находящиеся в ордерах
        // Формула для расчёта стоимости
        // Price ETH = lastPrice * 1,03 + 0,000004
        // Пример расчета: 10 000 000 000 000 wei/ACDMtoken * 103 / 100 + 400 000 0000 000 = 14 300 000 000 000 wei/ACDMtoken
        tokenPrice = tokenPrice * 103 / 100 + 4_000_000_000_000;
        // минтим токены
        // Расчёт количества новых токенов в ACDM-копейках
        tokenMint = saleAmount * decimals / tokenPrice;
        ACDMToken.mint(platformAddress, tokenMint);

        // устанавливаем время окончания раунда
        endRoundTime = block.timestamp + roundTime;
        // увеличиваем счётчик раундов
        roundNumber++;
    }

    // функция покупки токенов
    function buyACDMToken() public payable {
        require(roundNumber % 2 == 1, "The sales round has not yet begun");
        require(endRoundTime > block.timestamp, "The time for the sale round is over");
        require(msg.value > 0, "Congratulations! You bought 0 tokens");

        // записываем награду на счёт рефералов, если они есть
        address refer1 = referals[msg.sender].refer1;
        if(refer1 != address(0)){
            uint256 reward = msg.value * saleReward1 / 1000;
            referalRewards[refer1] += reward;
            referalReward += reward;
            address refer2 = referals[msg.sender].refer2;
            if(refer2 != address(0)){
                reward =  msg.value * saleReward2 / 1000;
                referalRewards[refer2] += reward;
                referalReward += reward;
            }
        }
        // отправляем токены на счёт покупателя
        ACDMToken.transfer(msg.sender, msg.value * decimals / tokenPrice);
    }

    // Trade Round
    function startTradeRound() public {
        // Условие окончания работы:
        // прошло три дня. Не проданные токены по окончании раунда сжигаются
        // Проданы все заминченные токены. Тогда можно сразу начать trade раунд не дожидаясь трёх дней
        require(roundNumber % 2 == 1, "The trade round has already begun");
        require(block.timestamp > endRoundTime || ACDMToken.balanceOf(platformAddress) == 0,
            "Sales round time is not over yet or not all tokens are sold out");
        // сжигаем токены
        ACDMToken.burn(platformAddress, ACDMToken.balanceOf(platformAddress) - tradeTokens);
        // устанавливаем время окончания раунда
        endRoundTime = block.timestamp + roundTime;
        // увеличиваем счётчик раундов
        roundNumber++;
        // скидываем сумму на которую были накуплены в прошлом раунде торговли токены в ноль
        saleAmount = 0;
    }

    // Добавляем ордер на продажу токенов
    // cost - цена в wei за 1 ACDMToken
    function addOreder(uint256 tokenAmount, uint256 cost) public {
        require(roundNumber % 2 == 0, "The trade round has not yet begun");
        require(endRoundTime > block.timestamp, "The time for the trade round is over");
        //require(ACDMToken.allowance(msg.sender, platformAddress) >= tokenAmount, "No permission to transfer that many tokens");
        // делаем трансфер, если там не апрувнул, то там и сломается
        ACDMToken.transferFrom(msg.sender, platformAddress, tokenAmount);
        // добавляем ордер
        orders.push(Order(msg.sender, tokenAmount, cost));
        // добавляем токены в tradeTokens
        tradeTokens += tokenAmount;
    }

    function redeemToken(uint256 orderId) public payable {
        require(roundNumber % 2 == 0, "The trade round has not yet begun");
        require(endRoundTime > block.timestamp, "The time for the trade round is over");
        require(orderId < orders.length, "No order with this ID");
        require(msg.value > 0, "Congratulations! You bought 0 tokens");
        // рассчитываем сколько токенов можно купить в этом ордере за присланные деньги
        uint256 tokenAmount = msg.value  * decimals / orders[orderId].cost;
        // проверяем, что в этом ордере есть столько токенов
        require(orders[orderId].tokenAmount >= tokenAmount, "There are not enough tokens in this order for that amount");

        // записываем награду на счёт рефералов, если они есть
        uint256 reward = msg.value * tradeReward / 1000;
        address refer1 = referals[orders[orderId].seller].refer1;
        if(refer1 != address(0)){
            referalRewards[refer1] += reward;
            referalReward += reward;
            address refer2 = referals[orders[orderId].seller].refer2;
            if(refer2 != address(0)){
                referalRewards[refer2] += reward;
                referalReward += reward;
            }
        }
        // уменьшаем количество токенов в ордере
        orders[orderId].tokenAmount -= tokenAmount;
        // уменьшаем количество токенов, выставленных на продажу
        tradeTokens -= tokenAmount;
        // сохраняем количество эфира, заработанного продавцом ACDMToken
        tradeEths[orders[orderId].seller] += msg.value - reward * 2;
        // увеличиваем количество эфира от продажи токенов
        tradeEth += msg.value - reward * 2;
        // увеличиваем количество эфира, заработанного с продаж в этом раунде
        saleAmount += msg.value;
        // отправляем токены на адрес покупателя
        ACDMToken.transfer(msg.sender, tokenAmount);
    }

    // закрываем ордер, выводим из него токены
    function removeToken(uint256 orderId) public {
        require(orderId < orders.length, "No order with this ID");
        require(msg.sender == orders[orderId].seller, "You are not a seller in this order");
        require(orders[orderId].tokenAmount > 0 , "Order now closed");

        // для избежания атаки, сначала уменьшаем количество токенов
        uint256 tokenAmount = orders[orderId].tokenAmount;
        orders[orderId].tokenAmount = 0;
        tradeTokens -= tokenAmount;
        // отправляем токены на счёт владельца ордере
        ACDMToken.transfer(msg.sender, tokenAmount);
    }

    function getOrders() public view returns(Order[] memory){
        return orders;
    }

    function getMyReferalReward() public view returns(uint256){
        return referalRewards[msg.sender];
    }

    function getMyTradeEth() public view returns(uint256){
        return tradeEths[msg.sender];
    }

    function getMyRefers() public view returns(Refer memory){
        return referals[msg.sender];
    }

    // вывод награды за рефералов
    function withdrawalReferalReward() public {
        require(referalRewards[msg.sender] > 0, "You have no referral rewards");
        uint256 reward = referalRewards[msg.sender];
        referalReward -= referalRewards[msg.sender];
        referalRewards[msg.sender] = 0;
        payable(msg.sender).transfer(reward);
    }

    // вывод прибыли от торговли
    function withdrawalTradeEth() public {
        require(tradeEths[msg.sender] > 0, "You have no trade ethers");
        uint256 trade = tradeEths[msg.sender];
        tradeEth -= tradeEths[msg.sender];
        tradeEths[msg.sender] = 0;
        payable(msg.sender).transfer(trade);
    }

    function setSaleReward1(uint8 _saleReward1) public onlyDao{
        saleReward1 = _saleReward1;
    }
    
    function setSaleReward2(uint8 _saleReward2) public onlyDao{
        saleReward2 = _saleReward2;
    }

    function setTradeReward(uint8 _tradeReward) public onlyDao{
        tradeReward = _tradeReward;
    }
}
