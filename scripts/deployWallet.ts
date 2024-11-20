import { toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { jettonParams } from './deployMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const minterCode = await compile(`JettonMinter`);
    const walletCode = await compile(`JettonWallet`);

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                jettonWalletCode: walletCode,
                adminAddress: provider.sender().address!,
                content: jettonParams,
            },
            minterCode,
        ),
    );

    const jettonWallet = provider.open(
        JettonWallet.createFromConfig(
            {
                minterAddress: jettonMinter.address,
                ownerAddress: provider.sender().address!,
                walletCode: walletCode,
            },
            walletCode,
        ),
    );

    jettonWallet.sendDeploy(provider.sender(), toNano(0.05));

    await provider.waitForDeploy(jettonWallet.address);
}
