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

app.post('/topUpCashCard', async(req, res) => {
    const ftp = new ftpClient();
    let cash = req.body.cash;

    let cardID = ""
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        cardID = response.data.message
    }catch(error){
        cardID = ""
    }

    try{
        ftp.connect({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD
        });
    
        ftp.on('ready', () => {
            const folderName = 'DATABASE';
            const filename = folderName + `/${cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        
                        // อัปเดตข้อมูลใน JSON
                        jsonData.cash += cash; // ลดจำนวนเงินในบัญชี
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonData);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                res.status(200).json(jsonData); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/createTransactionTopUp', async(req, res) => {
    const ftp = new ftpClient();

    let cardID = ""
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        cardID = response.data.message
    }catch(error){
        cardID = ""
    }

    try {
        const cash = req.body.cash;

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // เพิ่ม 1 เนื่องจาก getMonth() เริ่มจาก 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const formattedCurrentDate = `${year}-${month}-${day}`; // ใส่ backtick (`) และเพิ่ม ${} ครอบตัวแปร

        const jsonData = {
            transaction:[
                {
                    cash: cash,
                    timestamp: formattedCurrentDate
                }
            ]
            
        };

        const folderName = 'TOPUP'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "TOPUP" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "TOPUP" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "TOPUP" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "TOPUP" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function updateJsonFile(){
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);
                        jsonDataNew.transaction.push({
                            cash: cash,
                            timestamp: formattedCurrentDate
                        });
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        }

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    updateJsonFile();
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

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