const cors = require('cors')
const path = require('path')
const dotenv = require('dotenv')
const express = require('express')
const morgan = require('morgan')
const Client = require('ftp')
const fs = require('fs')
const axios = require('axios');

const app = express()
dotenv.config({ path: path.join(__dirname, 'server.env') })
app.use(express.json())
app.use(cors())
app.use(morgan('dev'))

app.get('/verify-member', async (req, res) => {
    try{
        const response = await axios.get(`${process.env.ACR122U}`)
        if(response.data.status){
            res.status(200).json(response.data)
            return
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