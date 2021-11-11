import BigNumber from 'bignumber.js'
import {
  Finding,
  HandleTransaction,
  TransactionEvent,
  getJsonRpcUrl,
  FindingSeverity,
  FindingType
} from 'forta-agent'
import { AbiItem } from 'web3-utils'
import Web3 from 'web3';
import tokenAbi from '../src/abi/token_abi.json';

const axios = require('axios');
const web3 = new Web3(getJsonRpcUrl());
const InputDataDecoder = require('ethereum-input-data-decoder');
const flashLoanAbi = new InputDataDecoder('./src/abi/flashloan_abi.json');
const LENDING_CONTRACT = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9"
const FLASHLOAN_FUNCTION = "FlashLoan(address,address,address,uint256,uint256,uint16)"
const THRESHOLD_WARNING = 10000000; // $10M

const getTokenPrice = async (symbol: string): Promise<number> => {
  const response = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`);
  const data = await response.data;
  if (data === undefined || data.length === 0) return 0;
  return data['USD'] as number;
}

function converDecimal(amount: number){
  var decimal = "1";
  for(var i = 0;i < amount;i++){
    decimal += "0";
  }
  return decimal;
}

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = []

  if (txEvent.to != LENDING_CONTRACT) return findings

  const flashLoanEvent = txEvent.filterEvent(FLASHLOAN_FUNCTION)
  if (flashLoanEvent.length == 0) return findings

  //get address of token loan 
  const tokenLoanAddress = txEvent.receipt.logs[0].address;

  //Get info of token loan 
  const tokenContract = new web3.eth.Contract(tokenAbi as AbiItem[], tokenLoanAddress);
  const symbol = await tokenContract.methods.symbol().call();
  const decimals = await tokenContract.methods.decimals().call();

  //Get current price of token loan 
  const tokenPrice = await getTokenPrice(symbol).then(res => { return res });

  //Get loan amount
  const transactionData = txEvent.transaction.data;
  const transactionDataDecoded = flashLoanAbi.decodeData(transactionData);
  const amount = new BigNumber(transactionDataDecoded.inputs[2]);
  const decimal = new BigNumber(converDecimal(decimals));
  
  const flashLoanAmountInUsd = amount.dividedBy(decimal).multipliedBy(tokenPrice);
  if (flashLoanAmountInUsd.isLessThan(THRESHOLD_WARNING)) return findings;

  findings.push(Finding.fromObject({
    name: `Flash loan alert`,
    description: `Flash loan token ${symbol} value ≥ $10m`,
    alertId: `FORTA-FLASH-LOAN`,
    severity: FindingSeverity.Medium,
    type: FindingType.Suspicious,
    metadata: {
      amount: flashLoanAmountInUsd.toString()
    }
  }));


  return findings
}

export default {
  handleTransaction,
  // handleBlock
}