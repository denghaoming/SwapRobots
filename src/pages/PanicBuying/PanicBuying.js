import React, { Component } from 'react'
import { withNavigation } from '../../hocs'
import WalletState, { MAX_INT } from '../../state/WalletState';
import loading from '../../components/loading/Loading';
import toast from '../../components/toast/toast';
import Web3 from 'web3'
import { ERC20_ABI } from '../../abi/erc20';
import { Common_ABI } from '../../abi/Common_ABI';
import { SwapRouter_ABI } from '../../abi/SwapRouter_ABI';
import '../Token/Token.css'
import "../ImportVip/ImportVip.css"

import Header from '../Header';
import { showFromWei, toWei, showFromWeiMore, toWeiMore } from '../../utils';
import BN from 'bn.js'

class PanicBuying extends Component {
    state = {
        chainId: '',
        account: '',
        //当前选择的链符号
        chain: WalletState.wallet.chain,
        //当前选择的链配置
        chainConfig: WalletState.wallet.chainConfig,
        //USDT代币详情
        USDTDetail: {},
        //兑换的币种数组，一般是主币和USDT
        swapTokens: [],
        //当前选择的兑换代币，一般是主币或者USDT
        selectToken: WalletState.wallet.chainConfig.Tokens[0],
        //价值币数组，用于查价格或者代币滑点
        Tokens: WalletState.wallet.chainConfig.Tokens,
        //输入框代币合约地址
        tokenOut: null,
        //输入框代币合约对应的代币信息
        tokenOutInfo: {},
        //买入最小金额
        amountIn: null,
        //买入最大金额
        amountInMax: null,
        //交易滑点，默认20%
        slige: null,
        //路由
        swapRouter: WalletState.wallet.chainConfig.Dexs[0].SwapRouter,
        //指定池子
        selPoolToken: WalletState.wallet.chainConfig.Tokens[0],
        wallets: [],
        timeMargin: null,
        txAccount: 0,
        approveAccount: 0,
        sellAmountIn: null,
        sellAmountInMax: null,
    }

    constructor(props) {
        super(props);
        this.handleFileReader = this.handleFileReader.bind(this);
    }

    //页面加载完
    componentDidMount() {
        this.handleAccountsChanged();
        WalletState.onStateChanged(this.handleAccountsChanged);
    }

    //页面销毁前
    componentWillUnmount() {
        WalletState.removeListener(this.handleAccountsChanged);
        this.clearCheckBuyInterval();
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
        let Tokens = chainConfig.Tokens;
        //链发生变化，一些配置信息要重置
        if (chainConfig.ChainId != this.state.chainConfig.chainId) {
            this.clearCheckBuyInterval();
            page.setState({
                chain: wallet.chain,
                chainConfig: chainConfig,
                swapRouter: chainConfig.Dexs[0].SwapRouter,
                Tokens: Tokens,
                selectToken: Tokens[0],
                selPoolToken: Tokens[0],
            })
        }

        //兑换币种
        let swapTokens = [];
        //查找USDT信息
        let USDTDetail;
        //主币和USDT放前面2位
        for (let i = 0; i < 2; i++) {
            let Token = Tokens[i];
            swapTokens.push(Token);
            if (Token.address == chainConfig.USDT) {
                USDTDetail = Token;
            }
        }
        this.setState({
            swapTokens: swapTokens,
            USDTDetail: USDTDetail,
        })
    }


    //要购买的代币合约输入框变化
    handleTokenOutChange(event) {
        this.clearCheckBuyInterval();
        let value = event.target.value;
        this.setState({
            tokenOut: value,
            tokenOutDecimals: 0,
            tokenOutSymbol: null,
        })
    }

    //确定要购买的代币合约
    async confirmTokenOut() {
        let tokenAddress = this.state.tokenOut;
        if (!tokenAddress) {
            toast.show('请输入要交易的代币合约');
            return;
        }
        loading.show();
        try {
            const myWeb3 = new Web3(Web3.givenProvider);
            const commonContract = new myWeb3.eth.Contract(Common_ABI, this.state.chainConfig.Common);

            //获取要购买的代币信息
            let tokensInfo = await commonContract.methods.getTokenInfo(tokenAddress).call();
            let symbol = tokensInfo[0];
            let decimals = tokensInfo[1];
            let totalSupply = tokensInfo[2];

            let tokenOutInfo = {
                address: tokenAddress,
                symbol: symbol,
                decimals: decimals,
                totalSupply: totalSupply,
                showTotal: showFromWei(totalSupply, decimals, 2),
            }
            this.setState({
                tokenOutInfo: tokenOutInfo,
            })

            //获取价格
            let priceInfo = await this.getTokenPrice(tokenOutInfo);
            this.setState({
                tokenOutInfo: priceInfo,
            })

            this.batchGetTokenBalance();
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    //获取其他价值币的合约地址，用于调用合约
    _getTokensAddress() {
        let Tokens = this.state.Tokens;
        let len = Tokens.length;
        let tokensAddress = [];
        for (let i = 0; i < len; i++) {
            tokensAddress.push(Tokens[i].address);
        }
        return tokensAddress;
    }

    //获取代币价格
    async getTokenPrice(tokenInfo) {
        const myWeb3 = new Web3(Web3.givenProvider);
        const commonContract = new myWeb3.eth.Contract(Common_ABI, this.state.chainConfig.Common);
        //获取要购买的代币价格
        let tokens = this._getTokensAddress();
        let tokenPriceResult = await commonContract.methods.getTokenPrice(
            this.state.swapRouter,
            tokenInfo.address,
            WalletState.wallet.chainConfig.USDT,
            tokens
        ).call();
        //代币价格，需要处理USDT最小精度
        let tokenPrice = new BN(tokenPriceResult[0], 10);
        //价格的精度，本来就需要处理USDT的精度，这个精度是在USDT精度的基础上多的，还要再处理一遍
        //价格小于0.{17个0}x时，才存在这个精度
        let priceDecimals = parseInt(tokenPriceResult[1]);
        //池子中另一个代币的合约，一般是USDT或者主币对应的代币
        let pairOther = tokenPriceResult[2];
        //池子里的代币数量
        let tokenReserve = new BN(tokenPriceResult[3], 10);
        //池子里代币的U价值
        let tokenUValue = tokenReserve.mul(tokenPrice).div(toWei('1', tokenInfo.decimals)).div(toWei('1', priceDecimals));

        tokenInfo.tokenPrice = tokenPrice;
        tokenInfo.priceDecimals = priceDecimals;
        tokenInfo.pairOther = pairOther;
        tokenInfo.tokenReserve = tokenReserve;
        tokenInfo.tokenUValue = tokenUValue;
        let realDecimals = this.state.USDTDetail.decimals + priceDecimals;
        tokenInfo.showTokenPrice = showFromWeiMore(tokenPrice, realDecimals, realDecimals);
        return tokenInfo;
    }

    //监听买入最小金额输入框变化
    handleAmountInChange(event) {
        this.clearCheckBuyInterval();
        let value = this.state.amountIn;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ amountIn: value });
    }

    //监听买入最大金额输入框变化
    handleAmountInMaxChange(event) {
        this.clearCheckBuyInterval();
        let value = this.state.amountInMax;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ amountInMax: value });
    }

    //监听卖出最小数量输入框变化
    handleSellAmountInChange(event) {
        this.clearCheckBuyInterval();
        let value = this.state.sellAmountIn;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ sellAmountIn: value });
    }

    //监听卖出最大数量输入框变化
    handleSellAmountInMaxChange(event) {
        this.clearCheckBuyInterval();
        let value = this.state.sellAmountInMax;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ sellAmountInMax: value });
    }

    //监听滑点输入框变化
    handleSligeChange(event) {
        let value = this.state.slige;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ slige: value });
    }

    //监听时间间隔输入框变化
    handleTimeMarginChange(event) {
        this.clearCheckBuyInterval();
        let value = this.state.timeMargin;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ timeMargin: value });
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
        let wallets = this.state.wallets;
        let length = wallets.length;
        for (let index = 0; index < length; index++) {
            setTimeout(() => {
                this.getTokenBalance(wallets[index], index);
            }, 30 * index);
        }
    }

    async getTokenBalance(wallet, index) {
        try {
            const myWeb3 = new Web3(Web3.givenProvider);
            //主币余额
            let balance = await myWeb3.eth.getBalance(wallet.address);
            let showBalance = showFromWei(balance, 18, 4);
            wallet.showBalance = showBalance;
            wallet.balance = new BN(balance, 10);
            //USDT 余额
            const usdtContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.USDTDetail.address);
            let usdtBalance = await usdtContract.methods.balanceOf(wallet.address).call();
            let showUsdtBalance = showFromWei(usdtBalance, this.state.USDTDetail.decimals, 4);
            wallet.showUsdtBalance = showUsdtBalance;
            wallet.usdtBalance = new BN(usdtBalance, 10);
            //代币余额
            if (this.state.tokenOutInfo && this.state.tokenOutInfo.address) {
                const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, this.state.tokenOutInfo.address);
                let tokenBalance = await tokenContract.methods.balanceOf(wallet.address).call();
                let showTokenBalance = showFromWei(tokenBalance, this.state.tokenOutInfo.decimals, 4);
                wallet.showTokenBalance = showTokenBalance;
                wallet.tokenBalance = new BN(tokenBalance, 10);
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

    //刷新代币信息，在这里主要刷新代币池子大小
    _refreshCheckBuyIntervel = null;
    //买入
    async panicBuying() {
        this.clearCheckBuyInterval();
        if (!this.state.tokenOutInfo || !this.state.tokenOutInfo.symbol) {
            toast.show('请输入代币合约地址后点击确定按钮');
            return;
        }
        if (!this.state.amountIn) {
            toast.show('请输入买入最小金额');
            return;
        }
        if (!this.state.amountInMax) {
            toast.show('请输入买入最大金额');
            return;
        }
        let wallets = this.state.wallets;
        let length = wallets.length;
        if (length == 0) {
            toast.show('请导入钱包');
            return;
        }
        this.setState({
            refreshStatus: 'buy',
        })
        let timeMargin = this.state.timeMargin;
        if (!timeMargin) {
            timeMargin = 1000;
        }
        this.setState({ txAccount: 0 })
        this._refreshCheckBuyIntervel = setInterval(() => {
            let index = this.state.index;
            this._buy(wallets[index]);
            index++;
            this.setState({ index: index })
            if (index >= length) {
                this.clearCheckBuyInterval();
            }
        }, timeMargin);
    }

    clearCheckBuyInterval() {
        this.setState({ refreshStatus: null, index: 0 })
        if (this._refreshCheckBuyIntervel) {
            clearInterval(this._refreshCheckBuyIntervel);
            this._refreshCheckBuyIntervel = null;
        }
    }

    //购买过程
    async _buy(wallet) {
        try {
            // let selectToken = this.state.selectToken;
            // if (selectToken.address == this.state.chainConfig.WETH) {
            //     //主币余额不足
            //     if (wallet.balance.lte(toWei(this.state.amountIn, selectToken.decimals))) {
            //         toast.show(selectToken.Symbol + '余额不足');
            //         return;
            //     }
            // } else {
            //     //USDT余额不足
            //     if (wallet.usdtBalance.lt(toWei(this.state.amountIn, selectToken.decimals))) {
            //         toast.show('USDT余额不足');
            //         return;
            //     }
            //     await this.approve(this.state.USDTDetail.address);
            // }

            //池子代币，用指定池子
            let pairOther = this.state.selPoolToken.address;

            const myWeb3 = new Web3(Web3.givenProvider);
            const swapContract = new myWeb3.eth.Contract(SwapRouter_ABI, this.state.swapRouter);
            let path = [];
            //当前选择的交易币种
            let selectToken = this.state.selectToken;
            //当前代币合约信息
            let tokenOutInfo = this.state.tokenOutInfo;

            //输入
            let amountIn = toWei(this.state.amountIn, selectToken.decimals);
            let amountInMax = toWei(this.state.amountInMax, selectToken.decimals);
            let amountDebt = amountInMax.sub(amountIn);
            if (!amountDebt.isZero()) {
                let random = Math.random();
                random = toWei(random + '', 18);
                let max = new BN(MAX_INT, 10);
                let detb = max.div(random).mod(amountDebt);
                amountIn = amountIn.add(detb);
            }

            //路径，指定支付代币
            path.push(selectToken.address);

            //选择的代币和池子代币不一样时
            if (pairOther != selectToken.address) {
                path.push(pairOther);
            }
            path.push(tokenOutInfo.address);

            //预估能得到多少代币
            let amountOuts = await swapContract.methods.getAmountsOut(amountIn, path).call();
            let amountOut = new BN(amountOuts[amountOuts.length - 1], 10);
            //滑点
            let slige = this.state.slige;
            if (!slige) {
                slige = '20';
            }
            slige = parseInt(parseFloat(slige) * 100);
            //根据滑点计算得到的最小值
            let amountOutMin = amountOut.mul(new BN(10000 - slige)).div(new BN(10000));

            let gasPrice = await myWeb3.eth.getGasPrice();
            gasPrice = new BN(gasPrice, 10);
            //gas倍数
            let gasMulti = this.state.gasMulti;
            if (!gasMulti) {
                gasMulti = 1;
            }
            gasMulti = parseFloat(gasMulti);
            gasMulti = parseInt(gasMulti * 100);
            gasPrice = gasPrice.mul(new BN(gasMulti)).div(new BN(100));

            //Data
            let data;
            //主币购买
            if (selectToken.address == this.state.chainConfig.WETH) {
                data = swapContract.methods.swapExactETHForTokensSupportingFeeOnTransferTokens(
                    amountOutMin, path, wallet.address, 1914823077
                ).encodeABI();
            } else {
                data = swapContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).encodeABI();
            }

            var nonce = await myWeb3.eth.getTransactionCount(wallet.address, "pending");
            console.log("nonce", nonce);

            let gas;
            //主币购买
            if (selectToken.address == this.state.chainConfig.WETH) {
                gas = await swapContract.methods.swapExactETHForTokensSupportingFeeOnTransferTokens(
                    amountOutMin, path, wallet.address, 1914823077
                ).estimateGas({ from: wallet.address, value: amountIn });
            } else {
                gas = await swapContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).estimateGas({ from: wallet.address });
            }

            gas = new BN(gas, 10).mul(new BN(150)).div(new BN(100));

            let value = '0';
            if (selectToken.address == this.state.chainConfig.WETH) {
                value = amountIn;
            }

            var txParams = {
                gas: Web3.utils.toHex(gas),
                gasPrice: Web3.utils.toHex(gasPrice),
                nonce: Web3.utils.toHex(nonce),
                chainId: this.state.chainConfig.ChainId,
                value: Web3.utils.toHex(value),
                to: this.state.swapRouter,
                data: data,
                from: wallet.address,
            };

            //gas费
            var fee = new BN(gas, 10).mul(new BN(gasPrice, 10));
            console.log("fee", Web3.utils.fromWei(fee, "ether"));

            await this._buyTx(myWeb3, wallet, txParams);
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    async _buyTx(myWeb3, wallet, txParams) {
        try {
            //交易签名
            let privateKey = wallet.privateKey;
            var signedTx = await myWeb3.eth.accounts.signTransaction(txParams, privateKey);
            let transaction = await myWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
            // 交易失败
            if (!transaction.status) {
                toast.show("购买失败");
                return;
            }
            toast.show("购买成功");
            let txAccount = this.state.txAccount + 1;
            this.setState({ txAccount: txAccount })
            await this.getTokenBalance(wallet);
        } catch (e) {
            console.log("e", e);
        } finally {
            //购买完成删除定时器
            //this.clearCheckBuyInterval();
        }
    }

    //卖出
    async batchSell() {
        this.clearCheckBuyInterval();
        if (!this.state.tokenOutInfo || !this.state.tokenOutInfo.symbol) {
            toast.show('请输入代币合约地址后点击确定按钮');
            return;
        }
        if (!this.state.sellAmountIn) {
            toast.show('请输入卖出最小数量');
            return;
        }
        if (!this.state.sellAmountInMax) {
            toast.show('请输入卖出最大数量');
            return;
        }
        let wallets = this.state.wallets;
        let length = wallets.length;
        if (length == 0) {
            toast.show('请导入钱包');
            return;
        }
        this.setState({
            refreshStatus: 'sell',
        })
        let timeMargin = this.state.timeMargin;
        if (!timeMargin) {
            timeMargin = 1000;
        }
        this.setState({ txAccount: 0 })
        this._refreshCheckBuyIntervel = setInterval(() => {
            let index = this.state.index;
            this._checkSell(wallets[index]);
            index++;
            this.setState({ index: index })
            if (index >= length) {
                this.clearCheckBuyInterval();
            }
        }, timeMargin);
    }

    async _checkSell(wallet) {
        try {
            const myWeb3 = new Web3(Web3.givenProvider);
            const swapContract = new myWeb3.eth.Contract(SwapRouter_ABI, this.state.swapRouter);

            let path = [];
            //当前选择的交易币种
            let selectToken = this.state.selectToken;
            //池子代币，用指定池子，否则用检测到的池子
            let pairOther = this.state.selPoolToken.address;
            //当前代币合约信息
            let tokenOutInfo = this.state.tokenOutInfo;
            //路径，当前代币
            path.push(tokenOutInfo.address);
            //池子
            if (pairOther != selectToken.address) {
                path.push(pairOther);
            }
            //指定支付代币
            path.push(selectToken.address);

            //代币余额
            let tokenBalance = wallet.tokenBalance;
            if (tokenBalance.isZero()) {
                return;
            }
            //输入
            let amountIn = toWei(this.state.sellAmountIn, tokenOutInfo.decimals);
            let amountInMax = toWei(this.state.sellAmountInMax, tokenOutInfo.decimals);
            let amountDebt = amountInMax.sub(amountIn);
            if (!amountDebt.isZero()) {
                let random = Math.random();
                random = toWei(random + '', 18);
                let max = new BN(MAX_INT, 10);
                let detb = max.div(random).mod(amountDebt);
                amountIn = amountIn.add(detb);
            }
            if (tokenBalance.lt(amountIn)) {
                amountIn = tokenBalance;
            }

            //预估能得到多少代币
            let amountOuts = await swapContract.methods.getAmountsOut(amountIn, path).call();
            let amountOut = new BN(amountOuts[amountOuts.length - 1], 10);
            //滑点
            let slige = this.state.slige;
            if (!slige) {
                slige = '20';
            }
            slige = parseInt(parseFloat(slige) * 100);
            //根据滑点计算得到的最小值
            let amountOutMin = amountOut.mul(new BN(10000 - slige)).div(new BN(10000));

            let data;
            //卖得主币
            if (selectToken.address == this.state.chainConfig.WETH) {
                data = swapContract.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).encodeABI();
            } else {
                data = swapContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).encodeABI();
            }

            let gas;
            //卖得主币
            if (selectToken.address == this.state.chainConfig.WETH) {
                gas = await swapContract.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).estimateGas({ from: wallet.address });
            } else {
                gas = await swapContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, 1914823077
                ).estimateGas({ from: wallet.address });
            }

            var nonce = await myWeb3.eth.getTransactionCount(wallet.address, "pending");
            console.log("nonce", nonce);

            let value = '0';

            //这里gasLimit直接用200万
            gas = new BN(gas, 10).mul(new BN(150)).div(new BN(100));

            let gasPrice = await myWeb3.eth.getGasPrice();
            gasPrice = new BN(gasPrice, 10);
            //gas倍数
            let gasMulti = this.state.gasMulti;
            if (!gasMulti) {
                gasMulti = 1;
            }
            gasMulti = parseFloat(gasMulti);
            gasMulti = parseInt(gasMulti * 100);
            gasPrice = gasPrice.mul(new BN(gasMulti)).div(new BN(100));

            var txParams = {
                gas: Web3.utils.toHex(gas),
                gasPrice: Web3.utils.toHex(gasPrice),
                nonce: Web3.utils.toHex(nonce),
                chainId: this.state.chainConfig.ChainId,
                value: Web3.utils.toHex(value),
                to: this.state.swapRouter,
                data: data,
                from: wallet.address,
            };

            var fee = new BN(gas, 10).mul(new BN(gasPrice, 10));
            console.log("fee", Web3.utils.fromWei(fee, "ether"));

            //交易签名
            let privateKey = wallet.privateKey;
            var signedTx = await myWeb3.eth.accounts.signTransaction(txParams, privateKey);
            let transaction = await myWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
            // 交易失败
            if (!transaction.status) {
                toast.show("卖出失败");
                return;
            }
            toast.show("卖出成功");
            let txAccount = this.state.txAccount + 1;
            this.setState({ txAccount: txAccount })
            this.getTokenBalance(wallet);
        } catch (e) {
            console.log("e", e);
        } finally {
            //卖出完成
            // this.clearCheckBuyInterval();
        }
    }

    //选择链
    selChain(index, e) {
        this.clearCheckBuyInterval();
        WalletState.changeChain(WalletState.configs.chains[index]);
    }

    //链选择样式
    getChainItemClass(item) {
        if (item == this.state.chainConfig.chain) {
            return 'Token-Item Item-Sel';
        }
        return 'Token-Item Item-Nor';
    }

    //选择交易所
    selDex(index, e) {
        this.clearCheckBuyInterval();
        this.setState({
            swapRouter: this.state.chainConfig.Dexs[index].SwapRouter,
        })
    }

    //链选择样式
    getDexItemClass(item) {
        if (item.SwapRouter == this.state.swapRouter) {
            return 'Token-Item Item-Sel';
        }
        return 'Token-Item Item-Nor';
    }

    //选择交易币种
    selToken(index, e) {
        this.clearCheckBuyInterval();
        this.setState({
            selectToken: this.state.Tokens[index],
        })
    }

    //交易币种样式
    getTokenItemClass(item) {
        if (item.address == this.state.selectToken.address) {
            return 'Token-Item Item-Sel';
        }
        return 'Token-Item Item-Nor';
    }

    //选择指定池子
    selPoolToken(index, e) {
        this.clearCheckBuyInterval();
        this.setState({
            selPoolToken: this.state.Tokens[index],
        })
    }

    //指定池子样式
    getPoolTokenItemClass(item) {
        if (item.address == this.state.selPoolToken.address) {
            return 'Token-Item Item-Sel';
        }
        return 'Token-Item Item-Nor';
    }

    async batchApprove(tokenAddress) {
        let wallets = this.state.wallets;
        let length = wallets.length;
        this.setState({ approveAccount: 0 })
        for (let index = 0; index < length; index++) {
            this.approve(wallets[index], tokenAddress);
        }
    }

    async approve(wallet, tokenAddress) {
        try {
            loading.show();
            const myWeb3 = new Web3(Web3.givenProvider);
            const tokenContract = new myWeb3.eth.Contract(ERC20_ABI, tokenAddress);
            let allowance = await tokenContract.methods.allowance(wallet.address, this.state.swapRouter).call();
            allowance = new BN(allowance, 10);
            if (!allowance.isZero()) {
                this.setState({
                    approveAccount: this.state.approveAccount + 1
                });
                return;
            }
            var gasPrice = await myWeb3.eth.getGasPrice();
            gasPrice = new BN(gasPrice, 10);

            var gas = await tokenContract.methods.approve(this.state.swapRouter, MAX_INT).estimateGas({ from: wallet.address });
            gas = new BN(gas, 10).mul(new BN("150", 10)).div(new BN("100", 10));

            //Data
            var data = tokenContract.methods.approve(this.state.swapRouter, new BN(MAX_INT, 10)).encodeABI();

            var nonce = await myWeb3.eth.getTransactionCount(wallet.address, "pending");
            console.log("nonce", nonce);

            var txParams = {
                gas: Web3.utils.toHex(gas),
                gasPrice: Web3.utils.toHex(gasPrice),
                nonce: Web3.utils.toHex(nonce),
                chainId: this.state.chainId,
                value: Web3.utils.toHex("0"),
                to: tokenAddress,
                data: data,
                from: wallet.address,
            };

            var fee = new BN(gas, 10).mul(new BN(gasPrice, 10));
            console.log("fee", Web3.utils.fromWei(fee, "ether"));

            //交易签名
            let privateKey = wallet.privateKey.trim();
            var signedTx = await myWeb3.eth.accounts.signTransaction(txParams, privateKey);
            let transaction = await myWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
            //交易失败
            if (!transaction.status) {
                toast.show("授权失败");
                return;
            }
            toast.show("已授权");
            this.setState({
                approveAccount: this.state.approveAccount + 1
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
                    <div className='Remark'>链：</div>
                    {
                        WalletState.configs.chains.map((item, index) => {
                            return <div key={index} className={this.getChainItemClass(item)} onClick={this.selChain.bind(this, index)}>
                                <div className=''>{item}</div>
                            </div>
                        })
                    }
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>交易所：</div>
                    {
                        this.state.chainConfig.Dexs.map((item, index) => {
                            return <div key={index} className={this.getDexItemClass(item)} onClick={this.selDex.bind(this, index)}>
                                <div className=''>{item.name}</div>
                            </div>
                        })
                    }
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>代币合约：</div>
                    <input className="ModuleBg" type="text" value={this.state.tokenOut} onChange={this.handleTokenOutChange.bind(this)} placeholder='请输入代币合约后点击确定按钮' />
                    <div className='Confirm' onClick={this.confirmTokenOut.bind(this)}>确定</div>
                </div>
                <div className='LabelC Remark mt5'>代币符号：{this.state.tokenOutInfo.symbol}， 精度：{this.state.tokenOutInfo.decimals}， 价格：{this.state.tokenOutInfo.showTokenPrice} {this.state.USDTDetail.Symbol}</div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>交易币种：</div>
                    {
                        this.state.swapTokens.map((item, index) => {
                            return <div key={index} className={this.getTokenItemClass(item)} onClick={this.selToken.bind(this, index)}>
                                <div className=''>{item.Symbol}</div>
                            </div>
                        })
                    }
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>指定池子：</div>
                    {
                        this.state.Tokens.map((item, index) => {
                            return <div key={index} className={this.getPoolTokenItemClass(item)} onClick={this.selPoolToken.bind(this, index)}>
                                <div className=''>{item.Symbol}</div>
                            </div>
                        })
                    }
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>买入最小金额：</div>
                    <input className="ModuleBg" type="text" value={this.state.amountIn} onChange={this.handleAmountInChange.bind(this)} pattern="[0-9.]*" placeholder='请输入买入最小金额' />
                    <div className='Remark'>{this.state.selectToken.Symbol}</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>买入最大金额：</div>
                    <input className="ModuleBg" type="text" value={this.state.amountInMax} onChange={this.handleAmountInMaxChange.bind(this)} pattern="[0-9.]*" placeholder='请输入买入最大金额' />
                    <div className='Remark'>{this.state.selectToken.Symbol}</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>卖出最小数量：</div>
                    <input className="ModuleBg" type="text" value={this.state.sellAmountIn} onChange={this.handleSellAmountInChange.bind(this)} pattern="[0-9.]*" placeholder='请输入卖出最小数量' />
                    <div className='Remark'>{this.state.tokenOutInfo.symbol}</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>卖出最大数量：</div>
                    <input className="ModuleBg" type="text" value={this.state.sellAmountInMax} onChange={this.handleSellAmountInMaxChange.bind(this)} pattern="[0-9.]*" placeholder='请输入卖出最大数量' />
                    <div className='Remark'>{this.state.tokenOutInfo.symbol}</div>
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>滑点：</div>
                    <input className="ModuleBg" type="text" value={this.state.slige} onChange={this.handleSligeChange.bind(this)} pattern="[0-9.]*" placeholder='请输入交易滑点，默认20%' />
                    %
                </div>

                <div className='flex TokenAddress ModuleTop'>
                    <div className='Remark'>时间间隔：</div>
                    <input className="ModuleBg" type="text" value={this.state.timeMargin} onChange={this.handleTimeMarginChange.bind(this)} pattern="[0-9]*" placeholder='请输入时间间隔，1000=1秒，默认值：1000' />
                </div>

                <div className="mt20">
                    导入钱包csv文件: <input type="file" onChange={this.handleFileReader} />
                </div>

                <div className='ModuleTop flex'>
                    <div className="approveUsdt" onClick={this.batchApprove.bind(this, this.state.USDTDetail.address)}>授权USDT</div>
                    <div className="approveToken" onClick={this.batchApprove.bind(this, this.state.tokenOutInfo.address)}>授权{this.state.tokenOutInfo.symbol}代币</div>
                </div>
                <div className='LabelC Remark flex mt5'>
                    <div className='flex-1 center flex'>授权钱包数量：{this.state.approveAccount}</div>
                </div>

                <div className='ModuleTop flex'>
                    <div className="approveUsdt" onClick={this.panicBuying.bind(this)}>批量买入{this.state.tokenOutInfo.symbol}</div>
                    <div className="approveToken" onClick={this.batchSell.bind(this)}>批量卖出{this.state.tokenOutInfo.symbol}</div>
                </div>
                <div className='LabelC Remark flex mt5 mb20'>
                    <div className='flex-1 center flex'>交易钱包数量：{this.state.txAccount}</div>
                </div>
                {this.state.refreshStatus && <div className='Contract Remark mb20' onClick={this.clearCheckBuyInterval.bind(this)}>
                    批量交易中...
                </div>}

                {
                    this.state.wallets.map((item, index) => {
                        return <div key={index} className="mt10 Item column">
                            <div className='text'>{index + 1}. 地址：{item.address}</div>
                            <div className='text ml10 flex'>
                                <div className='text flex-1'>{item.showBalance}{this.state.chainConfig.Symbol}</div>
                                <div className='text flex-1'>{item.showUsdtBalance}{this.state.USDTDetail.Symbol}</div>
                                <div className='text flex-1'>{item.showTokenBalance}{this.state.tokenOutInfo.symbol}</div>
                            </div>
                        </div>
                    })
                }

                <div className='mb40'></div>
            </div>
        );
    }
}

export default withNavigation(PanicBuying);