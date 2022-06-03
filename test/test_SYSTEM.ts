import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC20, Staking, IUniswapV2Router02, IUniswapV2Factory, IUniswapV2Pair, ACDMPlatform, DAO} from "../typechain"


describe("SYSTEM", function () {

    // истансы контрактов
    let ACDMToken : MyERC20;
    let XXXToken : MyERC20;
    let ACDMPlatform : ACDMPlatform;
    let staking : Staking;
    let dao : DAO;
    
    let tokenLP : IUniswapV2Pair;
    let router : IUniswapV2Router02;
    let factory : IUniswapV2Factory;

    // адреса
    // аккаунты
    let owner : SignerWithAddress;
    let voter1 : SignerWithAddress;
    let voter2 : SignerWithAddress;
    let voter3 : SignerWithAddress;
    let refer1 : SignerWithAddress;
    let refer2 : SignerWithAddress;
    let user : SignerWithAddress;
    let buyer : SignerWithAddress;
    let hacker : SignerWithAddress;

    // значения, используемые в контракте ACDMPlatform
        // номер раунда
        // нечётный - sale
        // чётный - trade
        let roundNumber = BigNumber.from(0);
        // продолжительность раунда
        const roundTime = 259_200;
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

    // значения, используемые в контракте staking
        // время заморозки - по умолчанию 7 дней
        let freezingTime = 604_800;
        // проценты - по умолчанию - 10%
        let percents = 3;
        //
        let tokenLPAmount : BigNumber;
        // время когда был сделан стейк (нужно для тестов)
        let stakeTime : number;

    // значения, используемые в контракте dao
        // время голосования - по умолчанию 3 дня
        let voteTime = 259_200;

    // аргументы для конструкторов контрактов
    const ercNameACDM = "ACDMToken";
    const ercSymbolACDM = "ACDM";
    const decimalsACDM = 6;
    const ercNameXXX = "XXXToken";
    const ercSymbolXXX = "XXX";
    const decimalsXXX = 18;

    before(async function(){
        [owner, voter1, voter2, voter3, refer1, refer2, user, buyer, hacker] = await ethers.getSigners();

        // деплоим ACDMToken и XXXToken
        const tokenFactory = (await ethers.getContractFactory("MyERC20"));
        ACDMToken = await tokenFactory.deploy(ercNameACDM, ercSymbolACDM, decimalsACDM);
        XXXToken = await tokenFactory.deploy(ercNameXXX, ercSymbolXXX, decimalsXXX);

        // получаем инстансы роутера и фактори UniSwap
        router = (await ethers.getContractAt("IUniswapV2Router02",  process.env.ROUTER_ADDRESS as string));
        factory = (await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));

    })

    it("check mint() XXXToken to voter1, voter2, voter3", async function(){

        let amountMintToken = BigNumber.from("1000000000000000000");

        // проверяем баланс до эмиссии
        let voter1BalanceBefore = await XXXToken.balanceOf(voter1.address);
        let voter2BalanceBefore = await XXXToken.balanceOf(voter2.address);
        let voter3BalanceBefore = await XXXToken.balanceOf(voter3.address);

        // минтим токены
        let tx = await XXXToken.mint(voter1.address, amountMintToken);
        await tx.wait();
        tx = await XXXToken.mint(voter2.address, amountMintToken);
        await tx.wait();
        tx = await XXXToken.mint(voter3.address, amountMintToken);
        await tx.wait();

        // проверяем баланс после эмиссии
        let voter1BalanceAfter = await XXXToken.balanceOf(voter1.address);
        let voter2BalanceAfter = await XXXToken.balanceOf(voter2.address);
        let voter3BalanceAfter = await XXXToken.balanceOf(voter3.address);

        // проверяем, что всё сработало правильно
        expect(voter1BalanceAfter).equal(voter1BalanceBefore.add(amountMintToken));
        expect(voter2BalanceAfter).equal(voter2BalanceBefore.add(amountMintToken));
        expect(voter3BalanceAfter).equal(voter3BalanceBefore.add(amountMintToken));
    })

    // апруваем токены пользователей voter1, voter2 и voter3 для контракта router
    it("check approve() XXXToken to router", async function () {
    
        let amountApproveToken = BigNumber.from("1000000000000000000");

        // апруваем токены для router
        let tx  = await XXXToken.connect(voter1).approve(router.address, amountApproveToken);
        await tx.wait();
        tx  = await XXXToken.connect(voter2).approve(router.address, amountApproveToken);
        await tx.wait();
        tx  = await XXXToken.connect(voter3).approve(router.address, amountApproveToken);
        await tx.wait();

        // проверяем, что всё прошло успешно
        expect(await XXXToken.allowance(voter1.address, router.address)).equal(amountApproveToken);
        expect(await XXXToken.allowance(voter2.address, router.address)).equal(amountApproveToken);
        expect(await XXXToken.allowance(voter3.address, router.address)).equal(amountApproveToken);
    });

    // добавляем ликвидность
    it("check addLiquidity() router", async function () {
    
        let amountLiquidityToken = BigNumber.from("1000000000000000000");
        let amountLiquidityEth = BigNumber.from("1000000000000");

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        let deadline = block.timestamp + 100;

        let tx = await router.connect(voter1).addLiquidityETH(
            XXXToken.address, amountLiquidityToken, amountLiquidityToken, 
            amountLiquidityEth,
            voter1.address, deadline, {value: amountLiquidityEth}
        );
        await tx.wait()
        tx = await router.connect(voter2).addLiquidityETH(
            XXXToken.address, amountLiquidityToken, amountLiquidityToken, 
            amountLiquidityEth,
            voter2.address, deadline, {value: amountLiquidityEth}
        );
        await tx.wait()
        tx = await router.connect(voter3).addLiquidityETH(
            XXXToken.address, amountLiquidityToken, amountLiquidityToken, 
            amountLiquidityEth,
            voter3.address, deadline, {value: amountLiquidityEth}
        );
        await tx.wait()

        const tokenLPAddress = await factory.getPair(XXXToken.address, await router.WETH());
        // console.log(`tokenLPAddress.address : ${tokenLPAddress}`)
        tokenLP = (await ethers.getContractAt("IUniswapV2Pair",  tokenLPAddress));

        /*
        console.log(`XXXToken.address : ${XXXToken.address}`)
        console.log(`WETH address : ${await router.WETH()}`)
        console.log(`tokenLP.token0() : ${await tokenLP.token0()}`)
        console.log(`tokenLP.token1() : ${await tokenLP.token1()}`)
        console.log(`tokenLP voter1 : ${await tokenLP.balanceOf(voter1.address)}`)
        console.log(`tokenLP voter2 : ${await tokenLP.balanceOf(voter2.address)}`)
        console.log(`tokenLP voter3 : ${await tokenLP.balanceOf(voter3.address)}`)
        */
        let token0 = await tokenLP.token0();
        if (token0 == XXXToken.address){
            expect(token0).equal(XXXToken.address);
            expect(await tokenLP.token1()).equal(await router.WETH());
            
        } else {
            expect(token0).equal(await router.WETH());
            expect(await tokenLP.token1()).equal(XXXToken.address);
        }
        //expect(await tokenLP.token1()).equal(XXXToken.address);
        //expect(await tokenLP.token0()).equal(await router.WETH());
    })

    it("check deploy() DAO", async function () {

        // деплоим DAO
        const DaoFactory = (await ethers.getContractFactory("DAO"));
        dao = await DaoFactory.deploy(tokenLP.address, voteTime);
    })

    it("check deploy() staking", async function () {

        // деплоим staking
        const stakingFactory = (await ethers.getContractFactory("Staking"));
        staking = await stakingFactory.deploy(tokenLP.address, XXXToken.address, dao.address, freezingTime, percents);
    })

    it("check setStake() DAO", async function () {

        // устанавливаем для DAO контракт стейкинга
        let tx = await dao.setStake(staking.address);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await dao.getStakeAddress()).equal(staking.address);

        // проверяем, что нельзя повторно изменить значение (теперь только голосованием)
        await expect(
            dao.setStake(hacker.address)
        ).to.be.revertedWith("You do not have access rights");
    })

    it("check deploy() ACDMPlatform", async function () {

        // деплоим ACDMPlatform
        const ACDMPlatformFactory = (await ethers.getContractFactory("ACDMPlatform"));
        ACDMPlatform = await ACDMPlatformFactory.deploy(ACDMToken.address, dao.address, roundTime);
    })

    // выдаём контракту staking право минтить и сжигать XXXToken 
    it("check grantRole() XXXToken to staking", async function () {

        let administrator = await XXXToken.administrator();
        const tx = await XXXToken.grantRole(administrator, staking.address);
        await tx.wait();

        expect(await XXXToken.hasRole(administrator, staking.address)).equal(true);
    })

    // апруваем tokenLP для voter1, voter2 и voter3
    it("check approve() tokenLP to staking", async function () {

        let tokenLPAmountVoter1 = await tokenLP.balanceOf(voter1.address);
        let tokenLPAmountVoter2 = await tokenLP.balanceOf(voter2.address);
        let tokenLPAmountVoter3 = await tokenLP.balanceOf(voter3.address);

        // апруваем
        let tx = await tokenLP.connect(voter1).approve(staking.address, tokenLPAmountVoter1);
        await tx.wait();
        tx = await tokenLP.connect(voter2).approve(staking.address, tokenLPAmountVoter2);
        await tx.wait();
        tx = await tokenLP.connect(voter3).approve(staking.address, tokenLPAmountVoter3);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await tokenLP.allowance(voter1.address, staking.address)).equal(tokenLPAmountVoter1);
        expect(await tokenLP.allowance(voter2.address, staking.address)).equal(tokenLPAmountVoter2);
        expect(await tokenLP.allowance(voter3.address, staking.address)).equal(tokenLPAmountVoter3);
    })

    // стейкаем tokenLP для voter1, voter2 и voter3
    it("check stake() tokenLP to staking", async function (){
        
        let tokenLPAmountVoter1 = await tokenLP.balanceOf(voter1.address);
        let tokenLPAmountVoter2 = await tokenLP.balanceOf(voter2.address);
        let tokenLPAmountVoter3 = await tokenLP.balanceOf(voter3.address);

        // стейкаем
        let tx = await staking.connect(voter1).stake(tokenLPAmountVoter1);
        await tx.wait();
        // сохраняем время, когда были застейканы токены
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        stakeTime = block.timestamp;
        tx = await staking.connect(voter2).stake(tokenLPAmountVoter2);
        await tx.wait();
        tx = await staking.connect(voter3).stake(tokenLPAmountVoter3);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await tokenLP.balanceOf(voter1.address)).equal(0);
        expect((await staking.stakes(voter1.address)).tokenAmount).equal(tokenLPAmountVoter1);
        expect(await tokenLP.balanceOf(voter2.address)).equal(0);
        expect((await staking.stakes(voter2.address)).tokenAmount).equal(tokenLPAmountVoter2);
        expect(await tokenLP.balanceOf(voter3.address)).equal(0);
        expect((await staking.stakes(voter3.address)).tokenAmount).equal(tokenLPAmountVoter3);

        // проверяем, что нельзя вывести stake до истечения времени заморозки
        await expect(
            staking.connect(voter1).unstake()
        ).to.be.revertedWith("freezing time has not yet passed");

        // прогоняем семь дней, чтобы потом было удобнее проверять голосования
        /*
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const endTime = block.timestamp + 604_800;
        await ethers.provider.send('evm_increaseTime', [endTime]);
        */
    })

    it("check claim() staking", async function () {

        // проверяем, что нельзя вывести награду до истечения времени заморозки
        await expect(
            staking.connect(voter1).claim()
        ).to.be.revertedWith("freezing time has not yet passed");

        // сохраняем баланс XXXToken до вывода награды
        let balanceBefore = await XXXToken.balanceOf(voter1.address);
        
        // количество "циклов" выплат - можно подставлять сюда разные значения, в том числе дробные
        // и тест не должен при этом падать
        const cycleCount = 3.5;

        // рассчитываем предположительный размер награды
        // получаем номер последнего блока
        const blockNumber = await ethers.provider.getBlockNumber();
        // получаем блок по номеру
        const block = await ethers.provider.getBlock(blockNumber);
        // рассчитываем сколько должно пройти времени, чтобы прошло cycleCount циклов
        const time = block.timestamp + cycleCount * freezingTime - stakeTime;
        // рассчитваем сколько прошло польных циклов - то есть сколько раз должна была бы начисленна награда
        const rewardCount = (time - time % freezingTime) / freezingTime;
        // вытаскиваем стейк пользовтеля voter1
        const stake = await staking.stakes(voter1.address);
        // сохраняем значение уже выплаченных с этого стейка наград
        const rewardPaid = (stake.rewardPaid).toNumber();
        // вытаскиваем количество застейканных токенов
        let stakeAmount = (stake.tokenAmount).toNumber();
        const reward = (stakeAmount - stakeAmount % 100) / 100 * percents * rewardCount - rewardPaid;

        // переводим время  вперёд
        await ethers.provider.send('evm_increaseTime', [cycleCount * freezingTime]);

        // выводим награду
        const tx = await staking.connect(voter1).claim();
        await tx.wait();
        
        // сохраняем баланс XXXToken после вывода награды
        let balanceAfter = await XXXToken.balanceOf(voter1.address);

        // проверяем результат
        //console.log(`balanceBefore: ${balanceBefore}`);
        //console.log(`reward: ${reward}`);
        //console.log(`balanceAfter: ${balanceAfter}`);
        expect(balanceAfter).equal(balanceBefore.add(reward));

        // пробуем вывести награду ещё раз
        await expect(
            staking.connect(voter1).claim()
        ).to.be.revertedWith("You have no reward available for withdrawal");
    })

    // сделать голосование 1
    // будем проводить голосования по изменению значений 
    // saleReward1, saleReward2 и setTradeReward в констркте ACDMPlatform
    // и значение freezingTime в контракте staking
    // сделать голосование 1, 2
    // проголосовать, чтобы был кворум, более 50% токенов
    // завершить голосование, проверить результат
    // чтобы была победа YES
    // сделать голосование 3
    // проголосовать, чтобы был кворум, более 50% токенов
    // заершить голосование, проверить результат
    // чтобы была победа NO
    // сделать голосование 4
    // проголосовать, чтобы не было кворума, проверить результат

    // сделать голосования
    it("check addProposal() dao", async function(){
        
        // голосование 1 за изменение значения saleReward1
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        let saleReward1 = 60;
        let jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_saleReward1",
                    "type": "uint8"
                }
            ],
                "name": "setSaleReward1",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
        }];

        let jsonText =  `[{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_saleReward1",
                    "type": "uint8"
                }
            ],
                "name": "setSaleReward1",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
        }];`
        let iface = new ethers.utils.Interface(jsonAbi);
        let recipient = ACDMPlatform.address;
        let description = `change saleReward1 to ${saleReward1}`;
        let abiArguments = `${jsonText},[${saleReward1}]`;
        let calldata = iface.encodeFunctionData('setSaleReward1', [saleReward1]);
        let tx = await dao.addProposal(description, abiArguments, calldata, ACDMPlatform.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        let proposal = await dao.getProposalByID(1);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(ACDMPlatform.address);

        // голосование 2 за изменение значения saleReward2
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        let saleReward2 = 40;
        jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_saleReward2",
                    "type": "uint8"
                }
            ],
                "name": "setSaleReward2",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
        }];

        jsonText =  `[{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_saleReward2",
                    "type": "uint8"
                }
            ],
                "name": "setSaleReward2",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
        }];`
        iface = new ethers.utils.Interface(jsonAbi);
        recipient = ACDMPlatform.address;
        description = `change saleReward2 to ${saleReward2}`;
        abiArguments = `${jsonText},[${saleReward2}]`;
        calldata = iface.encodeFunctionData('setSaleReward2', [saleReward2]);
        tx = await dao.addProposal(description, abiArguments, calldata, ACDMPlatform.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        proposal = await dao.getProposalByID(2);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(ACDMPlatform.address);


        // голосование 3 за изменение значения tradeReward
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие за
        let tradeReward = 30;
        jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_tradeReward",
                    "type": "uint8"
                }
            ],
            "name": "setTradeReward",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];

        jsonText =  `[{
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_tradeReward",
                    "type": "uint8"
                }
            ],
            "name": "setTradeReward",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];`
        iface = new ethers.utils.Interface(jsonAbi);
        recipient = ACDMPlatform.address;
        description = `change tradeReward to ${tradeReward}`;
        abiArguments = `${jsonText},[${tradeReward}]`;
        calldata = iface.encodeFunctionData('setTradeReward', [tradeReward]);
        tx = await dao.addProposal(description, abiArguments, calldata, ACDMPlatform.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        proposal = await dao.getProposalByID(3);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(ACDMPlatform.address);

        // голосование 4 за изменение значения tradeReward
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ПРОТИВ
        tradeReward = 40;

        iface = new ethers.utils.Interface(jsonAbi);
        recipient = ACDMPlatform.address;
        description = `change tradeReward to ${tradeReward}`;
        abiArguments = `${jsonText},[${tradeReward}]`;
        calldata = iface.encodeFunctionData('setTradeReward', [tradeReward]);
        tx = await dao.addProposal(description, abiArguments, calldata, ACDMPlatform.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        proposal = await dao.getProposalByID(4);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(ACDMPlatform.address);

        // голосование 5 за изменение значения freezingTime
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие за
        let freezingTime = 259_200;
        jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_freezingTime",
                    "type": "uint256"
                }
            ],
            "name": "setFreezingTime",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];

        jsonText =  `[{
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_freezingTime",
                    "type": "uint256"
                }
            ],
            "name": "setFreezingTime",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];`
        iface = new ethers.utils.Interface(jsonAbi);
        recipient = staking.address;
        description = `change freezingTime to ${freezingTime}`;
        abiArguments = `${jsonText},[${freezingTime}]`;
        calldata = iface.encodeFunctionData('setFreezingTime', [freezingTime]);
        tx = await dao.addProposal(description, abiArguments, calldata, staking.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        proposal = await dao.getProposalByID(5);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(staking.address);

        // голосование 6 за изменение значения freezingTime
        // это голосование не наберёт кворум
        freezingTime = 100_000;

        iface = new ethers.utils.Interface(jsonAbi);
        recipient = staking.address;
        description = `change freezingTime to ${freezingTime}`;
        abiArguments = `${jsonText},[${freezingTime}]`;
        calldata = iface.encodeFunctionData('setFreezingTime', [freezingTime]);
        tx = await dao.addProposal(description, abiArguments, calldata, staking.address);
        await tx.wait();

        // проверяем, что голосование добавилось правильно
        proposal = await dao.getProposalByID(6);
        expect(proposal.pDescription).equal(description);
        expect(proposal.pAbiArguments).equal(abiArguments);
        expect(proposal.pCallData).equal(calldata);
        expect(proposal.pCallAddres).equal(staking.address);

        // проверяем, что только chairman может добавлять голосования
        await expect(
            dao.connect(hacker).addProposal(description, abiArguments, calldata, staking.address)
        ).to.be.revertedWith("You do not have permission to add proposal");
    })

    // Голосуем
    it("check vote() dao", async function(){
        
        // голосование 1
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        let tx = await dao.connect(voter1).vote(1, true);
        await tx.wait();
        tx = await dao.connect(voter2).vote(1, true);
        await tx.wait();
        tx = await dao.connect(voter3).vote(1, false);
        await tx.wait();

        // голосование 2
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        tx = await dao.connect(voter1).vote(2, true);
        await tx.wait();
        tx = await dao.connect(voter2).vote(2, false);
        await tx.wait();
        tx = await dao.connect(voter3).vote(2, true);
        await tx.wait();

        // голосование 3
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        tx = await dao.connect(voter1).vote(3, false);
        await tx.wait();
        tx = await dao.connect(voter2).vote(3, true);
        await tx.wait();
        tx = await dao.connect(voter3).vote(3, true);
        await tx.wait();

        // голосование 4
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ПРОТИВ
        tx = await dao.connect(voter1).vote(4, false);
        await tx.wait();
        tx = await dao.connect(voter2).vote(4, false);
        await tx.wait();
        tx = await dao.connect(voter3).vote(4, true);
        await tx.wait();

        // голосование 5
        // это голосование наберёт кворум - более 50% токенов
        // в этом голосовании победят голосовавшие ЗА
        tx = await dao.connect(voter1).vote(5, true);
        await tx.wait();
        tx = await dao.connect(voter2).vote(5, false);
        await tx.wait();
        tx = await dao.connect(voter3).vote(5, true);
        await tx.wait();

        // голосование 6
        // это голосование не наберёт кворум - более 50% токенов
        tx = await dao.connect(voter1).vote(6, true);
        await tx.wait();

        // проверяем, что 
        // нельзя проголосовать, если не внесён депозит
        await expect(
            dao.connect(hacker).vote(3, true)
        ).to.be.revertedWith("You did not make a deposit");
        // нельзя проголосовать дважды с одно аккаунта в одном голосовании
        await expect(
            dao.connect(voter1).vote(1, true)
        ).to.be.revertedWith("You already voted");
    })

    // Завершаем голосования
    it("check finishProposal()", async function(){
        
        // значения за изменения которых голосовали
        let saleReward1 = 60;
        let saleReward2 = 40;
        let tradeReward = 30;
        let freezingTime = 259_200;

        // проверяем, что 
        // нельзя завершить голосование, пока не прошло три дня
        await expect(
            dao.connect(hacker).finishProposal(1)
        ).to.be.revertedWith("Voting time is not over yet");
        // нельзя вывести токены, задействованные в голосовании
        await expect(
            staking.connect(voter1).unstake()
        ).to.be.revertedWith("Tokens are still frozen in the DAO contract"); 

        // прогоняем три дня
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const endTime = block.timestamp + 259_200;
        await ethers.provider.send('evm_increaseTime', [endTime]);


        // завершаем голосования 1
        // проверяем, что они завершены
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум набран, победили голосовавшие ЗА
        // кроме того проверям, что значение saleReward1 изменилось
        
        let tx = await dao.finishProposal(1);
        let receipt = await tx.wait();
        // вытаскиваем евенты и проверяем, результаты голосования
        let proposal = await dao.getProposalByID(1)
        let events = receipt.events ?? []
        let event = events[0].args ?? ""
        let description = event[0]
        let quorum = event[1]
        let result = event[2]
        let success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(true);
        // по результату голосов победили ЗА
        expect(result).equal(true);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(true);
        // значение saleReward1 на ACDMPlatform успешно изменено
        expect(await ACDMPlatform.saleReward1()).equal(saleReward1);


        // завершаем голосования 2
        // проверяем, что они завершены
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум набран, победили голосовавшие ЗА
        // кроме того проверям, что значение saleReward2 изменилось
        
        tx = await dao.finishProposal(2);
        receipt = await tx.wait();
        // вытаскиваем евенты и проверяем, результаты голосования
        proposal = await dao.getProposalByID(2)
        events = receipt.events ?? []
        event = events[0].args ?? ""
        description = event[0]
        quorum = event[1]
        result = event[2]
        success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(true);
        // по результату голосов победили ЗА
        expect(result).equal(true);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(true);
        // значение saleReward1 на ACDMPlatform успешно изменено
        expect(await ACDMPlatform.saleReward2()).equal(saleReward2);


        // завершаем голосования 3
        // проверяем, что они завершены
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум набран, победили голосовавшие ЗА
        // кроме того проверям, что значение tradeReward изменилось
        
        tx = await dao.finishProposal(3);
        receipt = await tx.wait();

        // вытаскиваем евенты и проверяем, результаты голосования
        proposal = await dao.getProposalByID(3)
        events = receipt.events ?? []
        event = events[0].args ?? ""
        description = event[0]
        quorum = event[1]
        result = event[2]
        success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(true);
        // по результату голосов победили ЗА
        expect(result).equal(true);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(true);
        // значение saleReward1 на ACDMPlatform успешно изменено
        expect(await ACDMPlatform.tradeReward()).equal(tradeReward);


        // завершаем голосования 4
        // и проверяем, что оно завершено
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум набран, победили голосовавшие ПРОТИВ
        // кроме того проверям, что значение tradeReward НЕ изменилось
        
        tx = await dao.finishProposal(4);
        receipt = await tx.wait();

        // вытаскиваем евенты и проверяем, результаты голосования
        proposal = await dao.getProposalByID(4)
        events = receipt.events ?? []
        event = events[0].args ?? ""
        description = event[0]
        quorum = event[1]
        result = event[2]
        success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(true);
        // по результату голосов победили ПРОТИВ
        expect(result).equal(false);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(false);
        // проверяем, что значение tradeReward не изменилось
        expect(await ACDMPlatform.tradeReward()).equal(tradeReward);


        // завершаем голосования 5
        // проверяем, что они завершены
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум набран, победили голосовавшие ЗА
        // кроме того проверям, что значение freezingTime изменилось
        
        tx = await dao.finishProposal(5);
        receipt = await tx.wait();

        // вытаскиваем евенты и проверяем, результаты голосования
        proposal = await dao.getProposalByID(5)
        events = receipt.events ?? []
        event = events[0].args ?? ""
        description = event[0]
        quorum = event[1]
        result = event[2]
        success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(true);
        // по результату голосов победили ЗА
        expect(result).equal(true);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(true);
        // значение saleReward1 на ACDMPlatform успешно изменено
        expect(await staking.freezingTime()).equal(freezingTime);

        // завершаем голосования 6
        // и проверяем, что оно завершено
        // также ловим евенты и смотрим как завершились голосования, результат должен быть:
        // кворум НЕ набран
        // кроме того проверям, что значение freezingTime НЕ изменилось
        
        tx = await dao.finishProposal(6);
        receipt = await tx.wait();

        // вытаскиваем евенты и проверяем, результаты голосования
        proposal = await dao.getProposalByID(6)
        events = receipt.events ?? []
        event = events[0].args ?? ""
        description = event[0]
        quorum = event[1]
        result = event[2]
        success = event[3]

        // проверка, что    
        // статус голосования изменился
        expect(await proposal.pStatusEnd).equal(true);
        // описание из евента совпадает с описанием голосования
        expect(await proposal.pDescription).equal(description);
        // набрался кворум
        expect(quorum).equal(false);
        // по результату голосов победили ПРОТИВ
        expect(result).equal(false);
        // функция за которую голосовали, выполнена успешно
        expect(success).equal(false);
        // проверяем, что значение freezingTime не изменилось
        expect(await staking.freezingTime()).equal(freezingTime);


        // проверка, что теперь можно вывести средства
        let balanceBefore = await tokenLP.balanceOf(voter1.address);
        let stakeBefore = (await staking.getStakes(voter1.address)).tokenAmount;

        tx = await staking.connect(voter1).unstake();
        await tx.wait();

        let balanceAfter = await tokenLP.balanceOf(voter1.address);
        let stakeAfter = (await staking.getStakes(voter1.address)).tokenAmount;

        // проверка, что стейк выведен
        expect(balanceAfter).equal(balanceBefore.add(stakeBefore));
        expect(stakeAfter).equal(0);

        // проверяем, что 
        // нельзя вывести награду за стейк, если нет стейка
        await expect(
            staking.connect(voter1).claim()
        ).to.be.revertedWith("You don't have a stake");
        // нельзя проверить проголосовать, когда стейк выведен
        await expect(
            dao.connect(voter1).vote(3, false)
        ).to.be.revertedWith("You did not make a deposit");
        // нельзя завершить голосование, котрое уже завершено
        await expect(
            dao.connect(hacker).finishProposal(1)
        ).to.be.revertedWith("Voting is now over");
        // нельзя проголосовать в завершённом голосовании
        await expect(
            dao.connect(voter2).vote(6, false)
        ).to.be.revertedWith("Voting time is over");
    })

    // получение списка голосований
    it("check getAllProposal() getProposalByID()", async function(){
        
        let allProposal = await dao.getAllProposal();

        // проверка, что нельзя получить голосование по несуществующему индексу
        await expect(
            dao.getProposalByID(7)
        ).to.be.revertedWith("There is no vote with this id");
    })

    // получение списка голосований
    it("check setFreezingTime() staking", async function(){
        
        // проверка, что нельзя вызвать эту функцию, если ты не контракт DAO
        await expect(
            staking.connect(hacker).setFreezingTime(1)
        ).to.be.revertedWith("You are not DAO");
        // даже если ты owner контракта
        await expect(
            staking.setFreezingTime(1)
        ).to.be.revertedWith("You are not DAO");
    })
});
