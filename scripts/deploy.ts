import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC20, Staking, IUniswapV2Router02, IUniswapV2Factory, IUniswapV2Pair, ACDMPlatform, DAO} from "../typechain"

async function main() {

    // истансы контрактов
    let ACDMToken : MyERC20;
    let XXXToken : MyERC20;
    let ACDMPlatform : ACDMPlatform;
    let staking : Staking;
    let dao : DAO;
    
    let tokenLP : IUniswapV2Pair;
    let router : IUniswapV2Router02;
    let factory : IUniswapV2Factory;

    let owner : SignerWithAddress;

    // аргументы для конструкторов контрактов
    const ercNameACDM = "ACDMToken";
    const ercSymbolACDM = "ACDM";
    const decimalsACDM = 6;
    const ercNameXXX = "XXXToken";
    const ercSymbolXXX = "XXX";
    const decimalsXXX = 18;
    // время голосования для DAO - по умолчанию 3 дня
    const voteTime = 259_200;
    // время заморозки для Staking - по умолчанию 7 дней
    const freezingTime = 604_800;
    // проценты для Staking - по умолчанию - 10%
    const percents = 3;
    // продолжительность раунда для ACDMPlatform
    const roundTime = 259_200;

    [owner] = await ethers.getSigners();

    const ERC20Factory = (await ethers.getContractFactory("MyERC20"));

    // деплоим ACDMToken и XXXToken
    console.log("Deploying tokens...")

    const tokenFactory = (await ethers.getContractFactory("MyERC20"));
    ACDMToken = await tokenFactory.deploy(ercNameACDM, ercSymbolACDM, decimalsACDM);
    console.log(`ACDMToken deploying to address ${ACDMToken.address}`);

    XXXToken = await tokenFactory.deploy(ercNameXXX, ercSymbolXXX, decimalsXXX);
    console.log(`XXXToken deploying to address ${XXXToken.address}`);

    // получаем инстансы роутера и фактори UniSwap
    console.log("Connecting to uniswap...")

    router = (await ethers.getContractAt("IUniswapV2Router02",  process.env.ROUTER_ADDRESS as string));
    factory = (await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));
    console.log("Successfully")

    // минтим токены
    console.log("Minting XXXtoken...")

    let amountXXXToken = BigNumber.from("1000000000000000000");
    let tx = await XXXToken.mint(owner.address, amountXXXToken);
    await tx.wait();
    let XXXTokenBalance = await XXXToken.balanceOf(owner.address);
    console.log("Tokens successfully minted")
    console.log(`Balance address ${owner.address} are ${XXXTokenBalance} XXXToken`);

    // апруваем токены для router
    console.log("Approving XXXtoken to Router...")

    tx = await XXXToken.approve(router.address, amountXXXToken);
    await tx.wait();
    let approveXXXToken = await XXXToken.allowance(owner.address, router.address);
    console.log(`Successfully approve ${approveXXXToken} XXXToken from ${owner.address} to ${router.address}`)

    // добавляем ликвидность
    console.log("Add liquidity XXXtoken/ETH...")
    let amountLiquidityToken = BigNumber.from("1000000000000000000");
    let amountLiquidityEth = BigNumber.from("1000000000000");

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    let deadline = block.timestamp + 100;

    tx = await router.addLiquidityETH(
        XXXToken.address, amountLiquidityToken, amountLiquidityToken, 
        amountLiquidityEth,
        owner.address, deadline, {value: amountLiquidityEth}
    );
    await tx.wait();

    let WETH = await router.WETH()
    let tokenLPAddress = await factory.getPair(XXXToken.address, WETH);
    // console.log(`tokenLPAddress.address : ${tokenLPAddress}`)
    tokenLP = (await ethers.getContractAt("IUniswapV2Pair",  tokenLPAddress));
    console.log(`Successfully. LPtoken address ${tokenLPAddress}`)

    // деплоим DAO
    console.log("Deploying DAO contract...")

    const DaoFactory = (await ethers.getContractFactory("DAO"));
    dao = await DaoFactory.deploy(tokenLP.address, voteTime);
    console.log(`DAO deploying to address ${dao.address}`);

    // деплоим staking
    console.log("Deploying STAKING contract...")

    const stakingFactory = (await ethers.getContractFactory("Staking"));
    staking = await stakingFactory.deploy(tokenLP.address, XXXToken.address, dao.address, freezingTime, percents);
    console.log(`Staking deploying to address ${staking.address}`);

    // выдаём контракту staking право минтить и сжигать XXXToken 
    console.log("Seting role ADMINISTRATOR to STAKING contract...")

    let administrator = await XXXToken.administrator();
    tx = await XXXToken.grantRole(administrator, staking.address);
    await tx.wait();
    expect(await XXXToken.hasRole(administrator, staking.address)).equal(true);
    console.log("Successfully")

    // устанавливаем для DAO контракт стейкинга
    console.log("Seting to DAO STAKING contract...")

    tx = await dao.setStake(staking.address);
    await tx.wait();
    expect(await dao.getStakeAddress()).equal(staking.address);
    console.log("Successfully")

    // деплоим ACDMPlatform
    console.log("Deploying ACDMPlatform contract...")

    const ACDMPlatformFactory = (await ethers.getContractFactory("ACDMPlatform"));
    ACDMPlatform = await ACDMPlatformFactory.deploy(ACDMToken.address, dao.address, roundTime);

    console.log(`ACDMPlatform deploying to address ${ACDMPlatform.address}`);

    console.log("The system is completely ready and set up!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
/*
ACDMToken deploying to address 0xCC826A61C12cc9AfB5Dc65737706e06f738A3364
XXXToken deploying to address 0x389C34cC8f9B4ECE72f96ecA692969AC2402640d
Connecting to uniswap...
Successfully
Minting XXXtoken...
Tokens successfully minted
Balance address 0x7B55f2b7708EaF2ac2165f6b5F86d41f674002b7 are 1000000000000000000 XXXToken
Approving XXXtoken to Router...
Successfully approve 1000000000000000000 XXXToken from 0x7B55f2b7708EaF2ac2165f6b5F86d41f674002b7 to 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
Add liquidity XXXtoken/ETH...
Successfully. LPtoken address 0x2b72F46Ac1FBb43070725973317fc73Bdfa889AF
Deploying DAO contract...
DAO deploying to address 0x15146cA04Bc996b890C3050300097b31E204b64C
Deploying STAKING contract...
Staking deploying to address 0x2097e07836032BcC825c14ABc902dAb116b172D2
Seting role ADMINISTRATOR to STAKING contract...
Successfully
Seting to DAO STAKING contract...
Successfully
Deploying ACDMPlatform contract...
ACDMPlatform deploying to address 0x7cF99AEf0c7F283bdD1b44694D4410f93b993bF4
The system is completely ready and set up!
*/

