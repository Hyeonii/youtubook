import openai
import sys
import os
from dotenv import load_dotenv

# Setting the encoding to UTF-8 format to support various characters, such as Korean.
sys.stdout.reconfigure(encoding='utf-8')

# Set api option variables.
load_dotenv()
openai.api_key = os.getenv("API_KEY")
mp4URL = sys.argv[1]
model_engine = "whisper-1"

# Start converting process
audio_file = open(mp4URL, "rb")
transcript = openai.Audio.transcribe(model_engine, audio_file)
text = transcript['text']
audio_file.close()

print(text)