import React, { Component } from 'react'
import { withNavigation } from '../../hocs'
import Web3 from 'web3'
import loading from '../../components/loading/Loading';
import toast from '../../components/toast/toast';
import "../ImportVip/ImportVip.css"
import '../Token/Token.css'
import { CSVLink } from "react-csv";
import Header from '../Header';

class CreateWallet extends Component {
    state = {
        num: "",
        wallets: [],
        address: []
    }

    constructor(props) {
        super(props);
        this.createWallet = this.createWallet.bind(this);
        this.handleNumChange = this.handleNumChange.bind(this);
    }

    componentDidMount() {

    }

    componentWillUnmount() {

    }

    filename() {
        var time = new Date().format("yyyy-MM-dd-HH-mm-ss", "en");
        return "wallets-" + time + ".csv";
    }

    handleNumChange(event) {
        let value = this.state.num;
        if (event.target.validity.valid) {
            value = event.target.value;
        }
        this.setState({ num: value });
    }

    async createWallet() {
        if (!this.state.num) {
            toast.show("请输入要创建的钱包数量");
            return;
        }
        loading.show();
        let num = parseInt(this.state.num);
        setTimeout(() => {
            this._createWallet(num);
        }, 30);
    }

    async _createWallet(num) {
        let walletList = [];
        try {
            const web3 = new Web3(Web3.givenProvider);
            let num = parseInt(this.state.num);
            for (let i = 0; i < num; i++) {
                let account = web3.eth.accounts.create();
                walletList.push({ address: account.address, privateKey: account.privateKey });
            }
            this.setState({ wallets: walletList });
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

                <input className="ModuleBg ModuleTop Contract" type="text" value={this.state.num} onChange={this.handleNumChange} pattern="[0-9]*" placeholder='输入创建钱包数量' />

                <div className='ModuleTop flex'>
                    <div className="approveUsdt" onClick={this.createWallet.bind(this)}>创建钱包</div>
                    <CSVLink className="approveToken" data={this.state.wallets} filename={this.filename}>导出钱包</CSVLink>
                </div>

                {
                    this.state.wallets.map((item, index) => {
                        return <div key={index} className="mt10 Item column">
                            <div className='text'>{index + 1}. 地址：{item.address}</div>
                            <div className='text ml15'>私钥：{item.privateKey}</div>
                        </div>
                    })
                }

                <div className='mb40'></div>
            </div>
        );
    }
}

export default withNavigation(CreateWallet);