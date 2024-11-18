import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano} from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Template', () => {
    let minterCode: Cell;
    let walletCode: Cell;

    let blockchain: Blockchain
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>
    let jettonWallet: SandboxContract<JettonWallet>

    beforeAll(async () => {
        minterCode = await compile('JettonMinter')
        walletCode = await compile('JettonWallet')
    });

    //default jetton content params
    const jettonParams = {
        name: "MyJetton",
        symbol: "JET1",
        image: "https://www.linkpicture.com/q/download_183.png", // Image url
        description: "My jetton",
    };

    const firstMint = 100n;

    beforeEach(async () => {
        blockchain = await Blockchain.create()
        deployer= await blockchain.treasury('deployer')

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig({
                    jettonWalletCode: walletCode,
                    adminAddress: deployer.address,
                    content: jettonParams,
                },
                minterCode
            )
        )

        await jettonMinter.sendDeploy(deployer.getSender(), toNano(100))

        await jettonMinter.sendMint(deployer.getSender(), {
            jettonAmount: firstMint,
            queryId: 42,
            toAddress: deployer.address,
            amount: toNano(1),
            value: toNano(2),
        })

        jettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(deployer.address)
            )
        )
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and template are ready to use
    });

    it("should get minter initialization data correctly", async () => {

        const result = await jettonMinter.getMinterData();
    
        expect(result.totalSuply).toEqual(firstMint);
        expect(result.adminAddress).toEqualAddress(deployer.address);
        expect(result.content.name).toEqual(jettonParams.name);
        expect(result.content.symbol).toEqual(jettonParams.symbol);
        expect(result.content.description).toEqual(jettonParams.description);
        expect(result.content.image).toEqual(jettonParams.image);
    });
});
