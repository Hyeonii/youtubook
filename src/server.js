const spawn = require('child_process').spawn;
const express = require('express');
const app = express();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static('screens'));

app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/screens/index.html');
});

const ROOT_DIR = path.resolve(__dirname, '..');

io.on('connection', (socket) => {
    let type = 'API';
    console.log('a user connected');

    socket.on('change type', (msg) => {
        type = msg;
    })

    socket.on('chat message', (msg) => {
        // Starting the process of converting a YouTube video to MP4.
        const convertToWav = spawn('python', [__dirname + '/python/convertToMP4.py', msg]);

        // When Converting Video to MP4 is successed.
        convertToWav.stdout.on('data', async function(data) {
            const mp4CreatedTime = new Date();
            const mp4CreatedTimeString = mp4CreatedTime.toLocaleTimeString();
            io.emit('chat message', `${type}) MP4 file extraction successful. ${mp4CreatedTimeString}`);
            // Convert the Buffer object to a regular string
            const videoTitle = data.toString('utf-8').trim();
            const wavFilePath = path.join(ROOT_DIR, 'public', 'wav', videoTitle);

            // Starting the process of converting a MP4 file to txt and changing the conversion method by type.
            const downloadFolderPath = ROOT_DIR + '\\public\\txt';
            const convertToText = type === 'API' 
                ? spawn('python', [__dirname + '/python/convertToText.py', wavFilePath]) 
                : spawn('whisper', [wavFilePath, '--output_dir', downloadFolderPath, '--output_format', 'txt'], {
                    env: {
                      PYTHONIOENCODING: 'utf-8'
                    }
                });

            convertToText.stdout.on('data', (data) => {
                // Check modified time.
                const txtCreatedTime = new Date();
                const txtCreatedTimeString = txtCreatedTime.toLocaleTimeString();
                const diffInMilliseconds = txtCreatedTime.getTime() - mp4CreatedTime.getTime();
                const diffInSeconds = Math.floor(diffInMilliseconds / 1000);

                const sendResult = (result) => {
                    io.emit('chat message', `${type}) Text file extraction successful. ${txtCreatedTimeString}\nText conversion time: ${diffInSeconds}s\n${result}`);
                }

                // The result is processed according to the conversion type.
                if (type === 'API') {
                    sendResult(data.toString('utf-8').trim());

                } else if (type === 'Local') {
                    const textTitle = videoTitle.replace('.mp4', '.txt');

                    fs.readFile(path.join(ROOT_DIR, 'public', 'txt', textTitle), 'utf-8', (err, txtData) => {
                        if (err) {
                            io.emit('chat message', `${type}) Text file conversion has failed.`);
                            return;
                        }
                        sendResult(txtData);
                    });
                }
            });

            // When a whisper conversion process encounters an error.
            convertToText.stderr.on('data', (data) => {
                const error = data.toString('utf-8').trim();
                console.log(`${type}) Text file conversion has failed.\n${error}`)
                io.emit('chat message', `${type}) Text file conversion has failed.`);
            });

        });
        
        convertToWav.stderr.on('data', function(data) {
            io.emit('chat message', `${type}) MP4 file extraction failed.`);
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

http.listen(8080, () => {
    console.log('listening on *:8080');
});