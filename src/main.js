const { app, BrowserWindow, Menu, session, ipcMain, net } = require('electron')
const { Run } = require('./run.js')
const WebSocket = require('ws')
const crypto = require('crypto')
app.commandLine.appendSwitch('disable-site-isolation-trials')
app.commandLine.appendSwitch('--disable-web-security')
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')
app.commandLine.appendSwitch('disable-features', 'UserAgentClientHint')
let isDev = !app.isPackaged
Menu.setApplicationMenu(null)
let protocal = 'http://'
let serverHost = '127.0.0.1:80'
let password = ''
let taskNumber = 5
let force = false
let appPath = app.getAppPath()
ipcMain.on('downloaddir', event => event.returnValue = protocal + serverHost)
let login = () => net.fetch(protocal + serverHost + '/users/login', {
    method: "POST",
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        password: password
    })
}).then(res => res.json())
let ck = async url => {
    let ret = ''
    let cookies = await session.defaultSession.cookies.get({ url: url })
    cookies.forEach(cookie => {
        ret += (cookie.name + '=' + cookie.value + ';')
    })
    return ret
}
ipcMain.on('protocal', event => event.returnValue = protocal)
ipcMain.on('serverHost', event => event.returnValue = serverHost)
ipcMain.on('password', event => event.returnValue = password)
ipcMain.on('taskNumber', event => event.returnValue = taskNumber)
let startRun = win => {
    for (let i = 0; i < taskNumber; i++) {
        let connect = () => login().then(async data => {
            if (data != 'success') return setTimeout(connect, 13000)
            let run = undefined
            let url = (protocal == 'http://' ? 'ws://' : 'wss://') + serverHost + '/cloud/ws'
            let cookie = await ck(url)
            let ws = new WebSocket(url, {
                headers: {
                    'Cookie': cookie
                }
            })
            win.webContents.send('cnumber', 1)
            ws.onmessage = event => {
                let data = JSON.parse(event.data)
                switch (data.type) {
                    case 'run': {
                        if (run) break
                        net.fetch(protocal + serverHost + "/cloud/task", {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        }).then(res => res.json()).then(task => {
                            if (!task) return
                            if (run) return
                            let { sliceId, id, step } = task
                            let w = new BrowserWindow({
                                width: 1200,
                                height: 800,
                                resizable: false
                            })
                            run = new Run(step, appPath + '/src' + '/preload.js', sliceId, w)
                            run.log = console.log
                            run.checkData = () => new Promise(resolve => {
                                net.fetch(protocal + serverHost + "/cloud/checkData", {
                                    method: "POST",
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        id: id,
                                        data: run.data
                                    })
                                }).then(res => res.json()).then(ret => {
                                    resolve(ret == 'exist')
                                })
                            })
                            w.on('closed', () => run.stop())
                            win.webContents.send('add', task)
                            let datas = []
                            let senddata = () => {
                                net.fetch(protocal + serverHost + "/cloud/data", {
                                    method: "POST",
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        id: id,
                                        datas: datas
                                    })
                                })
                                win.webContents.send('data', sliceId, datas.length)
                                datas.length = 0
                            }
                            run.on('data', data => {
                                datas.push(data.map(d => {
                                    if (d.type == 'IMG') {
                                        let value = d.value
                                        value = value.substring(22)
                                        value = Buffer.from(value, 'base64')
                                        let form_data = new FormData();
                                        let b = new Blob([value], { type: 'application/octet-stream' })
                                        let fname = crypto.createHash('md5').update(value).digest('hex')
                                        d.value = fname + '.png'
                                        form_data.append("file", b, d.value)
                                        net.fetch(protocal + serverHost + "/cloud/upload", { method: "POST", body: form_data })
                                    }
                                    return d
                                }))
                                if (datas.length < 1) return
                                senddata()
                            })
                            run.on('end', e => {
                                run.removeAllListeners()
                                run = undefined
                                win.webContents.send('end', sliceId)
                                datas.length > 0 && senddata()
                                net.fetch(protocal + serverHost + "/cloud/end", {
                                    method: "POST",
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        sliceId: sliceId
                                    })
                                })
                            })
                            run.start()
                        }).catch(e => {
                        })
                    } break
                    case 'stop': {
                        if (!run) break
                        run.stop()
                    } break
                    default:
                        break;
                }
            }
            ws.onerror = () => { }
            ws.onclose = () => {
                win.webContents.send('cnumber', -1)
                if (!run) return setTimeout(connect, 13000)
                run.removeAllListeners()
                run.on('end', e => {
                    run.removeAllListeners()
                    win.webContents.send('end', run.id)
                    run = undefined
                    setTimeout(connect, 13000)
                })
                run.stop()
            }
        }).catch(e => setTimeout(connect, 13000))
        connect()
    }
}
let init = async () => {
    let cookies = await session.defaultSession.cookies.get({ url: "http://127.0.0.1:52126" })
    cookies.forEach(cookie => {
        if (cookie.name == 'serverHost') serverHost = cookie.value
        if (cookie.name == 'protocal') protocal = cookie.value
        if (cookie.name == 'password') password = cookie.value
        if (cookie.name == 'taskNumber') taskNumber = parseInt(cookie.value)
    })
    let len = process.argv.length
    for (let i = 1; i < len; i++) {
        let arg = process.argv[i]
        switch (arg) {
            case '-u': {
                let url = process.argv[++i]
                let list = url.split('://')
                if (list.length > 1) {
                    protocal = list[0] + '://'
                    serverHost = list[1]
                }
            }; break
            case '-p': password = process.argv[++i]; break
            case '-n': taskNumber = parseInt(process.argv[++i]); break
            case '-f': force = true; break
        }
    }
}
let createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        }
    })
    //win.webContents.openDevTools()
    win.webContents.loadURL(isDev ? 'http://127.0.0.1:3001/' : 'file:///' + appPath + '/build/index.html')
    win.on('closed', () => app.quit())
    win.webContents.on('dom-ready', () => {
        startRun(win)
    })
}
let start = async () => {
    await init()
    if (force) {
        return login().then(data => {
            if (data == 'success') {
                console.log('登录成功')
                return createWindow()
            }
            console.log('登录失败,程序退出')
            app.quit()
        }).catch(e => {
            console.log('登录失败,程序退出')
            app.quit()
        })
    }
    const win = new BrowserWindow({
        width: 300,
        height: 400,
        resizable: false,
        scrollBounce: false,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        }
    })
    win.webContents.on('ipc-message', (event, channel, value) => {
        if (channel == 'login') {
            protocal = value.protocal
            serverHost = value.serverHost
            password = value.password
            taskNumber = value.taskNumber
            let date = Math.round(new Date().getTime() / 1000) + 30 * 24 * 60 * 60
            session.defaultSession.cookies.set({ url: "http://127.0.0.1:52126", name: 'protocal', value: protocal, expirationDate: date })
            session.defaultSession.cookies.set({ url: "http://127.0.0.1:52126", name: 'serverHost', value: serverHost, expirationDate: date })
            session.defaultSession.cookies.set({ url: "http://127.0.0.1:52126", name: 'password', value: password, expirationDate: date })
            session.defaultSession.cookies.set({ url: "http://127.0.0.1:52126", name: 'taskNumber', value: '' + taskNumber, expirationDate: date })
            login().then(data => {
                if (data == 'success') {
                    console.log('登录成功')
                    createWindow()
                    win.destroy()
                    return
                }
                console.log('登录失败')
                win.webContents.send('message', '登录失败')
            }).catch(e => {
                console.log('登录失败')
                win.webContents.send('message', '登录失败')
            })
        }
    })
    win.webContents.loadURL(isDev ? 'http://127.0.0.1:3001/#set' : 'file:///' + appPath + '/build/index.html#set')
}
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
app.whenReady().then(start)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        start()
    }
})
let videoMap = {}
let vend = (webContents, fid) => {
    let fmap = videoMap[webContents]
    if (fmap) {
        let umap = fmap[fid]
        if (umap) {
            let filenames = [], codecs = []
            for (let uid in umap) {
                if (umap[uid]) {
                    umap[uid].stream.close()
                    let index = umap[uid].mimeType.indexOf('codecs=')
                    index > -1 && codecs.push(umap[uid].mimeType.slice(index + 7).replace(new RegExp('"', 'g'), ''))
                    filenames.push(umap[uid].filename)
                }
            }
            Promise.all(filenames.map(async filename => {
                let url = (protocal == 'http://' ? 'ws://' : 'wss://') + serverHost + '/cloud/upws'
                let cookie = await ck(url)
                let ws = new WebSocket(url, {
                    headers: {
                        'filename': fid + '/' + filename + 'v.m3u8',
                        'Cookie': cookie
                    }
                })
                await new Promise(resolve => {
                    ws.onopen = () => setTimeout(resolve, 100)
                })
                ws.binaryType = 'arraybuffer'
                ws.send('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n' + filename + '.mp4\n#EXT-X-ENDLIST')
                ws.close()
                ws = new WebSocket(url, {
                    headers: {
                        'filename': fid + '/' + filename + '.m3u8',
                        'Cookie': cookie
                    }
                })
                await new Promise(resolve => {
                    ws.onopen = () => setTimeout(resolve, 100)
                })
                ws.binaryType = 'arraybuffer'
                ws.send('#EXTM3U\n#EXT-X-STREAM-INF:CODECS="' + codecs.join() + '"\n' + filename + 'v.m3u8')
                ws.close()
            })).then(() => {
                net.fetch(protocal + serverHost + "/cloud/upend", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'folder': fid,
                        'files': filenames
                    })
                })
            })
            delete fmap[fid]
        }
    }
}
ipcMain.on('videoend', async (event, fid) => {
    vend(event.sender, fid)
})
ipcMain.on('video', async (event, fid, uid, mimeType, buffer) => {
    let webContents = event.sender
    if (!videoMap[webContents]) {
        videoMap[webContents] = {}
        webContents.on('destroyed', async () => {
            let fmap = videoMap[webContents]
            if (fmap) {
                for (let fid in fmap) {
                    vend(webContents, fid)
                }
            }
            delete videoMap[webContents]
        })
    }
    let fmap = videoMap[webContents]
    if (!fmap[fid]) {
        fmap[fid] = {}
    }
    let umap = fmap[fid]
    if (!umap[uid]) {
        let filename = 'video' + Object.keys(umap).length
        let url = (protocal == 'http://' ? 'ws://' : 'wss://') + serverHost + '/cloud/upws'
        let cookie = await ck(url)
        let ws = new WebSocket(url, {
            headers: {
                'filename': fid + '/' + filename + '.mp4',
                'Cookie': cookie
            }
        })
        await new Promise(resolve => {
            ws.onopen = () => setTimeout(resolve, 100)
        })
        ws.binaryType = 'arraybuffer'
        umap[uid] = { stream: ws, mimeType: mimeType, filename: filename }
    }
    let fBuffer = Buffer.from(buffer)
    umap[uid].stream.send(fBuffer)
    event.returnValue = true
})