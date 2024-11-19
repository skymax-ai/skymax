import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Template', () => {
    let minterCode: Cell;
    let walletCode: Cell;

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');
    });

    //example jetton content params
    const jettonParams = {
        name: 'MyJetton',
        symbol: 'JET1',
        image: 'https://www.linkpicture.com/q/download_183.png', // Image url
        description: 'My jetton',
    };

    const firstMint = 100n;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    jettonWalletCode: walletCode,
                    adminAddress: deployer.address,
                    content: jettonParams,
                },
                minterCode,
            ),
        );

        await jettonMinter.sendDeploy(deployer.getSender(), toNano(100));

        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: firstMint,
            queryId: 42,
            toAddress: deployer.address,
            amount: toNano(1),
            value: toNano(2),
        });

        jettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(deployer.address)),
        );
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and template are ready to use
    });

    it('should get minter initialization data correctly', async () => {
        const result = await jettonMinter.getMinterData();

        expect(result.totalSuply).toEqual(firstMint);
        expect(result.adminAddress).toEqualAddress(deployer.address);
        expect(result.content.name).toEqual(jettonParams.name);
        expect(result.content.symbol).toEqual(jettonParams.symbol);
        expect(result.content.description).toEqual(jettonParams.description);
        expect(result.content.image).toEqual(jettonParams.image);
    });

    it('offchain and onchain jwallet should return the same address', async () => {
        const onChain = await jettonMinter.getWalletAddress(deployer.address);
        const offChain = jettonWallet.address;
        expect(onChain.toString()).toEqual(offChain.toString());
    });

    it('should get jwallet initialization data correctly', async () => {
        let data = await jettonWallet.getWalletData();

        expect(data.balance).toEqual(firstMint);
        expect(data.ownerAddress.toString()).toEqual(deployer.address.toString());
        expect(data.masterAddress.toString()).toEqual(jettonMinter.address.toString());
    });

    it('should mint jettons and transfer to 2 new wallets', async () => {
        // Produce mint message
        const participant_1: SandboxContract<TreasuryContract> = await blockchain.treasury('participant_1');
        const participant_2: SandboxContract<TreasuryContract> = await blockchain.treasury('participant_2');

        let totalSuplyOffChain = (await jettonMinter.getMinterData()).totalSuply;

        const participantJettonWallet_1 = blockchain.openContract(
            JettonWallet.createFromConfig(
                {
                    minterAddress: jettonMinter.address,
                    ownerAddress: participant_1.address,
                    walletCode: walletCode,
                },
                walletCode,
            ),
        );

        const participantJettonWallet_2 = blockchain.openContract(
            JettonWallet.createFromConfig(
                {
                    minterAddress: jettonMinter.address,
                    ownerAddress: participant_2.address,
                    walletCode: walletCode,
                },
                walletCode,
            ),
        );

        await participantJettonWallet_1.sendDeploy(participant_1.getSender(), toNano(2));
        await participantJettonWallet_2.sendDeploy(participant_2.getSender(), toNano(2));

        expect((await participantJettonWallet_1.getWalletData()).balance).toEqual(BigInt(0));
        expect((await participantJettonWallet_2.getWalletData()).balance).toEqual(BigInt(0));

        let participant1_mintAmount = 100n;
        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: participant1_mintAmount,
            queryId: 42,
            toAddress: participant_1.address,
            amount: toNano(1),
            value: toNano(2),
        });

        totalSuplyOffChain += participant1_mintAmount;
        expect((await participantJettonWallet_1.getWalletData()).balance).toEqual(participant1_mintAmount);
        expect((await jettonMinter.getMinterData()).totalSuply).toEqual(totalSuplyOffChain);

        let participant2_mintAmount = 100n;
        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: participant2_mintAmount,
            queryId: 42,
            toAddress: participant_2.address,
            amount: toNano(1),
            value: toNano(2),
        });

        totalSuplyOffChain += participant2_mintAmount;
        expect((await participantJettonWallet_2.getWalletData()).balance).toEqual(participant2_mintAmount);
        expect((await jettonMinter.getMinterData()).totalSuply).toEqual(totalSuplyOffChain);
    });

    it('should mint jettons and transfer from wallet1 to wallet2', async () => {
        // Produce mint message

        const participant_1: SandboxContract<TreasuryContract> = await blockchain.treasury('participant_1');
        const participant_2: SandboxContract<TreasuryContract> = await blockchain.treasury('participant_2');

        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: firstMint,
            queryId: 42,
            toAddress: participant_1.address,
            amount: toNano(1),
            value: toNano(2),
        });

        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: firstMint,
            queryId: 42,
            toAddress: participant_2.address,
            amount: toNano(1),
            value: toNano(2),
        });

        const participantJettonWallet_1 = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(participant_1.address)),
        );

        const participantJettonWallet_2 = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(participant_2.address)),
        );

        let wallet1BalanceOffChain = (await participantJettonWallet_1.getWalletData()).balance;
        let wallet2BalanceOffChain = (await participantJettonWallet_2.getWalletData()).balance;
        let totalSuplyOffChain = (await jettonMinter.getMinterData()).totalSuply;

        const transferAmount = 50n;
        let result = await participantJettonWallet_1.sendTransfer(participant_1.getSender(), {
            jettonAmount: transferAmount,
            queryId: 42,
            toAddress: participant_2.address,
            fwdAmount: toNano(0.22),
            value: toNano(0.3),
        });

        console.log(result.transactions);

        wallet1BalanceOffChain -= transferAmount;
        wallet2BalanceOffChain += transferAmount;

        expect(wallet1BalanceOffChain).toEqual((await participantJettonWallet_1.getWalletData()).balance);
        expect(wallet2BalanceOffChain).toEqual((await participantJettonWallet_2.getWalletData()).balance);
        expect(totalSuplyOffChain).toEqual((await jettonMinter.getMinterData()).totalSuply);
    });

    /*
    Further tests:
    - burn
    - mint
    - transfer from wallet
    - change owner
    - change content / immutable vs nonimmutable
    */
});
