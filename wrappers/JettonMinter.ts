import {Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, TupleItemSlice,} from '@ton/core';

export type JettonMinterConfig = {
    adminAddress: Address; content: Cell; jettonWalletCode: Cell;
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
            .storeCoins(0)
            .storeAddress(config.adminAddress)
            .storeRef(config.content)
            .storeRef(config.jettonWalletCode)
            .endCell();
}

export class JettonMinter implements Contract {
    constructor(readonly address: Address, readonly init?: {
        code: Cell; data: Cell
    }) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(
            config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = {code, data};
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMint(provider: ContractProvider, via: Sender, opts: {
        toAddress: Address; jettonAmount: bigint; amount: bigint; queryId: number;
        value: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                                .storeUint(21, 32)
                                .storeUint(opts.queryId, 64)
                                .storeAddress(opts.toAddress)
                                .storeCoins(opts.amount)
                                .storeRef(beginCell()
                                        .storeUint(0x178d4519, 32)
                                        .storeUint(opts.queryId, 64)
                                        .storeCoins(opts.jettonAmount)
                                        .storeAddress(this.address)
                                        .storeAddress(this.address)
                                        .storeCoins(0)
                                        .storeUint(0, 1)
                                        .endCell())
                                .endCell()
        });
    }

    async sendProvideWalletAddress(provider: ContractProvider, via: Sender, opts: {
        queryId: number; ownerAddress: Address; includeAddress: boolean;
        value: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                                .storeUint(0x2c76b973, 32)
                                .storeUint(opts.queryId, 64)
                                .storeAddress(opts.ownerAddress)
                                .storeBit(opts.includeAddress)
                                .endCell()
        });
    }

    async sendCahngeAdmin(provider: ContractProvider, via: Sender, opts: {
        newOwnerAddress: Address;
        value: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                                .storeUint(0x3, 32)
                                .storeAddress(opts.newOwnerAddress)
                                .endCell()
        });
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, opts: {
        newContent: Cell;
        value: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                                .storeUint(0x4, 32)
                                .storeRef(opts.newContent)
                                .endCell()
        });
    }

    async getWalletAddress(provider: ContractProvider, address: Address):
            Promise<Address> {
        const result = await provider.get('get_wallet_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(address).endCell(),
            } as TupleItemSlice,
        ]);

        return result.stack.readAddress();
    }

    async getMinterData(provider: ContractProvider): Promise<[bigint, bigint, Address, Cell, Cell]> {
        const result = await provider.get('get_jetton_data', []);
        const stack = result.stack;
        return [stack.readBigNumber(), stack.readBigNumber(), stack.readAddress(), stack.readCell(), stack.readCell()];
    }
}
