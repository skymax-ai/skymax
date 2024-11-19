import { toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';

//example jetton content params
export const jettonParams = {
    name: "Shreck2",
    symbol: "SHR2",
    image: ".png", // Image url
    description: "Somebody once told me the world is gonna raw me",
};

export async function run(provider: NetworkProvider) { 
    const minterCode = await compile(`JettonMinter`);
    const walletCode = await compile(`JettonWallet`);
    const jettonMinter = provider.open(JettonMinter.createFromConfig({
            jettonWalletCode: walletCode,
            adminAddress: provider.sender().address!,
            content: jettonParams,
        },
        minterCode
    ))

    jettonMinter.sendDeploy(provider.sender(), toNano(0.05));

    await provider.waitForDeploy(jettonMinter.address);
    // run methods on `template`
}
