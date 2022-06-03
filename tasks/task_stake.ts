import '@nomiclabs/hardhat-ethers'
import { task } from "hardhat/config";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// функция стейка
task("stake", "Staking LPToken")
    .addParam("amount")
    .setAction(async (args, hre) => {

        const owner = (await hre.ethers.getSigners())[0].address;

        const staking = (await hre.ethers.getContractAt("Staking",  "0x544bAbCfB588C2cE1D35C6572DA153d91Af851d3"));
        const tokenLP = (await hre.ethers.getContractAt("IUniswapV2Pair", "0x2b72F46Ac1FBb43070725973317fc73Bdfa889AF"));

        let tx = await tokenLP.approve("0x2b72F46Ac1FBb43070725973317fc73Bdfa889AF", args.amount);
        await tx.wait();

        tx = await staking.stake(args.amount);
        await tx.wait();

        const stake = await staking.stakes(owner);

        console.log("You have successfully deposited a stake")
        console.log(`Stake amount: ${stake.tokenAmount} Stake time: ${stake.timeStamp}`)
});

// функция вывода награды
task("claim", "Claim reward")
    .setAction(async (args, hre) => {

        const owner = (await hre.ethers.getSigners())[0].address;

        const staking = (await hre.ethers.getContractAt("Staking", "0x544bAbCfB588C2cE1D35C6572DA153d91Af851d3"));
        const rewardToken = (await hre.ethers.getContractAt("ERC20", "0x389C34cC8f9B4ECE72f96ecA692969AC2402640d"));

        const balanceBefore = await rewardToken.balanceOf(owner);

        const tx = await staking.claim();
        await tx.wait();
        
        const balanceAfter = await rewardToken.balanceOf(owner);

        console.log(`You have successfully withdrawn an award of ${balanceAfter.sub(balanceBefore)}`)
        console.log(`Your reward token balance is ${balanceAfter}`)
});

// функция вывода стейка
task("unstake", "Stake withdraw")
    .setAction(async (args, hre) => {

        const owner = (await hre.ethers.getSigners())[0].address;

        const staking = (await hre.ethers.getContractAt("Staking", "0x544bAbCfB588C2cE1D35C6572DA153d91Af851d3"));
        const tokenLP = (await hre.ethers.getContractAt("IUniswapV2Pair", "0x2b72F46Ac1FBb43070725973317fc73Bdfa889AF"));

        const stake = await staking.stakes(owner);
        
        const tx = await staking.unstake();
        await tx.wait();

        const tokenLPBalance = await tokenLP.balanceOf(owner);

        console.log(`You have successfully withdrawn your stake of ${stake.tokenAmount}`)
        console.log(`Your balance is now ${tokenLPBalance}`)
});
