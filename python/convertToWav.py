import sys
from pytube import YouTube

# if command => python ./ptyhon/convertToWav.py https://www.youtube.com/watch?v=ROIvbbg8jMQ
# argv       => ['pytubeTest.py', 'https://www.youtube.com/watch?v=ROIvbbg8jMQ']
youtubeURL = sys.argv[1]

# creating a YouTube-specific instance
yt = YouTube(youtubeURL)

# set the download path to a specific directory
download_path = 'C:\\Users\\Administrator\\Downloads\\youtube_wav'

# dowmload
# you can check the converting types by this command: yt.streams.filter(only_audio=True).all()
yt.streams.filter(only_audio=True).first().download(download_path)

print('Download success')