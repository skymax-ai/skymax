import BigNumber from "bignumber.js";
import BN from "bn.js";

const ten = new BigNumber(10);

export function toDecimalsBN(num: number | string, decimals: number | string) {
    return new BN(BigNumber(num).multipliedBy(ten.pow(decimals)).toFixed(0));
}