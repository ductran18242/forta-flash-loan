"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var bignumber_js_1 = __importDefault(require("bignumber.js"));
var forta_agent_1 = require("forta-agent");
var web3_1 = __importDefault(require("web3"));
var token_abi_json_1 = __importDefault(require("../src/abi/token_abi.json"));
var axios = require('axios');
var web3 = new web3_1.default((0, forta_agent_1.getJsonRpcUrl)());
var InputDataDecoder = require('ethereum-input-data-decoder');
var flashLoanAbi = new InputDataDecoder('./src/abi/flashloan_abi.json');
var LENDING_CONTRACT = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
var FLASHLOAN_FUNCTION = "FlashLoan(address,address,address,uint256,uint256,uint16)";
var THRESHOLD_WARNING = 10000; // $10M
var getTokenPrice = function (tokenContract, symbol) { return __awaiter(void 0, void 0, void 0, function () {
    var response, data;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, axios.get("https://min-api.cryptocompare.com/data/price?fsym=" + symbol + "&tsyms=USD")];
            case 1:
                response = _a.sent();
                return [4 /*yield*/, response.data];
            case 2:
                data = _a.sent();
                if (data === undefined || data.length === 0)
                    return [2 /*return*/, 0];
                return [2 /*return*/, data['USD']];
        }
    });
}); };
function converDecimal(amount) {
    var decimal = "1";
    for (var i = 0; i < amount; i++) {
        decimal += "0";
    }
    return decimal;
}
var handleTransaction = function (txEvent) { return __awaiter(void 0, void 0, void 0, function () {
    var findings, flashLoanEvent, tokenLoanAddress, tokenContract, symbol, decimals, tokenPrice, transactionData, transactionDataDecoded, amount, decimal, flashLoanAmountInUsd;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                findings = [];
                if (txEvent.to != LENDING_CONTRACT)
                    return [2 /*return*/, findings];
                flashLoanEvent = txEvent.filterEvent(FLASHLOAN_FUNCTION);
                if (flashLoanEvent.length == 0)
                    return [2 /*return*/, findings
                        //get address of token loan 
                    ];
                tokenLoanAddress = txEvent.receipt.logs[0].address;
                tokenContract = new web3.eth.Contract(token_abi_json_1.default, tokenLoanAddress);
                return [4 /*yield*/, tokenContract.methods.symbol().call()];
            case 1:
                symbol = _a.sent();
                return [4 /*yield*/, tokenContract.methods.decimals().call()];
            case 2:
                decimals = _a.sent();
                return [4 /*yield*/, getTokenPrice(tokenLoanAddress, symbol).then(function (res) { return res; })];
            case 3:
                tokenPrice = _a.sent();
                transactionData = txEvent.transaction.data;
                transactionDataDecoded = flashLoanAbi.decodeData(transactionData);
                amount = new bignumber_js_1.default(transactionDataDecoded.inputs[2]);
                decimal = new bignumber_js_1.default(converDecimal(decimals));
                flashLoanAmountInUsd = amount.dividedBy(decimal).multipliedBy(tokenPrice);
                if (flashLoanAmountInUsd.isLessThan(THRESHOLD_WARNING))
                    return [2 /*return*/, findings];
                findings.push(forta_agent_1.Finding.fromObject({
                    name: "Flash loan alert",
                    description: "Flash loan token " + symbol + " value \u2265 $10m",
                    alertId: "FORTA-FLASH-LOAN",
                    severity: forta_agent_1.FindingSeverity.Medium,
                    type: forta_agent_1.FindingType.Suspicious,
                    metadata: {
                        amount: flashLoanAmountInUsd.toString()
                    }
                }));
                return [2 /*return*/, findings];
        }
    });
}); };
exports.default = {
    handleTransaction: handleTransaction,
    // handleBlock
};
