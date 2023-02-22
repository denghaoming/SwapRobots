import React, { Component } from 'react'
import { withNavigation } from '../../hocs'
import WalletState, { MAX_INT } from '../../state/WalletState';
import loading from '../../components/loading/Loading';
import toast from '../../components/toast/toast';
import Web3 from 'web3'
import { ERC20_ABI } from '../../abi/erc20';
import { MultiSend_ABI } from '../../abi/MultiSend_ABI';
import "../ImportVip/ImportVip.css"
import '../Token/Token.css'

import Header from '../Header';
import { toWei, showAccount, showFromWei } from '../../utils';
import BN from 'bn.js'
import copy from 'copy-to-clipboard';
import IconCopy from "../../images/IconCopy.png"

class MultiSend extends Component {
    state = {
        chainId: '',
        account: '',
        wallets: [],
        //代币合约
        tokenAddress: null,
        //代币符号
        tokenSymbol: null,
        //代币精度
        tokenDecimals: null,
        //当前选择的链符号
        chain: WalletState.wallet.chain,
        //当前选择的链配置
        chainConfig: WalletState.wallet.chainConfig,
        amount: null,
    }

    constructor(props) {
        super(props);
        this.handleFileReader = this.handleFileReader.bind(this);
    }

    componentDidMount() {
        this.handleAccountsChanged();
        WalletState.onStateChanged(this.handleAccountsChanged);
    }

    componentWillUnmount() {
        WalletState.removeListener(this.handleAccountsChanged);
    }

    //监听链接钱包，配置变化
    handleAccountsChanged = () => {
        const wallet = WalletState.wallet;
        let page = this;
        page.setState({
            chainId: wallet.chainId,
            account: wallet.account,
        });
        let chainConfig = wallet.chainConfig;
        if (wallet.chainId && wallet.chainId != chainConfig.ChainId) {
            toast.show('请连接 ' + chainConfig.Symbol + ' 链')
        }
        //链发生变化，一些配置信息要重置
        if (chainConfig.ChainId != this.state.chainConfig.ChainId) {
            page.setState({
                chain: wallet.chain,
                chainConfig: chainConfig,
            })
        }
        //切换链后，重新获取钱包余额
        //配置未更新，延迟请求
        setTimeout(() => {
            this.getWalletBalance(wallet.account);
        }, 30);
    }

    //获取钱包主币、代币余额
    async getWalletBalance(account) {
        if (!account) {
            return;
        }
        try {
            const myWeb3 = new Web3(Web3.givenProvider);

            //获取主币余额
            let balance = await myWeb3.eth.getBalance(account);
            let showBalance = showFromWei(balance, 18, 4);

            let tokenSymbol = this.state.tokenSymbol;

            let showTokenBalance = 0;
            if (tokenSymbol) {
                //获取代币余额
                const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenAddress);
                let tokenBalance = await tokenContract.methods.balanceOf(account).call();
                showTokenBalance = showFromWei(tokenBalance, this.state.tokenDecimals, 4);
            }

            this.setState({
                balance: showBalance,
                tokenBalance: showTokenBalance,
            })
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
        }
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
            if (this.state.tokenSymbol) {
                const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenAddress);
                let tokenBalance = await tokenContract.methods.balanceOf(wallet.address).call();
                let showTokenBalance = showFromWei(tokenBalance, this.state.tokenDecimals, 4);
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

    //转账主币
    async sendETH() {
        if (!this.state.amount) {
            toast.show('请输入转账数量');
            return;
        }
        let account = WalletState.wallet.account;
        loading.show();
        try {
            const web3 = new Web3(Web3.givenProvider);
            const MultiSendContract = new web3.eth.Contract(MultiSend_ABI, this.state.chainConfig.MultiSend);
            let tos = [];
            let wallets = this.state.wallets;
            let length = wallets.length;
            //总转账金额
            let value = new BN(0);
            //转账精度处理
            let amount = toWei(this.state.amount, 18);
            value = amount.mul(new BN(length));
            for (let index = 0; index < length; index++) {
                tos.push(wallets[index].address);
            }
            var estimateGas = await MultiSendContract.methods.sendETH(tos, amount).estimateGas({ from: account, value: value });
            var transaction = await MultiSendContract.methods.sendETH(tos, amount).send({ from: account, value: value });
            if (transaction.status) {
                toast.show("已经批量转账" + this.state.chainConfig.Symbol);
                this.getWalletBalance(this.state.account);
                this.batchGetTokenBalance();
            } else {
                toast.show("转账失败");
            }
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    //确定代币合约地址
    async confirmToken() {
        let tokenAddress = this.state.tokenAddress;
        if (!tokenAddress) {
            toast.show('请输入正确的代币合约地址');
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
                tokenDecimals: tokenDecimals,
                tokenSymbol: tokenSymbol,
            })
            this.getWalletBalance(this.state.account);
            this.batchGetTokenBalance();
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    //批量转账代币
    async sendToken() {
        let account = WalletState.wallet.account;
        if (!this.state.tokenSymbol) {
            toast.show('请输入正确的代币合约地址，并点击确定按钮获取代币信息');
            return;
        }
        if (!this.state.amount) {
            toast.show('请输入转账数量');
            return;
        }
        let tos = [];
        let wallets = this.state.wallets;
        let length = wallets.length;
        if (0 == length) {
            toast.show('请导入转账接收地址列表');
            return;
        }
        let tokenDecimals = this.state.tokenDecimals;
        let amount = toWei(this.state.amount, tokenDecimals);
        for (let index = 0; index < length; index++) {
            tos.push(wallets[index].address);
        }
        loading.show();
        let tokenAddress = this.state.tokenAddress;
        try {
            const web3 = new Web3(Web3.givenProvider);
            const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
            let MultiSendAddress = this.state.chainConfig.MultiSend;
            let allowance = await tokenContract.methods.allowance(account, MultiSendAddress).call();
            allowance = new BN(allowance, 10);
            if (allowance.isZero()) {
                let transaction = await tokenContract.methods.approve(MultiSendAddress, MAX_INT).send({ from: account });
                if (!transaction.status) {
                    toast.show("授权失败");
                    return;
                }
            }

            const MultiSendContract = new web3.eth.Contract(MultiSend_ABI, MultiSendAddress);
            var estimateGas = await MultiSendContract.methods.sendToken(tokenAddress, tos, amount).estimateGas({ from: account });
            var transaction = await MultiSendContract.methods.sendToken(tokenAddress, tos, amount).send({ from: account });
            if (transaction.status) {
                toast.show("已经批量转账" + this.state.tokenSymbol);
                this.getWalletBalance(this.state.account);
                this.batchGetTokenBalance();
            } else {
                toast.show("转账失败");
            }
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    handleTokenAddressChange(event) {
        let value = event.target.value;
        this.setState({
            tokenAddress: value,
            tokenDecimals: 0,
            tokenSymbol: null,
        })
    }

    //获取单个钱包余额
    async getTokenBalance(wallet, index) {
        try {
            let options = {
                timeout: 600000, // milliseconds,
                headers: [{ name: 'Access-Control-Allow-Origin', value: '*' }]
            };

            const myWeb3 = new Web3(Web3.givenProvider);
            if (this.state.tokenSymbol) {
                const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenAddress);
                let tokenBalance = await tokenContract.methods.balanceOf(wallet.address).call();
                let showTokenBalance = showFromWei(tokenBalance, this.state.tokenDecimals, 4);
                wallet.showTokenBalance = showTokenBalance;
            }
            let balance = await myWeb3.eth.getBalance(wallet.address);
            let showBalance = showFromWei(balance, 18, 4);
            wallet.showBalance = showBalance;
            this.setState({
                wallets: this.state.wallets,
            })
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
        }
    }

    handleAmountChange(event) {
        let value = this.state.amount;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ amount: value });
    }

    //选择链
    selChain(index, e) {
        WalletState.changeChain(WalletState.configs.chains[index]);
    }

    //链选择样式
    getChainItemClass(item) {
        if (item == this.state.chainConfig.chain) {
            return 'Token-Item Item-Sel';
        }
        return 'Token-Item Item-Nor';
    }

    render() {
        return (
            <div className="Token ImportVip">
                <Header></Header>
                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>链：</div>
                    {
                        WalletState.configs.chains.map((item, index) => {
                            return <div key={index} className={this.getChainItemClass(item)} onClick={this.selChain.bind(this, index)}>
                                <div className=''>{item}</div>
                            </div>
                        })
                    }
                </div>
                <div className="mt20">
                    导入钱包csv文件: <input type="file" onChange={this.handleFileReader} />
                </div>
                <div className='flex TokenAddress ModuleTop'>
                    <input className="ModuleBg" type="text" value={this.state.tokenAddress} onChange={this.handleTokenAddressChange.bind(this)} placeholder='输入代币合约地址' />
                    <div className='Confirm' onClick={this.confirmToken.bind(this)}>确定</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>转账数量：</div>
                    <input className="ModuleBg" type="text" value={this.state.amount} onChange={this.handleAmountChange.bind(this)} placeholder='输入转账数量' pattern="[0-9.]*" />
                </div>

                <div className='ModuleTop flex'>
                    <div className="approveUsdt" onClick={this.sendETH.bind(this)}>批量转账{this.state.chainConfig.Symbol}</div>
                    <div className="approveToken" onClick={this.sendToken.bind(this)}>批量转账{this.state.tokenSymbol}代币</div>
                </div>

                <div className='LabelC Remark flex mt5'>
                    <div className='flex-1 center flex'>余额：{this.state.balance} {this.state.chainConfig.Symbol}</div>
                    <div className='flex-1 center flex'>余额：{this.state.tokenBalance} {this.state.tokenSymbol}</div>
                </div>

                {
                    this.state.wallets.map((item, index) => {
                        return <div key={index} className="mt10 Item column">
                            <div className='text'>{index + 1}. 地址：{item.address}</div>
                            <div className='text ml10 flex'>
                                <div className='text flex-1'>{item.showBalance}{this.state.chainConfig.Symbol}</div>
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

export default withNavigation(MultiSend);