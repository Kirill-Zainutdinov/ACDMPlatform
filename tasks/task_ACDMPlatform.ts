import '@nomiclabs/hardhat-ethers'
import { task } from "hardhat/config";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ACDMPlatform__factory, MyERC20__factory } from "../typechain";


// ACDMPlatform 0x7cF99AEf0c7F283bdD1b44694D4410f93b993bF4

// функция register
task("register", "register in platform")
    .addParam("platformAddress")
    .addParam("refer")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        let tx = await ACDMPlatform.register(args.refer)
        await tx.wait();

        let refer1 = (await ACDMPlatform.getMyRefers()).refer1;
        expect(refer1).equal(args.refer);
        console.log(`You have successfully registered on the platform`);
        console.log(`Address of your referral ${refer1}`);
});

// функция startSaleRound
task("startSaleRound", "start sale round")
    .addParam("platformAddress")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        let tx = await ACDMPlatform.startSaleRound();
        await tx.wait();

        let roundNumber = await ACDMPlatform.roundNumber();

        if(roundNumber.mod(2) == BigNumber.from(1)){
            console.log(`The sales round has successfully started`);
        } else {
            console.log(`Something went wrong`);
        }
});

// функция buyACDMToken
task("buyACDMToken", "buy ACDMToken")
    .addParam("platformAddress")
    .addParam("ethAmount")
    .setAction(async (args, hre) => {
        const [owner] = await hre.ethers.getSigners();
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);
        const ACDMTokenFactory = (await hre.ethers.getContractFactory("MyERC20")) as MyERC20__factory;
        const ACDMToken = await ACDMTokenFactory.attach("0xCC826A61C12cc9AfB5Dc65737706e06f738A3364");
        console.log(`Successfully connected to the contract ACDMToken`);

        let tx = await ACDMPlatform.buyACDMToken({value: args.ethAmount});
        await tx.wait();

        let ACDMTokenBalance = await ACDMToken.balanceOf(owner.address);

        console.log(`You have successfully purchased ${ACDMTokenBalance} tokens`);
});

// функция startTradeRound
task("startTradeRound", "start trade round")
    .addParam("platformAddress")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        let tx = await ACDMPlatform.startTradeRound();
        await tx.wait();

        let roundNumber = await ACDMPlatform.roundNumber();

        if(roundNumber.mod(2) == BigNumber.from(0)){
            console.log(`The trade round has successfully started`);
        } else {
            console.log(`Something went wrong`);
        }
});

// функция addOreder
task("addOreder", "add oreder")
    .addParam("platformAddress")
    .addParam("tokenAmount")
    .addParam("cost")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        // создаём ордер
        let tx = await ACDMPlatform.addOreder(args.tokenAmount, args.cost);
        await tx.wait();

        let orders = await ACDMPlatform.getOrders();
        let orderId = orders.length
        console.log(`Your order has been successfully created. Order ID ${orderId}`)
});

// функция redeemToken
task("redeemToken", "redeem token")
    .addParam("platformAddress")
    .addParam("orderId")
    .addParam("ethAmount")
    .setAction(async (args, hre) => {
        const [owner] = await hre.ethers.getSigners();
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);
        const ACDMTokenFactory = (await hre.ethers.getContractFactory("MyERC20")) as MyERC20__factory;
        const ACDMToken = await ACDMTokenFactory.attach("0xCC826A61C12cc9AfB5Dc65737706e06f738A3364");
        console.log(`Successfully connected to the contract ACDMToken`);

        let ACDMTokenBalanceBefore = await ACDMToken.balanceOf(owner.address);

        let tx = await ACDMPlatform.redeemToken(args.orderId, {value: args.thAmount});
        await tx.wait();

        let ACDMTokenBalanceAfter = await ACDMToken.balanceOf(owner.address);

        console.log(`You have successfully purchased ${ACDMTokenBalanceAfter.sub(ACDMTokenBalanceBefore)} tokens`);
});

// функция removeToken
task("removeToken", "remove token")
    .addParam("platformAddress")
    .addParam("orderId")
    .setAction(async (args, hre) => {
        const [owner] = await hre.ethers.getSigners();
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);
        const ACDMTokenFactory = (await hre.ethers.getContractFactory("MyERC20")) as MyERC20__factory;
        const ACDMToken = await ACDMTokenFactory.attach("0xCC826A61C12cc9AfB5Dc65737706e06f738A3364");
        console.log(`Successfully connected to the contract ACDMToken`);

        let ACDMTokenBalanceBefore = await ACDMToken.balanceOf(owner.address);

        let tx = await ACDMPlatform.removeToken(args.orderId);
        await tx.wait();

        let ACDMTokenBalanceAfter = await ACDMToken.balanceOf(owner.address);

        console.log(`You have successfully withdrawn ${ACDMTokenBalanceAfter.sub(ACDMTokenBalanceBefore)} tokens`);
});

// функция withdrawalReferalReward
task("withdrawalReferalReward", "withdrawal referal reward")
    .addParam("platformAddress")
    .setAction(async (args, hre) => {
        const [owner] = await hre.ethers.getSigners();
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        let EthBalanceBefore = await hre.ethers.provider.getBalance(owner.address);

        let tx = await ACDMPlatform.withdrawalReferalReward();
        await tx.wait();

        let EthBalanceAfter = await hre.ethers.provider.getBalance(owner.address);

        console.log(`You have successfully withdrawn a referral award`);
        console.log(`Your balance was ${EthBalanceBefore}. Your balance is now ${EthBalanceAfter}`);
});

// функция withdrawalTradeEth
task("withdrawalTradeEth", "withdrawal trade eth")
    .addParam("platformAddress")
    .setAction(async (args, hre) => {
        const [owner] = await hre.ethers.getSigners();
        // подключаемся к контракту
        const ACDMFactory = (await hre.ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
        const ACDMPlatform = await ACDMFactory.attach(args.platformAddress);
        console.log(`Successfully connected to the contract ACDMPlatform`);

        let EthBalanceBefore = await hre.ethers.provider.getBalance(owner.address);

        let tx = await ACDMPlatform.withdrawalTradeEth();
        await tx.wait();

        let EthBalanceAfter = await hre.ethers.provider.getBalance(owner.address);

        console.log(`You have successfully withdrawn profit from the sale of tokens`);
        console.log(`Your balance was ${EthBalanceBefore}. Your balance is now ${EthBalanceAfter}`);
});
