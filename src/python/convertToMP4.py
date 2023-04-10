from pytube import YouTube
import sys
import re

# If command => python ./python/convertToWav.py https://www.youtube.com/watch?v=ROIvbbg8jMQ
# argv       => ['pytubeTest.py', 'https://www.youtube.com/watch?v=ROIvbbg8jMQ']
youtubeURL = sys.argv[1]

# Creating a YouTube-specific instance.
yt = YouTube(youtubeURL)

sys.stdout.reconfigure(encoding='utf-8')

# Set the download path to a specific directory.
download_path = 'C:\\Users\\Administrator\\OneDrive\\Documents\\99.study\\youtubook\\public\\wav'
# Get the title of the video.
title = yt.title
# Replace any non-word characters with underscores.
valid_title = re.sub('[^0-9a-zA-Zㄱ-힗]+', '_', title).replace(' ', '_') + ".mp4"

# Extract MP4 file.
# You can check the converting types by this command => yt.streams.filter(only_audio=True).all()
video = yt.streams.filter(only_audio=True).first()
video.download(output_path=download_path, filename=valid_title)

print(valid_title)