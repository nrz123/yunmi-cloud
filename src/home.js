import React from 'react'
import {Table,Button} from 'antd'
import './home.css'
const {ipcRenderer}=window.require('electron')
class Home extends React.Component {
    constructor(props) {
        super(props)
        this.state={
            connect:0,
            tasks:[],
        }
    }
    remove=sliceId=>{
        let index=this.state.tasks.findIndex(d=>d.sliceId==sliceId)
        if(index<0)return
        this.state.tasks.splice(index,1)
        this.setState({})
    }
    add=task=>{
        this.state.tasks.push(task)
        this.setState({})
    }
    sumAdd=(sliceId,sum)=>{
        let task=this.state.tasks.find(d=>d.sliceId==sliceId)
        if(!task)return
        task.sum=sum+(task.sum?task.sum:0)
        this.setState({})
    }
    componentDidMount=()=>{
        let cnumber=0
        ipcRenderer.on('data',(event,sliceId,length)=>{
            console.log(length)
            this.sumAdd(sliceId,length)
        })
        ipcRenderer.on('end',(event,sliceId)=>{
            this.remove(sliceId)
        })
        ipcRenderer.on('add',(event,task)=>{
            this.add(task)
        })
        ipcRenderer.on('cnumber',(event,change)=>{
            cnumber+=change
            this.setState({connect:cnumber})
        })
    }
    render(){
        return(
            <div style={{width:'100%',height:'100%'}}>
                <div style={{width:'100%',height:'35px'}}>
                    <Button onClick={()=>{
                    }} style={{width:'100%',height:'100%'}}>
                        {"连接数:"+this.state.connect}
                    </Button>
                </div>
                <Table style={{width:'100%',height:'calc(100% - 35px)'}} pagination={false} columns={[{
                    title: '任务名',
                    dataIndex: 'name',
                    key: 'name',
                },{
                    title: '采集量',
                    dataIndex: 'sum',
                    key: 'sum',
                }]} dataSource={this.state.tasks.map(task=>{
                    let {name,sum}=task
                    return {name:name,sum:sum?sum:0}
                })}/>
            </div>
        )
    }
}
export default Home