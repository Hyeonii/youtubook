const spawn = require('child_process').spawn;
const express = require('express');
const app = express();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const iconv = require('iconv-lite');
const fs = require('fs');

app.use(express.static('screens'));

app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/screens/index.html');
});

const ROOT_DIR = path.resolve(__dirname, '..');
const clients = {};

io.on('connection', (socket) => {
    // Add client's socket data
    let type = 'API';
    clients[socket.client.id] = socket;
    console.log(`user connected from ${socket.handshake.address} / ${socket.client.id} / count: ${Object.keys(clients).length}`);
    
    // Change the conversion type.
    socket.on('change type', (msg) => {
        type = msg;
    })

    // Send shared message to every one in this server.
    socket.on('share message', (msg) => {
        io.emit('share message', `${msg}`);
    })
    
    socket.on('chat message', (msg) => {
        // Starting the process of converting a YouTube video to MP4.
        const regex = /https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)[a-zA-Z0-9]+/
        const regexMatched = msg.match(regex);
        
        if (!regexMatched) {
            socket.emit('chat message', `${type}) This is an invalid YouTube URL.`);
            return
        }
        const youtubeUrl = regexMatched[0];
        const convertToMP4 = spawn('python', [__dirname + '/python/convertToMP4.py', youtubeUrl]);

        // When Converting Video to MP4 is successed.
        convertToMP4.stdout.on('data', async function(data) {
            const mp4CreatedTime = new Date();
            const mp4CreatedTimeString = mp4CreatedTime.toLocaleTimeString();
            socket.emit('chat message', `${type}) MP4 file extraction successful. ${mp4CreatedTimeString}`);

            // Convert the Buffer object to a regular string
            const videoTitle = data.toString('utf-8').trim();
            const wavFilePath = path.join(ROOT_DIR, 'public', 'wav', videoTitle);
            
            // Starting the process of converting a MP4 file to txt and changing the conversion method by type.
            const downloadFolderPath = ROOT_DIR + '\\public\\txt';
            const convertToText = type === 'API' 
                ? spawn('python', [__dirname + '/python/convertToText.py', wavFilePath]) 
                : spawn('whisper', [wavFilePath, '--output_dir', downloadFolderPath, '--output_format', 'txt', '--word_timestamps'], {
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
                    socket.emit('chat message', `${type}) Text file extraction successful. ${txtCreatedTimeString}\nText conversion time: ${diffInSeconds}s\nYoutube URL: ${youtubeUrl}\n${result}`);
                }

                // The result is processed according to the conversion type.
                if (type === 'API') {
                    sendResult(data.toString('utf-8').trim());

                } else if (type === 'Local') {
                    const textTitle = videoTitle.replace('.mp4', '.txt');

                    fs.readFile(path.join(ROOT_DIR, 'public', 'txt', textTitle), 'utf-8', (err, txtData) => {
                        if (err) {
                            socket.emit('chat message', `${type}) Text file conversion has failed.`);
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
                socket.emit('chat message', `${type}) Text file conversion has failed.`);
            });         
        });
        
        convertToMP4.stderr.on('data', function(data) {
            socket.emit('chat message', `${type}) MP4 file extraction failed.`);
        });
    });

    socket.on('search video', async (keyword) => {
        console.log('keyword: ', keyword)

        await axios.get(`https://www.youtube.com/results?search_query=${keyword}`, {
            responseType: 'arraybuffer',
            headers: {
              'Content-Type': 'text/plain;charset=UTF-8',
            },
        })
        .then(response => {
            const decodedData = iconv.decode(Buffer.from(response.data), 'UTF-8');
            // Saving decodedData in root directory for test.
            // const randomString = Math.random().toString(12).substring(2, 6);

            // fs.writeFile(`${keyword}_${randomString}.json`, decodedData, (err) => {
            //     if (err) throw err;
            //     console.log('The file has been saved!');
            // });
            const videoTitle = /"title":\{"runs":\[\{"text":"(.*?)"}]/
            const videoUrl = /(\/(watch\?v=|shorts\/)[\w-]+\\?[\w-=%]+)"/
            const thumbnailUrl = /\"videoId\"\:\"[\w-]+\"\,\"thumbnail\"\:\{\"thumbnails\"\:\[\{\"url\"\:\"([\w-=:.?/\\]+)"/
            const views = /"runs":\[{"text":"([\d\.]+[백|천|만^"]?)"|조회수\s([\d\.]+[백|천|만^"]?)회"/
            const nickName = /"longBylineText":\{"runs":\[\{"text":"(.*?)",/
            const runningTime = /"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"(.*?)"}},/
        
            const printData = [];
            const videoInfoArr = decodedData.split('{"videoRenderer":')
            videoInfoArr.shift();

            videoInfoArr.map((info, idx) => {
                const infoObj = new Object;
                infoObj.title = info.match(videoTitle)[1];
                infoObj.videoUrl = info.match(videoUrl)[1];
                infoObj.thumbnailUrl = info.match(thumbnailUrl)[1];
                infoObj.views = info.match(views)[1] === undefined ? info.match(views)[2] + '회' : info.match(views)[1] + '회';
                infoObj.nickName = info.match(nickName)[1];
                infoObj.runningTime = info.match(runningTime) === null ? '실시간' : info.match(runningTime)[1];

                printData.push(infoObj);
            })

            socket.emit('search result', printData);
        })
        .catch(error => {
            console.log(error);
        });
    });

    socket.on('disconnect', () => {
        console.log(`${socket.handshake.address} / ${socket.client.id} user disconnected`);
        // Remove the disconnected socket from the list
        delete clients[socket.client.id];
    });
});

http.listen(8080, () => {
    console.log('listening on *:8080');
});