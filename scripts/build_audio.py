"""自動產生單字與音節的英式語音（Google Cloud Text-to-Speech，en-GB-Neural2-C）。

由 .github/workflows/audio.yml 執行：
- 讀 data/words.csv，找出還沒有語音、或音標改過的單字
- 單字念整個字（audio/words/<word>.mp3），多音節字再一節一節念（audio/syllables/<word>-<第幾節，從 0 開始>.mp3）
- 用 SSML 的 <phoneme> 照字庫的英式音標發音，念法跟網站上寫的一樣
- 已經有 phonics-kids 共用音檔、而且從沒自動產生過的字會略過（不重複產生）
- audio/generated.json 記錄每個字是用哪個音標產生的；家長改了音標，就會重新產生

需要 repo secret：GOOGLE_TTS_API_KEY（跟 phonics-kids 用同一把）。沒有設定時只印出提醒，不算失敗。
"""
import base64
import csv
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS = ROOT / 'data' / 'words.csv'
MANIFEST = ROOT / 'audio' / 'generated.json'
PK_INDEX = 'https://hswenforwork.github.io/phonics-kids/audio/index.json'
VOICE = {'languageCode': 'en-GB', 'name': 'en-GB-Neural2-C'}
KEY = os.environ.get('GOOGLE_TTS_API_KEY', '').strip()


def tts(text, ipa, rate):
    ph = ipa.replace('.', '').replace('/', '').replace('"', '')
    ssml = f'<speak><phoneme alphabet="ipa" ph="{ph}">{text}</phoneme></speak>'
    body = json.dumps({'input': {'ssml': ssml}, 'voice': VOICE,
                       'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': rate, 'sampleRateHertz': 24000}}).encode()
    req = urllib.request.Request(f'https://texttospeech.googleapis.com/v1/text:synthesize?key={KEY}', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return base64.b64decode(json.load(r)['audioContent'])


def pk_index():
    try:
        with urllib.request.urlopen(PK_INDEX, timeout=20) as r:
            data = json.load(r)
        return set((data or {}).get('items', {}).keys())
    except Exception as e:  # noqa: BLE001
        print('讀不到 phonics-kids 音檔清單，全部自己產生：', e)
        return set()


def main():
    if not KEY:
        print('沒有設定 GOOGLE_TTS_API_KEY，略過產生語音。請到 Settings → Secrets and variables → Actions 新增。')
        return 0
    rows = list(csv.DictReader(WORDS.open(encoding='utf-8-sig')))
    man = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    pk = pk_index()
    made = 0
    for r in rows:
        word = (r.get('word') or '').strip().lower()
        ipa = (r.get('ipa') or '').strip().strip('/')
        if not word or not ipa or r.get('checked') == 'N':
            continue
        wfile = ROOT / 'audio' / 'words' / f'{word}.mp3'
        if word not in man and (wfile.exists() or f'w/{word}' in pk):
            continue  # 已經有音檔（自己上傳的或共用的），不重複產生
        if man.get(word) == ipa and wfile.exists():
            continue  # 音標沒改
        syls = [s for s in (r.get('syllables') or word).split('/') if s]
        parts = [p.replace('ˈ', '').replace('ˌ', '') for p in re.sub(r'(?<=.)([ˈˌ])', r'.\1', ipa).split('.') if p]
        try:
            wfile.parent.mkdir(parents=True, exist_ok=True)
            wfile.write_bytes(tts(word, ipa, 0.85))
            made += 1
            if len(syls) > 1 and len(parts) == len(syls):
                for i, (s, p) in enumerate(zip(syls, parts)):
                    sf = ROOT / 'audio' / 'syllables' / f'{word}-{i}.mp3'
                    sf.parent.mkdir(parents=True, exist_ok=True)
                    sf.write_bytes(tts(s, p, 0.75))
                    made += 1
            man[word] = ipa
            print('產生', word, ipa)
        except Exception as e:  # noqa: BLE001
            print('產生失敗', word, e, file=sys.stderr)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(man, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(f'完成，共產生 {made} 個音檔')
    return 0


if __name__ == '__main__':
    sys.exit(main())
