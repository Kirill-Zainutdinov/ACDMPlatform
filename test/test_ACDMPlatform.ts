import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC20, ACDMPlatform } from "../typechain";


describe("Testing ACDMPlatform",  function () {

    // истансы контрактов
    let ACDMToken : MyERC20;
    let ACDMPlatform : ACDMPlatform;

    // аккаунты
    let owner : SignerWithAddress;
    let refer1 : SignerWithAddress;
    let refer2 : SignerWithAddress;
    let user : SignerWithAddress;
    let buyer : SignerWithAddress;
    let hacker : SignerWithAddress;
    let dao : SignerWithAddress;

    // значения, используемые в контракте ACDMPlatform

    // номер раунда
    // нечётный - sale
    // чётный - trade
    let roundNumber = BigNumber.from(0);
    // продолжительность раунда
    const roundTime = 259200;
    // сумма на котороую совершены продажи в раунде trade
    let saleAmount = BigNumber.from(1_000_000_000);
    // цена токенов на последнем раунде sale
    let tokenPrice = BigNumber.from(5_825_242_718_447)
    // количество токенов, выставленных на торги
    let tradeTokens = BigNumber.from(0);
    // количество нулей у ACDMToken;
    const decimals = BigNumber.from(1_000_000);

    // параметры ревардов
    // указываются в промилле, регулируются через DAO
    let saleReward1 = 50;
    let saleReward2 = 30;
    let tradeReward = 25;

    // аргументы для конструкторов контрактов
    const ercName1 = "ACDMToken";
    const ercSymbol = "ACDM";
    const _decimals = 6;

    before(async function(){
        [owner, refer1, refer2, user, buyer, hacker, dao] = await ethers.getSigners();

        // деплоим ACDMToken
        const ACDMTokenFactory = (await ethers.getContractFactory("MyERC20"));
        ACDMToken = await ACDMTokenFactory.deploy(ercName1, ercSymbol, _decimals);
        saleAmount = saleAmount.mul(saleAmount);
        // деплоим ACDMPlatform
        const ACDMPlatformFactory = (await ethers.getContractFactory("ACDMPlatform"));
        ACDMPlatform = await ACDMPlatformFactory.deploy(ACDMToken.address, dao.address, roundTime);
    })

    // выдаём роль administrator для контракта ACDMPlatform для ACDMToken
    it("check grantrole() ACDMToken", async function(){
        
        let admin = await ACDMToken.administrator();

        let tx = await ACDMToken.grantRole(admin, ACDMPlatform.address);
        await tx.wait();
        expect(await ACDMToken.hasRole(admin, ACDMPlatform.address)).equal(true);
    })

    // регистрируем полльзователей
    it("check register() ACDMPlatform", async function(){

        // сначала региструем refer1 - для него рефером будет refer2
        let tx = await ACDMPlatform.connect(refer1).register(refer2.address);
        await tx.wait();
        // проверяем, что refer2 стал рефером для refer1
        expect((await ACDMPlatform.connect(refer1).getMyRefers()).refer1).equal(refer2.address);

        // теперь региструем user - для него рефером будет refer1
        tx = await ACDMPlatform.connect(user).register(refer1.address);
        await tx.wait();
        // проверяем, что refer1 стал рефером для user
        expect((await ACDMPlatform.connect(user).getMyRefers()).refer1).equal(refer1.address);
        // проверяем, что refer2 стал вторым рефером для user
        expect((await ACDMPlatform.connect(user).getMyRefers()).refer2).equal(refer2.address);
    })

    // ДАЛЕЕ БУДЕТ ТРИЖДЫ ВЫПОЛНЕНА СЛЕДУЮЩАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ДЕЙСТВИЙ
    //
    //
    // Запуск раунда продажи
    // Покупка токенов
    // Запуск раунда торговли
    // Создание ордеров
    // Покупка ордеров
    // Вывод ордеров
    //
    // Эти действия будут на каждом цикле выполнятся для разных пользователей и разными параметрами,
    // чтобы полностью проверить реферальную систему, а также изменения стоимости и количества выпускаемых токнов
    // проверить надёжность ряда систем смарт-контракта:
    //
    // - надёжное хранение и вывод Eth полученного пользователями от продажи и реферальной программы
    // - надёжное хранение, покупку, продажу и вывод ACDMToken выставленных в ордерах


    // СТАРТ ПЕРВОГО ЦИКЛА

    // Здесь покупать и выставлять на продажу токены будет пользователь refer2 у которого нету реферов

    // Стартуем раунд продаж
    it("check startSaleRound() ACDMPlatform - round number - 1", async function(){

        // сначала сохраняем количество токенов на платформе
        let balanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // рассчитываем сколько должно быть заминчено токенов
        // расчёт tokenPrice в wei по формуле
        // tokenPrice = tokenPrice * 103 / 100 + 4_000_000_000_000
        tokenPrice = tokenPrice.mul(103).div(100).add(4_000_000_000_000);
        //console.log(tokenPrice);

        // Рассчёт количество токенов, которых надо заминтить. Рассчёт в ACDM-копейках по формуле
        // tokenMint = saleAmount * decimals / tokenPrice;
        let tokenMint = saleAmount.mul(decimals).div(tokenPrice);
        //console.log(tokenMint);

        // Стартуем раунд sale
        let tx = await ACDMPlatform.startSaleRound();
        await tx.wait();

        //console.log(await ACDMPlatform.tokenPrice());
        //console.log(await ACDMPlatform.tokenMint());

        // проверка, что заминтилось правильное количество токенов
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(balanceBefore.add(tokenMint));
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1);
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The sale round has already begun")
        // проверка, что нельзя выставлять ордер во время раунда продажи
        await expect(
            ACDMPlatform.addOreder(10, 10)
        ).to.be.revertedWith("The trade round has not yet begun")
        // проверка, что нельзя покупать токены по ордерам во время раунда продажи
        await expect(
            ACDMPlatform.redeemToken(0, {value: 10_000_000_000})
        ).to.be.revertedWith("The trade round has not yet begun")
    })

    // В этом раунде покупать токены будет refer2 у которого нету рефералов
    it("check buyACDMToken() ACDMPlatform", async function(){

        // рассчитываем сколько будет стоить 1/5 всех заминченных токенов
        let tokenCount = (await ACDMPlatform.tokenMint()).div(5_000_000);
        let ethAmount = tokenCount.mul(tokenPrice);

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceBefore = await ACDMToken.balanceOf(refer2.address);

        // console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        // console.log(`ACDMTokenBalanceBefore: ${ACDMTokenBalanceBefore}`);
        // console.log(`rewardRefer1Before: ${rewardRefer1Before}`);
        // console.log(`rewardRefer2Before: ${rewardRefer2Before}`);

        // refer2 покупает токены
        let tx = await ACDMPlatform.connect(refer2).buyACDMToken({value: ethAmount});
        await tx.wait();

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceAfter = await ACDMToken.balanceOf(refer2.address);

        // console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        // console.log(`ACDMTokenBalanceAfter: ${ACDMTokenBalanceAfter}`);
        // console.log(`rewardRefer1After: ${rewardRefer1After}`);
        // console.log(`rewardRefer2After: ${rewardRefer2After}`);

        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        expect(ACDMTokenBalanceAfter).equal(ACDMTokenBalanceBefore.add(ethAmount.mul(decimals).div(tokenPrice)));

        // проверка, что нельзя купить токены, отправив 0 Eth
        await expect(
            ACDMPlatform.connect(refer2).buyACDMToken({value: 0})
        ).to.be.revertedWith("Congratulations! You bought 0 tokens");
    })

    // старт раунда продаж здесь токены на продажу будет выставлять пользователь refer2 у которого нету реферов
    it("check startTradeRound() ACDMPlatform - round number - 2", async function(){

        // скидываем сумму на которую были проданы токены в раунде продаж
        saleAmount = BigNumber.from(0)

        // проверка, что нельзя запустить раунд торговли, пока не закончилось время предыдущего раунда
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");

        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // переводим время вперёд
        await ethers.provider.send('evm_increaseTime', [roundTime]);

        // проверка, что нельзя покупать токены у платформы, если время раунда продажи истекло
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The time for the sale round is over")

        // запускаем раунд торговли
        let tx = await ACDMPlatform.startTradeRound();
        await tx.wait();

        // Проверяем, что на балансе платформы были сожжены все ACDMToken,
        // кроме токенов, выставленных на продажу в раунде торговли
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(tradeTokens);
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1)
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The time of the trade round is not over");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("The trade round has already begun")
        // проверка, что нельзя покупать токены у платформы во время раунда торговли
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The sales round has not yet begun")
    })

    // пользователь refer2 создаёт ордер
    it("check addOreder() ACDMPlatform", async function(){

        // refer2 выставляет половину своих токенов на продажу
        let tokenAmount = (await ACDMToken.balanceOf(refer2.address)).div(2);
        // а цену назначает несколько выше той, за которую покупал
        let cost = tokenPrice.add(1_000_000);

        // апруваем платформе тратить токены
        let tx = await ACDMToken.connect(refer2).approve(ACDMPlatform.address, tokenAmount);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceBefore = await ACDMToken.balanceOf(refer2.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем список ордеров
        let orders = await ACDMPlatform.getOrders();

        //console.log(`tradeTokens: ${tradeTokens}`);
        //console.log(`ACDMTokenUserBalanceBefore: ${ACDMTokenUserBalanceBefore}`);
        //console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);
        //console.log(`orders: ${orders}`);

        // создаём ордер
        tx = await ACDMPlatform.connect(refer2).addOreder(tokenAmount, cost);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        tradeTokens = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceAfter = await ACDMToken.balanceOf(refer2.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем список ордеров
        orders = await ACDMPlatform.getOrders();
        
        //console.log(`tradeTokens: ${tradeTokens}`);
        //console.log(`ACDMTokenUserBalanceAfter: ${ACDMTokenUserBalanceAfter}`);
        //console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        //console.log(`orders: ${orders}`);

        // проверка, что количество токенов, выставленных на продажу выросло
        expect(tradeTokens).equal(tradeTokensBefore.add(tokenAmount));
        // проверка, что токены были отправлены с адреса user
        expect(ACDMTokenUserBalanceAfter).equal(ACDMTokenUserBalanceBefore.sub(tokenAmount));
        // проверка, что токены прилетели на адрес ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.add(tokenAmount));
        // проверка значений ордера
        expect(orders[0].tokenAmount).equal(tokenAmount);
        expect(orders[0].cost).equal(ACDMTokenPlatformBalanceBefore.add(cost));
    })

    // пользователь buyer покупает токены из ордера пользователя refer2
    it("check redeemToken() ACDMPlatform", async function(){
        
        // сохраняем список ордеров
        let ordersBefore = await ACDMPlatform.getOrders();
        // рассчитываем стоимость покупки 1/2 токенов из этого первого ордера
        let ethAmount = (ordersBefore[0].cost).mul(ordersBefore[0].tokenAmount.div(2_000_000));

        // проверка, что нельзя покупать не существующий ордер
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(10, {value: ethAmount})
        ).to.be.revertedWith("No order with this ID")
        // проверка, что нельзя покупать токены не отправив денег
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(0, {value: 0})
        ).to.be.revertedWith("Congratulations! You bought 0 tokens")
        // проверка, что нельзя купить токенов, больше, чем есть в ордере
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(0, {value: ethAmount.mul(11)})
        ).to.be.revertedWith("There are not enough tokens in this order for that amount")
        
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceBefore = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceBefore = await ACDMPlatform.connect(refer2).getMyTradeEth();

        //console.log(`ordersBefore: ${ordersBefore}`);
        //console.log(`tradeTokensBefore: ${tradeTokensBefore}`);
        //console.log(`ACDMTokenBuyerBalanceBefore: ${ACDMTokenBuyerBalanceBefore}`);
        //console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);
        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`userEthBalanceBefore: ${userEthBalanceBefore}`);

        let tx = await ACDMPlatform.connect(buyer).redeemToken(0, {value: ethAmount});
        await tx.wait();
        saleAmount = saleAmount.add(ethAmount);

        // сохраняем список ордеров
        let ordersAfter = await ACDMPlatform.getOrders();
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensAfter = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceAfter = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceAfter = await ACDMPlatform.connect(refer2).getMyTradeEth();

        //console.log(`ordersAfter: ${ordersAfter}`);
        //console.log(`tradeTokensAfter: ${tradeTokensAfter}`);
        //console.log(`ACDMTokenBuyerBalanceAfter: ${ACDMTokenBuyerBalanceAfter}`);
        //console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        //console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        //console.log(`userEthBalanceAfter: ${userEthBalanceAfter}`);

        // рассчитываем сколько ACDMToken было приобретено
        let tokenAmount = (ethAmount).mul(decimals).div(ordersBefore[0].cost);
        //console.log(`tokenAmount: ${tokenAmount}`)

        // рассчитываем на сколько должен увеличится баланс продавца user
        // (профит с продажи) = (сумма покупки в эфирах) - (минус награда рефералам)
        // (награда рефералам) = (сумма покупки в эфирах) * (процент рефералов) / (1000)
        let salesProfit = ethAmount.sub(ethAmount.mul(tradeReward * 2).div(1000));

        // проверка, что количество токенов, выставленных на продажу уменьшилось
        expect(tradeTokensAfter).equal(tradeTokensBefore.sub(tokenAmount));
        // проверка, что токены списаны с адреса ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.sub(tokenAmount));
        // проверка, что токены были зачислены на адрес покупателя buyer
        expect(ACDMTokenBuyerBalanceAfter).equal(ACDMTokenBuyerBalanceBefore.add(tokenAmount));
        // проверка, что Eth зачислены на адрес ACDMPlatform
        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        // проверка, что баланс продавца user на платформе увеличился
        expect(userEthBalanceAfter).equal(userEthBalanceBefore.add(salesProfit));
        // проверка значений ордера
        expect(ordersAfter[0].tokenAmount).equal(ordersBefore[0].tokenAmount.sub(tokenAmount));
    })

    //                      ---------- ПЕРВЫЙ ЦИКЛ ЗАКОНЧИЛСЯ ----------

    //                        ---------- СТАРТ ВТОРОГО ЦИКЛА ----------

    // Здесь покупать и выставлять на продажу токены будет пользователь refer1 у которого есть рефер - refer2

    // Стартуем раунд продаж
    it("check startSaleRound() ACDMPlatform - round number - 3", async function(){

        // переводим время вперёд
        await ethers.provider.send('evm_increaseTime', [roundTime]);

        // проверка, что нельзя выставлять ордеры, когда вышло время trade раунда
        await expect(
            ACDMPlatform.addOreder(10, 10)
        ).to.be.revertedWith("The time for the trade round is over");
        // проверка, что нельзя совершать покупки по ордерам, когда вышло время trade раунда
        await expect(
            ACDMPlatform.redeemToken(0)
        ).to.be.revertedWith("The time for the trade round is over")

        // сначала сохраняем количество токенов на платформе
        let balanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // рассчитываем сколько должно быть заминчено токенов
        // расчёт tokenPrice в wei по формуле
        // tokenPrice = tokenPrice * 103 / 100 + 4_000_000_000_000
        tokenPrice = tokenPrice.mul(103).div(100).add(4_000_000_000_000);
        //console.log(tokenPrice);

        // Рассчёт количество токенов, которых надо заминтить. Рассчёт в ACDM-копейках по формуле
        // tokenMint = saleAmount * decimals / tokenPrice;
        let tokenMint = saleAmount.mul(decimals).div(tokenPrice);
        //console.log(tokenMint);
        

        // Стартуем раунд sale
        let tx = await ACDMPlatform.startSaleRound();
        await tx.wait();

        //console.log(saleAmount);
        //console.log(tokenPrice);
        //console.log(tokenMint);
        //console.log(await ACDMPlatform.saleAmount());
        //console.log(await ACDMPlatform.tokenPrice());
        //console.log(await ACDMPlatform.tokenMint());

        // проверка, что заминтилось правильное количество токенов
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(balanceBefore.add(tokenMint));
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1)
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The sale round has already begun")
        // проверка, что нельзя выставлять ордер во время раунда продажи
        await expect(
            ACDMPlatform.addOreder(10, 10)
        ).to.be.revertedWith("The trade round has not yet begun")
        // проверка, что покупать токены по ордерам во время раунда продажи
        await expect(
            ACDMPlatform.redeemToken(0, {value: 10_000_000_000})
        ).to.be.revertedWith("The trade round has not yet begun")
    })

    // ACDMtoken покупает пользователь refer1 для которого пользователь refer2 является рефералом
    // значит refer2 должен получить награду с покупки refer1
    it("check buyACDMToken() ACDMPlatform", async function(){

        // рассчитываем сколько будет стоить 1/5 всех заминченных токенов
        let tokenCount = (await ACDMPlatform.tokenMint()).div(5_000_000);
        let ethAmount = tokenCount.mul(tokenPrice);ethAmount

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceBefore = await ACDMToken.balanceOf(refer1.address);
        // награда первого рефера в Eth
        let rewardRefer2Before = await ACDMPlatform.connect(refer2).getMyReferalReward();

        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`ACDMTokenBalanceBefore: ${ACDMTokenBalanceBefore}`);
        //console.log(`rewardRefer2Before: ${rewardRefer2Before}`);
        //console.log(`ethAmount: ${ethAmount}`)
        //console.log(`ethAmount: ${await ACDMPlatform.tokenMint()}`)

        // refer1 покупает токены
        let tx = await ACDMPlatform.connect(refer1).buyACDMToken({value: ethAmount});
        await tx.wait();

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceAfter = await ACDMToken.balanceOf(refer1.address);
        // награда первого рефера в Eth
        let rewardRefer2After = await ACDMPlatform.connect(refer2).getMyReferalReward();

        // console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        // console.log(`ACDMTokenBalanceAfter: ${ACDMTokenBalanceAfter}`);
        // console.log(`rewardRefer2After: ${rewardRefer2After}`);

        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        expect(ACDMTokenBalanceAfter).equal(ACDMTokenBalanceBefore.add(ethAmount.mul(decimals).div(tokenPrice)));
        expect(rewardRefer2After).equal(rewardRefer2Before.add(ethAmount.mul(saleReward1).div(1000)));
    })

    // стартуем раунд продаж
    // в этом раунде токены будет продавать refer1, а refer2 будет получать процент от его прибыли
    it("check startTradeRound() ACDMPlatform - round number - 4", async function(){

        // скидываем сумму на которую были проданы токены в раунде продаж
        saleAmount = BigNumber.from(0)

        // проверка, что нельзя запустить раунд торговли, пока не закончилось время предыдущего раунда
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");

        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // переводим время вперёд
        await ethers.provider.send('evm_increaseTime', [roundTime]);

        // проверка, что нельзя покупать токены у платформы, если время раунда продажи истекло
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The time for the sale round is over")

        // сохраняем количество токенов, выставленных на продажу
        tradeTokens = await ACDMPlatform.tradeTokens();
        // запускаем раунд торговли
        let tx = await ACDMPlatform.startTradeRound();
        await tx.wait();

        // Проверяем, что на балансе платформы были сожжены все ACDMToken,
        // кроме токенов, выставленных на продажу в раунде торговли
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(tradeTokens);
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1);
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The time of the trade round is not over");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("The trade round has already begun")
        // проверка, что нельзя покупать токены у платформы во время раунда торговли
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The sales round has not yet begun")
    })

    // пользователь refer1 создаёт ордер
    it("check addOreder() ACDMPlatform", async function(){

        // refer1 выставляет 1/4 от всех своих токенов, а цену назначает выше рыночной
        let tokenAmount = (await ACDMToken.balanceOf(refer1.address)).div(4);
        // а цену назначает несколько выше той, за которую покупал
        let cost = tokenPrice.add(2_000_000);

        // апруваем платформе тратить токены
        let tx = await ACDMToken.connect(refer1).approve(ACDMPlatform.address, tokenAmount);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceBefore = await ACDMToken.balanceOf(refer1.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем список ордеров
        let orders = await ACDMPlatform.getOrders();

        // console.log(`tradeTokens: ${tradeTokens}`);
        // console.log(`ACDMTokenUserBalanceBefore: ${ACDMTokenUserBalanceBefore}`);
        // console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);
        // console.log(`orders: ${orders}`);

        // refer1 создаёт ордер
        tx = await ACDMPlatform.connect(refer1).addOreder(tokenAmount, cost);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        tradeTokens = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceAfter = await ACDMToken.balanceOf(refer1.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем список ордеров
        orders = await ACDMPlatform.getOrders();
        //let lastOrder = orders[orders.length() - 1];

        // console.log(`tradeTokens: ${tradeTokens}`);
        // console.log(`ACDMTokenUserBalanceAfter: ${ACDMTokenUserBalanceAfter}`);
        // console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        // console.log(`orders: ${orders}`);

        // проверка, что количество токенов, выставленных на продажу выросло
        expect(tradeTokens).equal(tradeTokensBefore.add(tokenAmount));
        // проверка, что токены были отправлены с адреса user
        expect(ACDMTokenUserBalanceAfter).equal(ACDMTokenUserBalanceBefore.sub(tokenAmount));
        // проверка, что токены прилетели на адрес ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.add(tokenAmount));
        // проверка значений ордера
        expect(orders[1].tokenAmount).equal(tokenAmount);
        //expect(orders[1].cost).equal(ACDMTokenPlatformBalanceBefore.add(cost));
    })

    // пользователь buyer покупает токены из ордера пользователя refer1
    // refer2 получает процент от продаж
    it("check redeemToken() ACDMPlatform", async function(){
        
        // сохраняем список ордеров
        let ordersBefore = await ACDMPlatform.getOrders();
        // рассчитываем стоимость покупки 1/2 токенов из второго ордера
        let ethAmount = (ordersBefore[1].cost).mul(ordersBefore[1].tokenAmount.div(2_000_000));

        // проверка, что нельзя покупать не существующий ордер
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(10, {value: ethAmount})
        ).to.be.revertedWith("No order with this ID")
        // проверка, что нельзя покупать токены не отправив денег
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(1, {value: 0})
        ).to.be.revertedWith("Congratulations! You bought 0 tokens")
        // проверка, что нельзя купить токенов, больше, чем есть в ордере
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(1, {value: ethAmount.mul(10)})
        ).to.be.revertedWith("There are not enough tokens in this order for that amount")
        
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceBefore = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceBefore = await ACDMPlatform.connect(refer1).getMyTradeEth();
        // награда первого рефера в Eth
        let rewardRefer1Before = await ACDMPlatform.connect(refer2).getMyReferalReward();

        //console.log(`ordersBefore: ${ordersBefore}`);
        //console.log(`tradeTokensBefore: ${tradeTokensBefore}`);
        //console.log(`ACDMTokenBuyerBalanceBefore: ${ACDMTokenBuyerBalanceBefore}`);
        //console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);
        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`userEthBalanceBefore: ${userEthBalanceBefore}`);
        //console.log(`rewardRefer1Before: ${rewardRefer1Before}`);

        let tx = await ACDMPlatform.connect(buyer).redeemToken(1, {value: ethAmount});
        await tx.wait();
        saleAmount = saleAmount.add(ethAmount);

        // сохраняем список ордеров
        let ordersAfter = await ACDMPlatform.getOrders();
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensAfter = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceAfter = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceAfter = await ACDMPlatform.connect(refer1).getMyTradeEth();
        // награда первого рефера в Eth
        let rewardRefer1After = await ACDMPlatform.connect(refer2).getMyReferalReward();

        //console.log(`ordersAfter: ${ordersAfter}`);
        //console.log(`tradeTokensAfter: ${tradeTokensAfter}`);
        //console.log(`ACDMTokenBuyerBalanceAfter: ${ACDMTokenBuyerBalanceAfter}`);
        //console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        //console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        //console.log(`userEthBalanceAfter: ${userEthBalanceAfter}`);
        //console.log(`rewardRefer1After: ${rewardRefer1After}`);

        // рассчитываем сколько ACDMToken было приобретено
        let tokenAmount = (ethAmount).mul(decimals).div(ordersBefore[1].cost);
        //console.log(`tokenAmount: ${tokenAmount}`)

        // рассчитываем на сколько должен увеличится баланс продавца user
        // (профит с продажи) = (сумма покупки в эфирах) - (минус награда рефералам)
        // (награда рефералам) = (сумма покупки в эфирах) * (процент рефералов) / (1000)
        let salesProfit = ethAmount.sub(ethAmount.mul(tradeReward * 2).div(1000));

        // проверка, что количество токенов, выставленных на продажу уменьшилось
        expect(tradeTokensAfter).equal(tradeTokensBefore.sub(tokenAmount));
        // проверка, что токены списаны с адреса ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.sub(tokenAmount));
        // проверка, что токены были зачислены на адрес покупателя buyer
        expect(ACDMTokenBuyerBalanceAfter).equal(ACDMTokenBuyerBalanceBefore.add(tokenAmount));
        // проверка, что Eth зачислены на адрес ACDMPlatform
        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        // проверка, что баланс продавца refer2 на платформе увеличился
        expect(userEthBalanceAfter).equal(userEthBalanceBefore.add(salesProfit));
        // провкра реферов
        expect(rewardRefer1After).equal(rewardRefer1Before.add(ethAmount.mul(tradeReward).div(1000)));
        // проверка значений ордера
        //expect(ordersAfter[1].tokenAmount).equal(ordersBefore[1].tokenAmount.sub(tokenAmount));
    })

    // пользователь refer2 удаляет свой ордер и получает оставшиеся там токены обратно на свой счёт
    it("check removeToken() ACDMPlatform", async function() {

        // проверка, что нельзя убрать несуществующий ордер
        await expect(
            ACDMPlatform.removeToken(10)
        ).to.be.revertedWith("No order with this ID");
        // проверка, что ордер может убрать только его владелец
        await expect(
            ACDMPlatform.connect(hacker).removeToken(0)
        ).to.be.revertedWith("You are not a seller in this order")

        // сохраняем список ордеров
        let ordersBefore = await ACDMPlatform.getOrders();
        // сохраняем баланс ACDMToken пользователя refer2
        let ACDMTokenRefer2BalanceBefore = await ACDMToken.balanceOf(refer2.address);

        let tx = await ACDMPlatform.connect(refer2).removeToken(0);
        await tx.wait();

        // сохраняем список ордеров
        let ordersAfter = await ACDMPlatform.getOrders();
        // сохраняем баланс ACDMToken пользователя refer2
        let ACDMTokenRefer2BalanceAfter = await ACDMToken.balanceOf(refer2.address);

        // проверяем, что теперь количество токенов, выставленных на продажу в этом ордере равно 0
        expect(ordersAfter[0].tokenAmount).equal(0);
        // проверяем, что токены вернулись на баланс пользователя refer2
        expect(ACDMTokenRefer2BalanceAfter).equal(ACDMTokenRefer2BalanceBefore.add(ordersBefore[0].tokenAmount));

        // проверка, что повторно удалить ордер, либо удалить распроданный ордер
        await expect(
            ACDMPlatform.connect(refer2).removeToken(0)
        ).to.be.revertedWith("Order now closed")
    })

    //                      ---------- ВТОРОЙ ЦИКЛ ЗАКОНЧИЛСЯ ----------

    //                       ---------- СТАРТ ТРЕТЬЕГО ЦИКЛА ----------

    // Здесь покупать и выставлять на продажу токены будет пользователь user у которого есть реферы - refer1, refer2


    // Стартуем раунд продаж
    it("check startSaleRound() ACDMPlatform  - round number - 5", async function(){

        // переводим время вперёд
        await ethers.provider.send('evm_increaseTime', [roundTime]);

        // сначала сохраняем количество токенов на платформе
        let balanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // рассчитываем сколько должно быть заминчено токенов
        // расчёт tokenPrice в wei по формуле
        // tokenPrice = tokenPrice * 103 / 100 + 4_000_000_000_000
        tokenPrice = tokenPrice.mul(103).div(100).add(4_000_000_000_000);
        //console.log(tokenPrice);

        // Рассчёт количество токенов, которых надо заминтить. Рассчёт в ACDM-копейках по формуле
        // tokenMint = saleAmount * decimals / tokenPrice;
        let tokenMint = saleAmount.mul(decimals).div(tokenPrice);
        //console.log(tokenMint);

        // Стартуем раунд sale
        let tx = await ACDMPlatform.startSaleRound();
        await tx.wait();

        //console.log(await ACDMPlatform.tokenPrice());
        //console.log(await ACDMPlatform.tokenMint());

        // проверка, что заминтилось правильное количество токенов
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(balanceBefore.add(tokenMint));
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1);
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The sale round has already begun")
        // проверка, что нельзя выставлять ордер во время раунда продажи
        await expect(
            ACDMPlatform.addOreder(10, 10)
        ).to.be.revertedWith("The trade round has not yet begun")
        // проверка, что покупать токены по ордерам во время раунда продажи
        await expect(
            ACDMPlatform.redeemToken(0, {value: 10_000_000_000})
        ).to.be.revertedWith("The trade round has not yet begun")
    })

    // токены покупает пользователь user для которого рефером является refer1
    // а для refer1 рефером является refer2
    // значит награду будут получать и refer1 и refer2
    it("check buyACDMToken() ACDMPlatform", async function(){

        // рассчитываем сколько будет стоить 1/10 всех заминченных токенов
        let tokenCount = (await ACDMPlatform.tokenMint()).div(10_000_000);
        let ethAmount = tokenCount.mul(tokenPrice);

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceBefore = await ACDMToken.balanceOf(user.address);
        // награда первого рефера в Eth
        let rewardRefer1Before = await ACDMPlatform.connect(refer1).getMyReferalReward();
        // награда второго рефера в Eth
        let rewardRefer2Before = await ACDMPlatform.connect(refer2).getMyReferalReward();

        // console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        // console.log(`ACDMTokenBalanceBefore: ${ACDMTokenBalanceBefore}`);
        // console.log(`rewardRefer1Before: ${rewardRefer1Before}`);
        // console.log(`rewardRefer2Before: ${rewardRefer2Before}`);

        // user покупает токены
        let tx = await ACDMPlatform.connect(user).buyACDMToken({value: ethAmount});
        await tx.wait();

        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // баланс покупателя в ACDMToken
        let ACDMTokenBalanceAfter = await ACDMToken.balanceOf(user.address);
        // награда первого рефера в Eth
        let rewardRefer1After = await ACDMPlatform.connect(refer1).getMyReferalReward();
        // награда второго рефера в Eth
        let rewardRefer2After = await ACDMPlatform.connect(refer2).getMyReferalReward();

        // console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        // console.log(`ACDMTokenBalanceAfter: ${ACDMTokenBalanceAfter}`);
        // console.log(`rewardRefer1After: ${rewardRefer1After}`);
        // console.log(`rewardRefer2After: ${rewardRefer2After}`);

        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        expect(ACDMTokenBalanceAfter).equal(ACDMTokenBalanceBefore.add(ethAmount.mul(decimals).div(tokenPrice)));
        expect(rewardRefer1After).equal(rewardRefer1Before.add(ethAmount.mul(saleReward1).div(1000)));
        expect(rewardRefer2After).equal(rewardRefer2Before.add(ethAmount.mul(saleReward2).div(1000)));
    })

    // стартуем раунд торговли
    it("check startTradeRound() ACDMPlatform  - round number - 6", async function(){

        // скидываем сумму на которую были проданы токены в раунде продаж
        saleAmount = BigNumber.from(0)

        // проверка, что нельзя запустить раунд торговли, пока не закончилось время предыдущего раунда
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("Sales round time is not over yet or not all tokens are sold out");

        // сохраняем номер раунда
        roundNumber = await ACDMPlatform.roundNumber();

        // переводим время вперёд
        await ethers.provider.send('evm_increaseTime', [roundTime]);

        // проверка, что нельзя покупать токены у платформы, если время раунда продажи истекло
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The time for the sale round is over")

        // сохраняем количество токенов, выставленных на продажу
        tradeTokens = await ACDMPlatform.tradeTokens();
        // запускаем раунд торговли

        let tx = await ACDMPlatform.startTradeRound();
        await tx.wait();

        // Проверяем, что на балансе платформы были сожжены все ACDMToken,
        // кроме токенов, выставленных на продажу в раунде торговли
        expect(await ACDMToken.balanceOf(ACDMPlatform.address)).equal(tradeTokens);
        // проверка, что увеличился номер раунда
        roundNumber = roundNumber.add(1);
        expect(await ACDMPlatform.roundNumber()).equal(roundNumber);

        // проверка, что нельзя начать следующий раунд, пока не закончен этот раунд
        await expect(
            ACDMPlatform.startSaleRound()
        ).to.be.revertedWith("The time of the trade round is not over");
        // проверка, что нельзя начать уже начавшийся раунд
        await expect(
            ACDMPlatform.startTradeRound()
        ).to.be.revertedWith("The trade round has already begun")
        // проверка, что нельзя покупать токены у платформы во время раунда торговли
        await expect(
            ACDMPlatform.buyACDMToken({value: 10_000_000_000_000})
        ).to.be.revertedWith("The sales round has not yet begun")
    })

    // пользователь user создаёт ордер
    it("check addOreder() ACDMPlatform", async function(){

        // user выставляет 1/2 от всех своих токенов, а цену назначает выше рыночной
        let tokenAmount = (await ACDMToken.balanceOf(user.address)).div(2);
        // а цену назначает несколько выше той, за которую покупал
        let cost = tokenPrice.add(3_000_000);

        // апруваем платформе тратить токены
        let tx = await ACDMToken.connect(user).approve(ACDMPlatform.address, tokenAmount);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceBefore = await ACDMToken.balanceOf(user.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);

        // console.log(`tradeTokens: ${tradeTokens}`);
        // console.log(`ACDMTokenUserBalanceBefore: ${ACDMTokenUserBalanceBefore}`);
        // console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);

        // user создаёт ордер
        tx = await ACDMPlatform.connect(user).addOreder(tokenAmount, cost);
        await tx.wait();

        // сохраняем количество токенов, выставленных на продажу
        tradeTokens = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenUserBalanceAfter = await ACDMToken.balanceOf(user.address);
        // сохраняем баланс ACDMToken пользователя
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // сохраняем список ордеров
        let ordersAfter = await ACDMPlatform.getOrders();
        //let lastOrder = orders[orders.length() - 1];

        // console.log(`tradeTokens: ${tradeTokens}`);
        // console.log(`ACDMTokenUserBalanceAfter: ${ACDMTokenUserBalanceAfter}`);
        // console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        // console.log(`orders: ${ordersAfter[2]}`);

        // проверка, что количество токенов, выставленных на продажу выросло
        expect(tradeTokens).equal(tradeTokensBefore.add(tokenAmount));
        // проверка, что токены были отправлены с адреса user
        expect(ACDMTokenUserBalanceAfter).equal(ACDMTokenUserBalanceBefore.sub(tokenAmount));
        // проверка, что токены прилетели на адрес ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.add(tokenAmount));
        // проверка значений ордера
        expect(ordersAfter[2].tokenAmount).equal(tokenAmount);
        expect(ordersAfter[2].cost).equal(cost);
    })

    // пользователь buyer покупает токены из ордера пользователя user
    // пользователи refer1 и refer2 получают награды
    it("check redeemToken() ACDMPlatform", async function(){
        
        // сохраняем список ордеров
        let ordersBefore = await ACDMPlatform.getOrders();
        // рассчитываем стоимость покупки 1/2 токенов из третьего ордера
        let ethAmount = (ordersBefore[2].cost).mul(ordersBefore[2].tokenAmount.div(2_000_000));

        // проверка, что нельзя покупать не существующий ордер
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(10, {value: ethAmount})
        ).to.be.revertedWith("No order with this ID")
        // проверка, что нельзя покупать токены не отправив денег
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(2, {value: 0})
        ).to.be.revertedWith("Congratulations! You bought 0 tokens")
        // проверка, что нельзя купить токенов, больше, чем есть в ордере
        await expect(
            ACDMPlatform.connect(buyer).redeemToken(2, {value: ethAmount.mul(10)})
        ).to.be.revertedWith("There are not enough tokens in this order for that amount")
        
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensBefore = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceBefore = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceBefore = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceBefore = await ACDMPlatform.connect(user).getMyTradeEth();
        // награда первого рефера в Eth
        let rewardRefer1Before = await ACDMPlatform.connect(refer1).getMyReferalReward();
        // награда второго рефера в Eth
        let rewardRefer2Before = await ACDMPlatform.connect(refer2).getMyReferalReward();

        //console.log(`ordersBefore: ${ordersBefore}`);
        //console.log(`tradeTokensBefore: ${tradeTokensBefore}`);
        //console.log(`ACDMTokenBuyerBalanceBefore: ${ACDMTokenBuyerBalanceBefore}`);
        //console.log(`ACDMTokenPlatformBalanceBefore: ${ACDMTokenPlatformBalanceBefore}`);
        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`userEthBalanceBefore: ${userEthBalanceBefore}`);
        //console.log(`rewardRefer1Before: ${rewardRefer1Before}`);
        //console.log(`rewardRefer2Before: ${rewardRefer2Before}`);

        let tx = await ACDMPlatform.connect(buyer).redeemToken(2, {value: ethAmount});
        await tx.wait();
        saleAmount = saleAmount.add(ethAmount);

         // сохраняем список ордеров
        let ordersAfter = await ACDMPlatform.getOrders();
        // сохраняем количество токенов, выставленных на продажу
        let tradeTokensAfter = await ACDMPlatform.tradeTokens();
        // сохраняем баланс ACDMToken покупателя
        let ACDMTokenBuyerBalanceAfter = await ACDMToken.balanceOf(buyer.address);
        // сохраняем баланс ACDMToken платформы
        let ACDMTokenPlatformBalanceAfter = await ACDMToken.balanceOf(ACDMPlatform.address);
        // баланс платформы в Eth
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // количество эфира, заработанного пользователем user
        let userEthBalanceAfter = await ACDMPlatform.connect(user).getMyTradeEth();
        // награда первого рефера в Eth
        let rewardRefer1After = await ACDMPlatform.connect(refer1).getMyReferalReward();
        // награда второго рефера в Eth
        let rewardRefer2After = await ACDMPlatform.connect(refer2).getMyReferalReward();

        //console.log(`ordersAfter: ${ordersAfter}`);
        //console.log(`tradeTokensAfter: ${tradeTokensAfter}`);
        //console.log(`ACDMTokenBuyerBalanceAfter: ${ACDMTokenBuyerBalanceAfter}`);
        //console.log(`ACDMTokenPlatformBalanceAfter: ${ACDMTokenPlatformBalanceAfter}`);
        //console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        //console.log(`userEthBalanceAfter: ${userEthBalanceAfter}`);
        //console.log(`rewardRefer1After: ${rewardRefer1After}`);
        //console.log(`rewardRefer2After: ${rewardRefer2After}`);

        // рассчитываем сколько ACDMToken было приобретено
        let tokenAmount = (ethAmount).mul(decimals).div(ordersBefore[2].cost);
        //console.log(`tokenAmount: ${tokenAmount}`)

        // рассчитываем на сколько должен увеличится баланс продавца user
        // (профит с продажи) = (сумма покупки в эфирах) - (минус награда рефералам)
        // (награда рефералам) = (сумма покупки в эфирах) * (процент рефералов) / (1000)
        let salesProfit = ethAmount.sub(ethAmount.mul(tradeReward * 2).div(1000));

        // проверка, что количество токенов, выставленных на продажу уменьшилось
        expect(tradeTokensAfter).equal(tradeTokensBefore.sub(tokenAmount));
        // проверка, что токены списаны с адреса ACDMPlatform
        expect(ACDMTokenPlatformBalanceAfter).equal(ACDMTokenPlatformBalanceBefore.sub(tokenAmount));
        // проверка, что токены были зачислены на адрес покупателя buyer
        expect(ACDMTokenBuyerBalanceAfter).equal(ACDMTokenBuyerBalanceBefore.add(tokenAmount));
        // проверка, что Eth зачислены на адрес ACDMPlatform
        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.add(ethAmount));
        // проверка, что баланс продавца user на платформе увеличился
        expect(userEthBalanceAfter).equal(userEthBalanceBefore.add(salesProfit));
        // провкра реферов
        expect(rewardRefer1After).equal(rewardRefer1Before.add(ethAmount.mul(tradeReward).div(1000)));
        expect(rewardRefer2After).equal(rewardRefer2Before.add(ethAmount.mul(tradeReward).div(1000)));
        // проверка значений ордера
        expect(ordersAfter[2].tokenAmount).equal(ordersBefore[2].tokenAmount.sub(tokenAmount));
    })

    // пользователь refer2 выводит прибыль с рефералов
    it("check withdrawalReferalReward() ACDMPlatform", async function(){

        // проверка, что нельзя вывести прибыль, если у тебя её нету
        await expect(
            ACDMPlatform.connect(user).withdrawalReferalReward()
        ).to.be.revertedWith("You have no referral rewards")

        // сохраняем баланс пользователя, у которого есть прибыль с рефералов
        let Refer2EthBalanceBefore = await ethers.provider.getBalance(refer2.address);
        // сохраняем баланс платформы
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // сохраняем значение реферальной прибыли на платформе для конкретного рефера
        let Refer2ReferalRewardBefore = await ACDMPlatform.connect(refer2).getMyReferalReward();
        // сохраняем значение всей реферальной прибыли на платформе
        let ACDMPlatformReferalRewardBefore = await ACDMPlatform.referalReward();

        //console.log(`Refer2EthBalanceBefore: ${Refer2EthBalanceBefore}`);
        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`Refer2ReferalRewardBefore: ${Refer2ReferalRewardBefore}`);
        //console.log(`ACDMPlatformReferalRewardBefore: ${ACDMPlatformReferalRewardBefore}`);

        let tx = await ACDMPlatform.connect(refer2).withdrawalReferalReward();
        let responce =  await tx.wait();
        // рассчитываем комиссию за выполнение транзакции
        const fee = responce.cumulativeGasUsed.mul(responce.effectiveGasPrice);

        // сохраняем баланс пользователя, у которого есть прибыль с рефералов
        let Refer2EthBalanceAfter = await ethers.provider.getBalance(refer2.address);
        // сохраняем баланс платформы
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // сохраняем значение реферальной прибыли на платформе для конкретного рефера
        let Refer2ReferalRewardAfter = await ACDMPlatform.connect(refer2).getMyReferalReward();
        // сохраняем значение всей реферальной прибыли на платформе
        let ACDMPlatformReferalRewardAfter = await ACDMPlatform.referalReward();

        //console.log(`Refer2EthBalanceAfter: ${Refer2EthBalanceAfter}`);
        //console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        //console.log(`Refer2ReferalRewardAfter: ${Refer2ReferalRewardAfter}`);
        //console.log(`ACDMPlatformReferalRewardAfter: ${ACDMPlatformReferalRewardAfter}`);

        // проверяем, что баланс рефера увеличился
        expect(Refer2EthBalanceAfter).equal(Refer2EthBalanceBefore.sub(fee).add(Refer2ReferalRewardBefore));
        // проверяем, что баланс реферальной прибыли рефера на контракте обнулился
        expect(Refer2ReferalRewardAfter).equal(0);
        // проверяем, что баланс платформы уменьшился на сумму выведенного эфира
        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.sub(Refer2ReferalRewardBefore));
        // проверяем, что значение реферального вознаграждения на платформы уменьшился на сумму выведенного эфира
        expect(ACDMPlatformReferalRewardAfter).equal(ACDMPlatformReferalRewardBefore.sub(Refer2ReferalRewardBefore));
    })

    // пользователь refer2 выводит прибыль с проданых токенов
    it("check withdrawalTradeEth() ACDMPlatform", async function(){

        // проверка, что нельзя вывести прибыль, если у тебя её нету
        await expect(
            ACDMPlatform.connect(hacker).withdrawalTradeEth()
        ).to.be.revertedWith("You have no trade ethers")

        // сохраняем баланс пользователя, у которого есть прибыль с рефералов
        let Refer2EthBalanceBefore = await ethers.provider.getBalance(refer2.address);
        // сохраняем баланс платформы
        let ACDMPlatformEthBalanceBefore = await ethers.provider.getBalance(ACDMPlatform.address);
        // сохраняем значение реферальной прибыли на платформе для конкретного рефера
        let Refer2TradeEthBefore = await ACDMPlatform.connect(refer2).getMyTradeEth();
        // сохраняем значение всей реферальной прибыли на платформе
        let ACDMPlatformTradeEthBefore = await ACDMPlatform.tradeEth();

        //console.log(`Refer2EthBalanceBefore: ${Refer2EthBalanceBefore}`);
        //console.log(`ACDMPlatformEthBalanceBefore: ${ACDMPlatformEthBalanceBefore}`);
        //console.log(`Refer2TradeEthBefore: ${Refer2TradeEthBefore}`);
        //console.log(`ACDMPlatformTradeEthBefore: ${ACDMPlatformTradeEthBefore}`);

        let tx = await ACDMPlatform.connect(refer2).withdrawalTradeEth();
        let responce =  await tx.wait();
        // рассчитываем комиссию за выполнение транзакции
        const fee = responce.cumulativeGasUsed.mul(responce.effectiveGasPrice);

        // сохраняем баланс пользователя, у которого есть прибыль с рефералов
        let Refer2EthBalanceAfter = await ethers.provider.getBalance(refer2.address);
        // сохраняем баланс платформы
        let ACDMPlatformEthBalanceAfter = await ethers.provider.getBalance(ACDMPlatform.address);
        // сохраняем значение реферальной прибыли на платформе для конкретного рефера
        let Refer2TradeEthAfter = await ACDMPlatform.connect(refer2).getMyReferalReward();
        // сохраняем значение всей реферальной прибыли на платформе
        let ACDMPlatformTradeEthdAfter = await ACDMPlatform.tradeEth();

        //console.log(`Refer2EthBalanceAfter: ${Refer2EthBalanceAfter}`);
        //console.log(`ACDMPlatformEthBalanceAfter: ${ACDMPlatformEthBalanceAfter}`);
        //console.log(`Refer2TradeEthAfter: ${Refer2TradeEthAfter}`);
        //console.log(`ACDMPlatformTradeEthdAfter: ${ACDMPlatformTradeEthdAfter}`);

        // проверяем, что баланс рефера увеличился
        expect(Refer2EthBalanceAfter).equal(Refer2EthBalanceBefore.sub(fee).add(Refer2TradeEthBefore));
        // проверяем, что баланс реферальной прибыли рефера на контракте обнулился
        expect(Refer2TradeEthAfter).equal(0);
        // проверяем, что баланс платформы уменьшился на сумму выведенного эфира
        expect(ACDMPlatformEthBalanceAfter).equal(ACDMPlatformEthBalanceBefore.sub(Refer2TradeEthBefore));
        // проверяем, что значение прибыли от продажи токенов на платформы уменьшился на сумму выведенного эфира
        expect(ACDMPlatformTradeEthdAfter).equal(ACDMPlatformTradeEthBefore.sub(Refer2TradeEthBefore));
    })

    // получение списка голосований
    it("check setSaleReward1(), setSaleReward2() and setTradeReward() ACDMPlatform", async function(){
        
        // проверка, что нельзя вызвать эти функцию, если ты не контракт DAO
        // даже если ты owner контракта
        await expect(
            ACDMPlatform.connect(hacker).setSaleReward1(50)
        ).to.be.revertedWith("You are not DAO");
        await expect(
            ACDMPlatform.setSaleReward1(50)
        ).to.be.revertedWith("You are not DAO");
        await expect(
            ACDMPlatform.connect(hacker).setSaleReward2(50)
        ).to.be.revertedWith("You are not DAO");
        await expect(
            ACDMPlatform.setSaleReward2(50)
        ).to.be.revertedWith("You are not DAO");
        await expect(
            ACDMPlatform.connect(hacker).setTradeReward(50)
        ).to.be.revertedWith("You are not DAO");
        await expect(
            ACDMPlatform.setTradeReward(50)
        ).to.be.revertedWith("You are not DAO");
    })
});
