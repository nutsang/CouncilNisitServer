const cors = require('cors')
const path = require('path')
const dotenv = require('dotenv')
const express = require('express')
const nodemailer = require('nodemailer')
const morgan = require('morgan')
const ftpClient = require('ftp')
const fs = require('fs')
const axios = require('axios');

const app = express()
dotenv.config({ path: path.join(__dirname, 'server.env') })
app.use(express.json())
app.use(cors())
app.use(morgan('dev'))

let verifyOTP = ''

app.get('/verify-member', async (req, res) => {
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        if(response.data.status){
            const ftp = new ftpClient()
            ftp.connect({
                host: process.env.HOST,
                user: process.env.USER,
                password: process.env.PASSWORD
            })
            ftp.on('ready', () => {
                const FOLDER_NAME = 'DATABASE'
                const fileName = FOLDER_NAME + `/${response.data.message}.json`
                ftp.get(fileName, (error, stream) => {
                    if(error){
                        res.status(200).json({'status': false, 'message': 'ข้อมูลบัตรสมาชิกไม่ถูกต้อง'})
                        return
                    }
                    let data = ''
                    stream.on('data', (chunk) => {
                        data += chunk.toString()
                    })
                    stream.on('end', (data) => {
                       try{
                        res.status(200).json({'status': true, 'message': 'เข้าสู่ระบบสำเร็จ'})
                        ftp.end()
                       }catch(error){
                        res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
                       }
                    })
                })
            })
        }else{
            if(response.data.message == 'ไม่พบเครื่องอ่านบัตร'){
                res.status(500).json(response.data)
                return
            }else{
                res.status(404).json(response.data)
                return
            }
        }
    }catch(error){
        res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
        return
    }
})

app.post('/register', async (req, res) => {
    let cardID = ""
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        cardID = response.data.message
    }catch(error){
        cardID = ""
    }
    const studentId = req.body.studentId
    const studentName = req.body.studentName
    const studentLastName = req.body.studentLastName
    const username = req.body.username
    const cash = 0
    const point = 0

    const jsonData = {
        cardID: cardID,
        studentId: studentId,
        studentName: studentName,
        studentLastName: studentLastName,
        username: username,
        cash: cash,
        point: point
    }
    try{
        const ftp = new ftpClient()
        ftp.connect({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD
        })
        ftp.on('ready', () => {
            const FOLDER_NAME = 'DATABASE'
            const fileName = FOLDER_NAME + `/${cardID}.json`
            ftp.list('/', (error, list) => {
                if(error){
                    res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
                    return
                }
                const folderExists = list.some(item => item.type === 'd' && item.name === FOLDER_NAME)
                if(!folderExists){
                    ftp.mkdir(FOLDER_NAME, (err) => {
                        if (err) {
                            res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
                            return
                        }
                    });
                }
                ftp.size(fileName, (err) => {
                    const jsonString = JSON.stringify(jsonData)
                    if (err) {
                        ftp.put(Buffer.from(jsonString), fileName, (err) => {
                            if(err){
                                res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
                                return
                            }else{
                                ftp.end()
                                res.status(200).json({'status': true, 'message': 'สมัครสมาชิกสำเร็จ'})
                                return
                            }
                        })
                    }else{
                        res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
                        return
                    }
                })
            })
        })
    }catch(error){
        res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
        return
    }
})

app.post('/sendOTP', async (req, res) => {
    const username = req.body.username
    const smtpUsername = process.env.SMTPUSERNAME
    const smtpPassword = process.env.SMTPPASSWORD
    const minOTP = 100000
    const maxOTP = 999999
    const OTP = (Math.floor(minOTP + Math.random() * (maxOTP - minOTP))).toString()
    try{
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpUsername,
                pass: smtpPassword
            }
        })
        const verify = await transporter.verify()
        if(verify){
            const mailOptions = {
                from: smtpUsername,
                to: `${username}@ku.th`,
                subject: `OTP จาก ${smtpUsername}`,
                text: `รหัส OTP ของคุณคือ ${OTP}`
            }

            await transporter.sendMail(mailOptions)
            verifyOTP = OTP
            res.status(200).json({'status': true, 'message': 'กรุณาตรวจสอบอีเมล'})
            return
        }else{
            res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
            return
        }
    }catch(error){
        res.status(500).json({'status': false, 'message': 'สมัครสมาชิกไม่สำเร็จ'})
        return
    }
})

app.post('/verify-otp', async (req, res) => {
    const recivedOTP = req.body.recivedOTP
    if(recivedOTP === verifyOTP){
        res.status(200).json({'status': true, 'message': 'ยืนยัน OTP สำเร็จ'})
    }else{
        res.status(200).json({'status': false, 'message': 'รหัส OTP ไม่ถูกต้อง'})
    }
})

app.get('/profile', async (req, res) => {
    let cardID = ""
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        cardID = response.data.message
    }catch(error){
        cardID = ""
    }
    try{
        const ftp = new ftpClient()
        ftp.connect({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD
        })
        ftp.on('ready', () => {
            const FOLDER_NAME = 'DATABASE'
            const fileName = FOLDER_NAME + `/${cardID}.json`
            ftp.get(fileName, (error, stream) => {
                if(error){
                    res.status(200).json({'status': false, 'message': 'ข้อมูลบัตรสมาชิกไม่ถูกต้อง'})
                    return
                }
                let data = ''
                stream.on('data', (chunk) => {
                    data += chunk.toString()
                })
                stream.on('end', () => {
                   try{
                    const jsonData = JSON.parse(data)
                    res.status(200).json({'status': true, 'message': jsonData})
                    ftp.end()
                   }catch(error){
                    res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...2'})
                   }
                })
            })
        })
    }catch(error){
        res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
        return
    }
})

app.get('/redeem-items', async (req, res) => {
    const filePath = path.join(__dirname, 'redeem-items.json')
    fs.readFile(filePath, 'utf-8', (err, data) => {
        if(err){
            res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
            return
        }
        try{
            const redeemItemsData = JSON.parse(data)
            res.status(200).json({'status': true, 'message': redeemItemsData.redeemItems})
            return
        }catch(error){
            res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
            return
        }
    })
})

app.post('/calculate-point', async (req, res) => {
    try{
        const response = await axios.get(`${process.env.SERVER}profile`)
        if(response.data.status){
            const point = response.data.message.point
            const redeemItems = req.body.redeemItems
            const totalPoint = redeemItems.map((item)=>{return item.point*item.amount}).reduce((a,b)=>a+b)
            if(point >= totalPoint){
                res.status(200).json({'status': true, 'message': 'จำนวนแต้มเพียงพอ'})
                return
            }else{
                res.status(500).json({'status': false, 'message': 'จำนวนแต้มไม่เพียงพอ'})
                return
            }
        }else{
            res.status(500).json({'status': false, 'message': 'จำนวนแต้มไม่เพียงพอ'})
            return
        }
    }catch(error){
        console.log(error)
        res.status(500).json({'status': false, 'message': 'จำนวนแต้มไม่เพียงพอ'})
        return
    }
})

app.post('/log-redeem', async (req, res) => {
    const cardID = req.body.cardID
    const redeemItems = req.body.redeemItems
    const redeemItemsFilter = redeemItems.filter((item)=>item.amount > 0)
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0')
    const day = currentDate.getDate().toString().padStart(2, '0')
    const formattedCurrentDate = `${year}-${month}-${day}`
    const jsonData = {
        transaction:[
            {
                product: redeemItemsFilter,
                timestamp: formattedCurrentDate
            }
        ]
    }
    try{
        const ftp = new ftpClient()
        ftp.connect({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD
        })
        ftp.on('ready', () => {
            const FOLDER_NAME = 'REDEEM'
            const fileName = FOLDER_NAME + `/${cardID}.json`
            ftp.list('/', (err, list) => {
                if(err){
                    res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
                    return  
                }

                const folderExists = list.some(item => item.type === 'd' && item.name === FOLDER_NAME)
                if(!folderExists){
                    ftp.mkdir(FOLDER_NAME, (err) => {
                        if (err) {
                            res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
                            return
                        }
                    }) 
                }
                createJsonFile()
                const updateJsonFile = () => {
                    ftp.get(fileName, (err, stream) => {
                        if(err){
                            res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
                            return
                        }
                        let data = ''
                        stream.on('data', chunk => {
                            data += chunk.toString()
                        })
                        stream.on('end', () => {
                            try{
                                let jsonDataNew = JSON.parse(data)
                                jsonDataNew.transaction.push({
                                    product: redeemItemsFilter,
                                    timestamp: formattedCurrentDate
                                })
                                const updatedData = JSON.stringify(jsonDataNew)
                                ftp.put(Buffer.from(updatedData), fileName, (err) => {
                                    if (err) {
                                        res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
                                    } else {
                                        res.status(200).json({'status': true, 'message': 'บันทึกธุรกรรมสำเร็จ'})
                                    }
                                    ftp.end()
                                });
                            }catch(error){
                                res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
                                return 
                            }
                        })
                    })
                }
                function createJsonFile() {
                    ftp.size(fileName, (err, size) => {
                        const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                        if (!err) {
                            updateJsonFile();
                            return;
                        }
        
                        ftp.put(Buffer.from(jsonString), fileName, (err) => {
                            if (err) {
                                console.error("Error occurred while writing JSON file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log("Write successful:", fileName);
                                ftp.end(); // ปิดการเชื่อมต่อ FTP
                                res.status(200).send("Write successful");
                            }
                        });
                    });
                }
            })
        })
    }catch(error){
        res.status(500).json({'status': false, 'message': 'บันทึกธุรกรรมล้มเหลว'})
        return
    }
})

app.post('/redeem', async (req, res) => {
    let cardID = ""
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        cardID = response.data.message
    }catch(error){
        cardID = ""
    }
    try{
        const response = await axios.get(`${process.env.SERVER}profile`)
        if(response.data.status){
            const point = response.data.message.point
            const redeemItems = req.body.redeemItems
            const totalPoint = redeemItems.map((item)=>{return item.point*item.amount}).reduce((a,b)=>a+b)
            if(point >= totalPoint){
                try{
                    const ftp = new ftpClient()
                    ftp.connect({
                        host: process.env.HOST,
                        user: process.env.USER,
                        password: process.env.PASSWORD
                    })
                    ftp.on('ready', () => {
                        const FOLDER_NAME = 'DATABASE'
                        const fileName = FOLDER_NAME + `/${cardID}.json`
                        ftp.get(fileName, (error, stream) => {
                            if(error){
                                res.status(200).json({'status': false, 'message': 'ข้อมูลบัตรสมาชิกไม่ถูกต้อง'})
                                return
                            }
                            let data = ''
                            stream.on('data', (chunk) => {
                                data += chunk.toString()
                            })
                            stream.on('end', () => {
                               try{
                                const jsonData = JSON.parse(data)
                                if(jsonData.point >= totalPoint){
                                    jsonData.point -= totalPoint
                                }else{
                                    res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
                                    return
                                }
                                const updatedData = JSON.stringify(jsonData)
                                ftp.put(Buffer.from(updatedData), fileName, async (err) => {
                                    if(err){
                                        res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
                                        return
                                    }else{
                                        try{
                                            const response = await axios.post(`${process.env.SERVER}log-redeem`, {
                                                cardID: cardID,
                                                redeemItems: redeemItems})
                                        }catch(error){
                                            console.log(error.response)
                                        }
                                        res.status(200).json({'status': true, 'message': jsonData})
                                        ftp.end()
                                        return
                                    }
                                })
                               }catch(error){
                                res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
                                return
                               }
                            })
                        })
                    })
                }catch(error){
                    res.status(500).json({'status': false, 'message': 'เซิฟเวอร์กำลังปิดปรับปรุง...'})
                    return
                }
            }else{
                res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
                return
            }
        }else{
            res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
            return
        }
    }catch(error){
        res.status(500).json({'status': false, 'message': 'แลกสินค้าล้มเหลว'})
        return
    }
})

const port = process.env.PORT || 3001
const server = app.listen(port, () => {
    console.log(`เปิดเซิร์ฟเวอร์ด้วยพอร์ต ${port} สำเร็จ`)
    console.log(`ที่อยู่เซิร์ฟเวอร์ http://localhost:${port}/`)
})
server.on('error', (error) => {
    console.error(`เปิดเซิร์ฟเวอร์ด้วยพอร์ต ${error.address} ล้มเหลว`)
    server.close(() => {
        console.error('เซิร์ฟเวอร์ปิดตัวลงเรียบร้อย')
    })
})