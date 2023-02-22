import React, { Component } from 'react'
import { withNavigation } from '../../hocs'
import WalletState, { MAX_INT } from '../../state/WalletState';
import loading from '../../components/loading/Loading';
import toast from '../../components/toast/toast';
import Web3 from 'web3'
import { ERC20_ABI } from '../../abi/erc20';
import "../ImportVip/ImportVip.css"
import '../Token/Token.css'

import Header from '../Header';
import { showAccount, showFromWei, toWei } from '../../utils';
import BN from 'bn.js'
import confirmDialog from './ConfirmDialog';

class Collect extends Component {
    state = {
        chainId: '',
        account: '',
        wallets: [],
        address: [],
        amountIn: null,
        tokenIn: null,
        collectAccount: 0,
        to: null,
        chainSymbol: 'BNB',
        chainSymbols: {
            1: 'ETH',
            56: 'BNB',
            10001: 'ETHW',
            128: 'HT',
        },
    }

    constructor(props) {
        super(props);
        this.handleFileReader = this.handleFileReader.bind(this);
        this._batchCollect = this._batchCollect.bind(this);
        this._batchCollectToken = this._batchCollectToken.bind(this);
    }

    componentDidMount() {
        this.handleAccountsChanged();
        WalletState.onStateChanged(this.handleAccountsChanged);
    }

    componentWillUnmount() {
        WalletState.removeListener(this.handleAccountsChanged);
    }

    handleFileReader(e) {
        let page = this;
        try {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = function (e) {
                var data = e.target.result;
                var allRows = data.split("\n");
                var wallets = [];
                var exits = {};
                var privateKeyTitle = "privateKey";
                var privateKeyIndex = 1;
                var addressTitle = "address";
                var addressIndex = 0;
                var addrs = [];
                for (let singleRow = 0; singleRow < allRows.length; singleRow++) {
                    let rowCells = allRows[singleRow].split(',');
                    if (singleRow === 0) {

                    } else {
                        // 表格内容
                        //rowCells[rowCell];
                        let address = rowCells[addressIndex].replaceAll('\"', '');
                        if (exits[address]) {
                            console.log("exits", address);
                            continue;
                        }
                        exits[address] = true;
                        let privateKey = rowCells[privateKeyIndex];
                        if (privateKey) {
                            privateKey = privateKey.replaceAll('\"', '').trim();
                        }
                        if (address && privateKey) {
                            wallets.push({ address: address, privateKey: privateKey })
                            addrs.push(address);
                        }
                    }
                };
                page.setState({ wallets: wallets, collectAccount: 0 });
                page.batchGetTokenBalance();
            }
            reader.readAsText(file);
        } catch (error) {
            console.log("error", error);
        } finally {

        }
    }

    handleAccountsChanged = () => {
        const wallet = WalletState.wallet;
        let page = this;
        let chainSymbol = this.state.chainSymbols[wallet.chainId];
        page.setState({
            chainId: wallet.chainId,
            account: wallet.account,
            chainSymbol: chainSymbol,
        });
    }

    async batchCollectToken() {
        if (!this.state.tokenInSymbol) {
            toast.show("请输入归集代币合约地址并点确定按钮获取代币信息");
            return;
        }
        if (!this.state.amountIn) {
            toast.show("请输入最小归集数量");
            return;
        }
        if (!this.state.to) {
            toast.show("请输入接收地址");
            return;
        }
        confirmDialog.show({
            address: this.state.to
        }, this._batchCollectToken)
    }

    async _batchCollectToken() {
        let wallets = this.state.wallets;
        let length = wallets.length;
        this.setState({ collectAccount: 0 })
        for (let index = 0; index < length; index++) {
            this.collectToken(wallets[index]);
        }
    }

    async collectToken(wallet) {
        try {
            loading.show();
            const myWeb3 = new Web3(Web3.givenProvider);
            const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenIn);
            let balance = await tokenContract.methods.balanceOf(wallet.address).call();
            console.log(balance, this.state.tokenInSymbol);
            balance = new BN(balance, 10);
            let min = toWei(this.state.amountIn, this.state.tokenInDecimals);
            if (balance.lt(min)) {
                if (this.state.collectAccount + 1 == this.state.wallets.length) {
                    this.batchGetTokenBalance();
                }
                this.setState({
                    collectAccount: this.state.collectAccount + 1
                });
                return;
            }
            var gasPrice = await myWeb3.eth.getGasPrice();
            gasPrice = new BN(gasPrice, 10);

            var gas = await tokenContract.methods.transfer(this.state.to, balance).estimateGas({ from: wallet.address });
            gas = new BN(gas, 10).mul(new BN("130", 10)).div(new BN("100", 10));

            //Data
            var data = tokenContract.methods.transfer(this.state.to, balance).encodeABI();

            var nonce = await myWeb3.eth.getTransactionCount(wallet.address, "pending");
            console.log("nonce", nonce);

            var txParams = {
                gas: Web3.utils.toHex(gas),
                gasPrice: Web3.utils.toHex(gasPrice),
                nonce: Web3.utils.toHex(nonce),
                chainId: this.state.chainId,
                value: Web3.utils.toHex("0"),
                to: this.state.tokenIn,
                data: data,
                from: wallet.address,
            };

            var fee = new BN(gas, 10).mul(new BN(gasPrice, 10));
            console.log("fee", Web3.utils.fromWei(fee, "ether"));

            console.log("txParams", txParams);

            //交易签名
            let privateKey = wallet.privateKey.trim();
            var signedTx = await myWeb3.eth.accounts.signTransaction(txParams, privateKey);
            console.log("signedTx", signedTx);
            let transaction = await myWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
            //交易失败
            if (!transaction.status) {
                toast.show("归集失败");
                return;
            }
            console.log("已归集");
            toast.show("已归集");
            if (this.state.collectAccount + 1 == this.state.wallets.length) {
                this.batchGetTokenBalance();
            }
            this.setState({
                collectAccount: this.state.collectAccount + 1
            });
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    async batchGetTokenBalance() {
        setTimeout(() => {
            let wallets = this.state.wallets;
            let length = wallets.length;
            for (let index = 0; index < length; index++) {
                this.getTokenBalance(wallets[index], index);
            }
        }, 30);
    }

    async getTokenBalance(wallet, index) {
        try {
            const myWeb3 = new Web3(Web3.givenProvider);
            let balance = await myWeb3.eth.getBalance(wallet.address);
            let showBalance = showFromWei(balance, 18, 4);
            wallet.showBalance = showBalance;
            if (this.state.tokenIn) {
                const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenIn);
                let tokenBalance = await tokenContract.methods.balanceOf(wallet.address).call();
                let showTokenBalance = showFromWei(tokenBalance, this.state.tokenInDecimals, 4);
                wallet.showTokenBalance = showTokenBalance;
            }
            this.setState({
                wallets: this.state.wallets,
            })
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
        }
    }

    handleTokenInChange(event) {
        let value = event.target.value;
        this.setState({
            tokenIn: value,
            tokenInDecimals: 0,
            tokenInSymbol: null,
            collectAccount: 0
        })
    }

    async confirmTokenIn() {
        let tokenAddress = this.state.tokenIn;
        if (!tokenAddress) {
            toast.show('请输入归集代币合约地址');
            return;
        }
        loading.show();
        try {
            const web3 = new Web3(Web3.givenProvider);
            const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
            let tokenSymbol = await tokenContract.methods.symbol().call();
            let tokenDecimals = await tokenContract.methods.decimals().call();
            tokenDecimals = parseInt(tokenDecimals);
            this.setState({
                tokenInDecimals: tokenDecimals,
                tokenInSymbol: tokenSymbol,
            })
            this.batchGetTokenBalance();
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    handleAmountInChange(event) {
        let value = this.state.amountIn;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ amountIn: value });
    }

    handleToChange(event) {
        let value = event.target.value;
        this.setState({
            to: value,
        })
    }

    async batchCollect() {
        if (!this.state.to) {
            toast.show("请输入接收地址");
            return;
        }
        confirmDialog.show({
            address: this.state.to,
        }, this._batchCollect);
    }

    async _batchCollect() {
        let wallets = this.state.wallets;
        let length = wallets.length;
        this.setState({ collectAccount: 0 })
        for (let index = 0; index < length; index++) {
            this.collect(wallets[index]);
        }
    }

    async collect(wallet) {
        try {
            loading.show();
            const myWeb3 = new Web3(Web3.givenProvider);
            let balance = await myWeb3.eth.getBalance(wallet.address);
            balance = new BN(balance, 10);
            var gasPrice = await myWeb3.eth.getGasPrice();
            gasPrice = new BN(gasPrice, 10);
            let gas = new BN("21000", 10);

            var fee = new BN(gas, 10).mul(new BN(gasPrice, 10));
            console.log("fee", Web3.utils.fromWei(fee, "ether"));

            if (balance.lte(fee)) {
                if (this.state.collectAccount + 1 == this.state.wallets.length) {
                    this.batchGetTokenBalance();
                }
                this.setState({
                    collectAccount: this.state.collectAccount + 1
                });
                return;
            }

            let value = balance.sub(fee);

            var nonce = await myWeb3.eth.getTransactionCount(wallet.address, "pending");
            console.log("nonce", nonce);

            var txParams = {
                gas: Web3.utils.toHex(gas),
                gasPrice: Web3.utils.toHex(gasPrice),
                nonce: Web3.utils.toHex(nonce),
                chainId: this.state.chainId,
                value: Web3.utils.toHex(value),
                to: this.state.to,
                from: wallet.address,
            };

            console.log("txParams", txParams);

            //交易签名
            let privateKey = wallet.privateKey.trim();
            var signedTx = await myWeb3.eth.accounts.signTransaction(txParams, privateKey);
            console.log("signedTx", signedTx);
            let transaction = await myWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
            //交易失败
            if (!transaction.status) {
                toast.show("归集失败");
                return;
            }
            console.log("已归集");
            toast.show("已归集");
            if (this.state.collectAccount + 1 == this.state.wallets.length) {
                this.batchGetTokenBalance();
            }
            this.setState({
                collectAccount: this.state.collectAccount + 1
            });
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    render() {
        return (
            <div className="Token ImportVip">
                <Header></Header>

                <div className='flex TokenAddress ModuleTop'>
                    <input className="ModuleBg" type="text" value={this.state.tokenIn} onChange={this.handleTokenInChange.bind(this)} placeholder='输入归集代币合约地址' />
                    <div className='Confirm' onClick={this.confirmTokenIn.bind(this)}>确定</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <input className="ModuleBg" type="text" value={this.state.amountIn} onChange={this.handleAmountInChange.bind(this)} pattern="[0-9.]*" placeholder='输入最小归集数量，即地址里代币数量>=该值时才归集' />
                    <div className='Label'>{this.state.tokenInSymbol}</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <input className="ModuleBg" type="text" value={this.state.to} onChange={this.handleToChange.bind(this)} placeholder='输入接收地址' />
                </div>

                <div className="mt20">
                    导入钱包csv文件: <input type="file" onChange={this.handleFileReader} />
                </div>

                <div className='ModuleTop flex'>
                    <div className="approveUsdt" onClick={this.batchCollect.bind(this)}>归集{this.state.chainSymbol}</div>
                    <div className="approveToken" onClick={this.batchCollectToken.bind(this)}>归集{this.state.tokenInSymbol}代币</div>
                </div>
                <div className='Contract Remark'>
                    归集钱包数量：{this.state.collectAccount}
                </div>

                {
                    this.state.wallets.map((item, index) => {
                        return <div key={index} className="mt10 Item column">
                            <div className='text'>{index + 1}. 地址：{item.address}</div>
                            <div className='text ml10 flex'>
                                <div className='text flex-1'>{item.showBalance}{this.state.chainSymbol}</div>
                                <div className='text flex-1'>{item.showTokenBalance}{this.state.tokenSymbol}</div>
                            </div>
                        </div>
                    })
                }

                <div className='mb40'></div>
            </div>
        );
    }
}

export default withNavigation(Collect);