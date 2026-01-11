import React from 'react'
import './home.css'
import {Progress} from 'antd'
class Update extends React.Component {
    constructor(props) {
        super(props)
        this.state={}
    }
    componentDidMount(){
        if(!window.require)return
        const {ipcRenderer}=window.require('electron')
        ipcRenderer.on('download',(event,progressObj)=>this.setState({percent:parseInt(progressObj.percent)}))
    }
    render(){
        if(!window.require)return <div style={{width:'100%',height:'100%'}}></div>
        return(
            <div style={{width:'100%',height:'100%'}}>
                <Progress style={{
                    position:'absolute',
                    left:'50%',
                    transform: 'translateX(-50%)',
                    top:'80px'
                }} type="circle" percent={this.state.percent} />
                <p style={{
                    position:'absolute',
                    left:'50%',
                    transform: 'translateX(-50%)',
                    bottom:'80px'
                }}>正在更新请勿关闭</p>
            </div>
        )
    }
}
export default Update