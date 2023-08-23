import Web3 from 'web3'
class WalletState {
    configs = {
        //支持的链
        chains: ['BSC', 'PG', 'Heco', 'Ethereum', 'ETHW'],
        //HT链配置信息
        PG: {
            chain: 'PG',
            ChainId: 20201022,
            Symbol: 'PG',
            RPC: 'https://pegorpc.com/',
            Browser: 'https://scan.pego.network/',
            USDT: '0x02F9Bebf5E54968D8Cc2562356C91ECDE135801B',
            WETH: '0x0cF4071940782b640d0b595Cb17bDf3E90869d70',
            Tokens: [{
                Symbol: 'PG',
                address: "0x0cF4071940782b640d0b595Cb17bDf3E90869d70",
                decimals: 18,
            }, {
                Symbol: 'USDT',
                address: "0x02F9Bebf5E54968D8Cc2562356C91ECDE135801B",
                decimals: 18,
            }],
            Dexs: [
                {
                    name: 'W3Swap',
                    SwapRouter: '0xE9d6f80028671279a28790bb4007B10B0595Def1',
                    logo: '',
                },],
            Common: '0x3f10Fab20b5885ae0868C490177b66b7DC6883Ee',
            MultiSend: '0xEFBE46164858431B87cc8949FF53CB29D4FA0333',
        },
        //HT链配置信息
        Heco: {
            chain: 'Heco',
            ChainId: 128,
            Symbol: 'HT',
            RPC: 'https://http-mainnet.hecochain.com/',
            // RPC:"https://heco.mytokenpocket.vip",
            Browser: 'https://www.hecoinfo.com/en-us/',
            USDT: '0xa71EdC38d189767582C38A3145b5873052c3e47a',
            WETH: '0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F',
            Tokens: [{
                Symbol: 'HT',
                address: "0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F",
                decimals: 18,
            }, {
                Symbol: 'USDT',
                address: "0xa71EdC38d189767582C38A3145b5873052c3e47a",
                decimals: 18,
            }],
            Dexs: [
                {
                    name: 'PIPPI',
                    SwapRouter: '0xBe4AB2603140F134869cb32aB4BC56d762Ae900B',
                    logo: '',
                }, {
                    name: 'MDEX',
                    SwapRouter: '0x0f1c2D1FDD202768A4bDa7A38EB0377BD58d278E',
                    logo: '',
                },],
            Common: '0x5e43d6dBdF6CEa7dbdBfF21168f1C8fCcF57161B',
            MultiSend: '0x1453027045D7545260e309A82f48b123c32f5838',
        },
        //BSC链配置信息
        BSC: {
            chain: 'BSC',
            ChainId: 56,
            Symbol: 'BNB',
            RPC: 'https://bsc-dataseed1.binance.org/',
            Browser: 'https://bscscan.com/',
            USDT: '0x55d398326f99059fF775485246999027B3197955',
            WETH: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            Tokens: [{
                Symbol: 'BNB',
                address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
                decimals: 18,
            }, {
                Symbol: 'USDT',
                address: "0x55d398326f99059fF775485246999027B3197955",
                decimals: 18,
            }, {
                Symbol: 'BUSD',
                address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
                decimals: 18,
            }],
            Dexs: [
                {
                    name: 'Pancake',
                    SwapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
                    logo: '',
                }],
            Common: '0x3f10Fab20b5885ae0868C490177b66b7DC6883Ee',
            MultiSend: '0xEFBE46164858431B87cc8949FF53CB29D4FA0333',
        },
        //Ethereum链配置信息
        Ethereum: {
            chain: 'Ethereum',
            ChainId: 1,
            Symbol: 'ETH',
            RPC: 'https://ethjeqd0430103d.swtc.top/',
            Browser: 'https://etherscan.io/',
            USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            Tokens: [{
                Symbol: 'ETH',
                address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                decimals: 18,
            }, {
                Symbol: 'USDT',
                address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                decimals: 6,
            }, {
                Symbol: 'USDC',
                address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                decimals: 6,
            }],
            Dexs: [
                {
                    name: 'UniSwapV2',
                    SwapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                    logo: '',
                }, {
                    name: 'SushiSwap',
                    SwapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
                    logo: '',
                },],
            Common: '0x1453027045D7545260e309A82f48b123c32f5838',
            MultiSend: '0xd85495924f70046723Ab6BE850a22B15dF9b2c53',
        },
        //ETHW链配置信息
        ETHW: {
            chain: 'ETHW',
            ChainId: 10001,
            Symbol: 'ETHW',
            RPC: 'https://mainnet.ethereumpow.org/',
            Browser: 'https://www.oklink.com/en/ethw/',
            USDT: '0x2AD7868CA212135C6119FD7AD1Ce51CFc5702892',
            WETH: '0x7Bf88d2c0e32dE92CdaF2D43CcDc23e8Edfd5990',
            Tokens: [{
                Symbol: 'ETHW',
                address: "0x7Bf88d2c0e32dE92CdaF2D43CcDc23e8Edfd5990",
                decimals: 18,
            }, {
                Symbol: 'USDT',
                address: "0x2AD7868CA212135C6119FD7AD1Ce51CFc5702892",
                decimals: 6,
            }],
            Dexs: [
                {
                    name: 'LFGSwap',
                    SwapRouter: '0x4f381d5fF61ad1D0eC355fEd2Ac4000eA1e67854',
                    logo: '',
                }],
            Common: '0x1453027045D7545260e309A82f48b123c32f5838',
            MultiSend: '0x59886a35796e33890dEc08D3468F6C8DCfEa4ea9',
        },
    }
    wallet = {
        //应用内当前选择的链
        chain: 'BSC',
        chainSymbol: 'BNB',
        chainId: null,
        account: null,
        //当前语言
        lang: "EN",
        //当前链配置信息
        chainConfig: this.configs.BSC,
    }

    listeners = []

    constructor() {
        this.getCacheConfig();
        this.subcripeWeb3();
    }
    //listen the wallet event
    async subcripeWeb3() {
        let page = this;
        if (window.ethereum) {
            //监听钱包地址变化
            window.ethereum.on('accountsChanged', function (accounts) {
                page.connetWallet();
            });
            //监听链变化
            window.ethereum.on('chainChanged', function (chainId) {
                page.connetWallet();
            });
        }
        // window.ethereum.on('connect', (connectInfo) => { });
        // window.ethereum.on('disconnect', (err) => { });
        // window.ethereum.isConnected();

        //         4001
        // The request was rejected by the user
        // -32602
        // The parameters were invalid
        // -32603
        // Internal error
    }

    //获取缓存配置
    async getCacheConfig() {
        let storage = window.localStorage;
        if (storage) {
            let lang = storage["lang"];
            if (lang) {
                this.wallet.lang = lang;
            }
            let chain = storage["chain"];
            console.log('chain', chain)
            if (chain && this.configs[chain]) {
                this.wallet.chainConfig = this.configs[chain];
                this.wallet.chainSymbol = this.configs[chain].Symbol;
            }
        }
        this.notifyAll();
    }

    //连接钱包
    async connetWallet() {
        let provider = Web3.givenProvider || window.ethereum;
        if (provider) {
            Web3.givenProvider = provider;
            const web3 = new Web3(provider);
            const chainId = await web3.eth.getChainId();
            this.wallet.chainId = chainId;
            const accounts = await web3.eth.requestAccounts();
            this.wallet.account = accounts[0];
            this.notifyAll();
        } else {
            //连接不上，3秒后尝试连接
            setTimeout(() => {
                this.connetWallet();
            }, 3000);
        }
    }

    //修改语言
    changeLang(lang) {
        this.wallet.lang = lang;
        var storage = window.localStorage;
        if (storage) {
            storage["lang"] = lang;
        }
        this.notifyAll();
    }

    //切换应用里的链
    changeChain(chain) {
        this.wallet.chain = chain;
        this.wallet.chainConfig = this.configs[chain];
        var storage = window.localStorage;
        if (storage) {
            storage["chain"] = chain;
        }
        this.notifyAll();
    }

    //监听状态变化，新页面需要监听钱包和配置变化
    onStateChanged(cb) {
        this.listeners.push(cb);
    }

    //移除状态监听
    removeListener(cb) {
        this.listeners = this.listeners.filter(item => item !== cb);
    }

    //状态通知监听器，状态发生变化
    notifyAll() {
        for (let i = 0; i < this.listeners.length; i++) {
            const cb = this.listeners[i];
            cb();
        }
    }

}
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const MAX_INT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export default new WalletState();