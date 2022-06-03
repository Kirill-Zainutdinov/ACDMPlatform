import { DAO__factory } from "../typechain";
import { task } from "hardhat/config";
import '@nomiclabs/hardhat-ethers'

// daoAddress 0x15146cA04Bc996b890C3050300097b31E204b64C

// функция addProposal
task("addProposal", "add new proposal")
    .addParam("daoAddress")
    .addParam("description")
    .addParam("abiArguments")
    .addParam("calldata")
    .addParam("callAddres")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const DaoFactory = (await hre.ethers.getContractFactory("DAO")) as DAO__factory;
        const dao = await DaoFactory.attach(args.daoAddress);
        console.log(`Successfully connected to the contract DAO`);

        // создаём голосование
        let tx = await dao.addProposal(args.description, args.abiArguments, args.calldata, args.callAddres);
        let receipt = await tx.wait();

        // вытаскиваем event
        let proposals = await dao.getAllProposal();

        // вытаскиваем голосование
        let proposal = await dao.getProposalByID(proposals.length);

        // выводим инфу по голосованию
        console.log(`Add proposal with ID ${proposals.length}`);
        console.log(`Proposal end time ${proposal.pEndTime}`);
        console.log(`Proposal description ${proposal.pDescription}`);
        console.log(`Proposal abi and arguments ${proposal.pAbiArguments}`);
        console.log(`Proposal callData ${proposal.pCallData}`);
        console.log(`Proposal callAddres ${proposal.pCallAddres}`);
});

// функция Vote
task("Vote", "Vote to proposal")
    .addParam("daoAddress")
    .addParam("pId")
    .addParam("choice")
    .setAction(async (args, hre) => {
        // подключаемся к контракту DAO
        const DaoFactory = (await hre.ethers.getContractFactory("DAO")) as DAO__factory;
        const dao = await DaoFactory.attach(args.daoAddress);
        console.log(`Successfully connected to the contract DAO`);

        // голосуем
        let tx = await dao.vote(args.pId, args.choice);
        await tx.wait();
        console.log(`Your vote is accepted`);
});

// функция finishProposal
task("finishProposal", "finish proposal")
    .addParam("daoAddress")
    .addParam("pId")
    .setAction(async (args, hre) => {
        // подключаемся к контракту DAO
        const DaoFactory = (await hre.ethers.getContractFactory("DAO")) as DAO__factory;
        const dao = await DaoFactory.attach(args.daoAddress);
        console.log(`Successfully connected to the contract DAO`);

        // заканчиваем голосование
        let tx = await dao.finishProposal(args.pId);
        await tx.wait();

        console.log(`Voting successfully completed`)
});