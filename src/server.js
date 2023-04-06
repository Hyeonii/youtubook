const express = require('express');
const spawn = require('child_process').spawn;
const app = express();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const ROOT_DIR = path.resolve(__dirname, '..');

app.use(express.static('screens'));

app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/screens/index.html');
});

io.on('connection', (socket) => {
    // console.log('a user connected');

    socket.on('chat message', (msg) => {
        // 생성된 내용 받아서 화면에 표시
        io.emit('chat message', msg);

        const convertToWav = spawn('python', [__dirname + '/python/convertToWav.py', msg]);

        convertToWav.stdout.on('data', function(data) {
            // Convert the Buffer object to a regular string
            const videoTitle = data.toString('utf-8').trim();

            console.log('-----------------------');
            console.log('videoTitle =>' + videoTitle);

            const wavFilePath = path.join(ROOT_DIR, 'public', 'wav', videoTitle);
            const downloadFolderPath = ROOT_DIR + '\\public\\txt';
            console.log('command =>', 'whisper', wavFilePath, '--output_dir', downloadFolderPath);
            const convertToText = spawn('whisper', [wavFilePath, '--output_dir', downloadFolderPath]);
            console.log('-----------------------');

            convertToText.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
                
            convertToText.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });
        });
        
        convertToWav.stderr.on('data', function(data) {
            console.log('-----------------------');
            console.log('에러 발생 =>', data.toString());
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

http.listen(8080, () => {
    console.log('listening on *:8080');
});