import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    TupleItemSlice,
    Dictionary,
} from '@ton/core';
import { sha256_sync } from '@ton/crypto';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const KEYLEN = 32;

export type JettonMetaDataKeys = 'name' | 'description' | 'image' | 'symbol';
export type MetadataContent = { [s: string]: string | undefined };

const jettonOnChainMetadataSpec: { [key in JettonMetaDataKeys]: 'utf8' | 'ascii' | undefined } = {
    name: 'utf8',
    description: 'utf8',
    image: 'ascii',
    symbol: 'utf8',
};

export type JettonMinterConfig = {
    adminAddress: Address;
    content: MetadataContent;
    jettonWalletCode: Cell;
};

function buildTokenMetadataCell(data: MetadataContent): Cell {
    const dict = Dictionary.empty(Dictionary.Keys.Buffer(KEYLEN), Dictionary.Values.Cell());

    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
        if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys]) 
            throw new Error(`Unsupported onchain key: ${k}`);
        if (!v) 
            return;

        const rootCell = beginCell().storeUint(SNAKE_PREFIX, 8).storeStringTail(v).endCell();

        dict.set(sha256_sync(k), rootCell);
    });

    return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

function parseTokenMetadataCell(contentCell: Cell): MetadataContent {
    const content = contentCell.beginParse();
    const prefix = content.loadUint(8);
    if(prefix !== SNAKE_PREFIX) {
        throw new Error("Only snake format is supported");
    }
    const dict = content.loadDict(Dictionary.Keys.Buffer(KEYLEN), Dictionary.Values.Cell());
    const res: MetadataContent = {};
    Object.keys(jettonOnChainMetadataSpec).forEach((k) => {
        const val = dict.get(sha256_sync(k))?.beginParse().loadStringTail();

        if (val) {
            res[k as JettonMetaDataKeys] = val;
        }
    });

    return res;
}

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(config.adminAddress)
        .storeRef(buildTokenMetadataCell(config.content))
        .storeRef(config.jettonWalletCode)
        .endCell();
}

type JettonMinterData = {
    totalSuply: bigint;
    mintable: bigint;
    adminAddress: Address;
    content: MetadataContent;
    walletCode: Cell;
};

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            toAddress: Address;
            jettonAmount: bigint;
            amount: bigint;
            queryId: number;
            value: bigint;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(21, 32)
                .storeUint(opts.queryId, 64)
                .storeAddress(opts.toAddress)
                .storeCoins(opts.amount)
                .storeRef(
                    beginCell()                     //op::internal_transfer message from minter
                        .storeUint(0x178d4519, 32)
                        .storeUint(opts.queryId, 64)
                        .storeCoins(opts.jettonAmount)
                        .storeAddress(this.address)
                        .storeAddress(this.address)
                        .storeCoins(0)
                        .storeUint(0, 1)
                        .endCell(),
                )
                .endCell(),
        });
    }

    async sendProvideWalletAddress(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId: number;
            ownerAddress: Address;
            includeAddress: boolean;
            value: bigint;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x2c76b973, 32)
                .storeUint(opts.queryId, 64)
                .storeAddress(opts.ownerAddress)
                .storeBit(opts.includeAddress)
                .endCell(),
        });
    }

    async sendCahngeAdmin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            newOwnerAddress: Address;
            value: bigint;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x3, 32).storeAddress(opts.newOwnerAddress).endCell(),
        });
    }

    async sendChangeContent(
        provider: ContractProvider,
        via: Sender,
        opts: {
            newContent: Cell;
            value: bigint;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x4, 32).storeRef(opts.newContent).endCell(),
        });
    }

    async getWalletAddress(provider: ContractProvider, address: Address): Promise<Address> {
        const result = await provider.get('get_wallet_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(address).endCell(),
            } as TupleItemSlice,
        ]);

        return result.stack.readAddress();
    }

    async getMinterData(provider: ContractProvider): Promise<JettonMinterData> {
        let data = await provider.get('get_jetton_data', []);
        const stack = data.stack;
        const result: JettonMinterData = {
            totalSuply: stack.readBigNumber(),
            mintable: stack.readBigNumber(),
            adminAddress: stack.readAddress(),
            content: parseTokenMetadataCell(stack.readCell()),
            walletCode: stack.readCell(),
        };
        return result;
    }
}
