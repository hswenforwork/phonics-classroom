"""自動產生英式語音（Google Cloud Text-to-Speech，en-GB-Neural2-C），讓全站英文發音一致。

由 .github/workflows/audio.yml 執行，產生：
- 字庫每個字：audio/words/<word>.mp3（整字），多音節字再產生 audio/syllables/<word>-<第幾節，從 0 開始>.mp3
- 句子：audio/sentences/<id>.mp3；故事：audio/stories/<stage>-<page>.mp3
- 句子、故事、聽聽看裡出現、但不在字庫的字：audio/words/<word>.mp3（點單字時用）

發音依據：
- 字庫裡的字一律用 SSML <phoneme alphabet="ipa"> 照字庫的英式音標念（句子、故事裡的字也是）
- 字庫音標是劍橋字典寫法，送給 Google 前轉成 Google 英式語音認得的符號（r→ɹ、e→ɛ、tʃ→ʧ…）
  轉完還有不認得的符號就不產生、列在錯誤清單（Google 遇到不認得的符號會默默改用自己的念法）
- 不在字庫的字（a、the、Mo…）讓 Google 自己念

audio/generated.json 記錄每個檔案是依什麼內容產生的；內容改了（例如家長改音標）就重新產生。
已經存在、但不在紀錄裡的檔案，視為家長自己上傳的錄音，不會覆蓋。

需要 repo secret：GOOGLE_TTS_API_KEY。沒有設定時只印出提醒。
"""
import base64
import csv
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
AUDIO = ROOT / 'audio'
MANIFEST = AUDIO / 'generated.json'
VOICE = {'languageCode': 'en-GB', 'name': 'en-GB-Neural2-C'}
KEY = os.environ.get('GOOGLE_TTS_API_KEY', '').strip()
RATE = {'word': 0.85, 'syllable': 0.75, 'sentence': 0.85}

# Google 英式語音（en-GB）認得的音素
GOOGLE_GB = ['p', 'b', 't', 'd', 'k', 'ɡ', 'm', 'n', 'ŋ', 'f', 'v', 's', 'z', 'θ', 'ð', 'ʃ', 'ʒ', 'h', 'l', 'ɹ', 'ʧ', 'ʤ', 'j', 'w',
             'æ', 'ɑː', 'ə', 'ɛ', 'ɪ', 'iː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'aɪ', 'aʊ', 'eɪ', 'eə', 'iə', 'ɔɪ', 'əʊ', 'ʊə']
MARKS = ['ˈ', 'ˌ', '.']
UNITS = sorted(GOOGLE_GB + MARKS, key=len, reverse=True)


def to_google(ipa):
    """劍橋寫法 → Google en-GB 寫法。回傳 (轉好的音標, 不認得的符號清單)。"""
    s = ipa.strip().strip('/').replace('g', 'ɡ').replace('ɹ', 'r')
    s = s.replace('tʃ', 'ʧ').replace('dʒ', 'ʤ').replace('ɪə', 'iə').replace('r', 'ɹ')
    s = re.sub(r'e(?![ɪə])', 'ɛ', s)          # bed 的 e（eɪ、eə 保留）
    s = re.sub(r'i(?![ːə])', 'iː', s)          # happy 的 i
    s = s.replace('ɜ', 'ɜː').replace('ɜːː', 'ɜː')
    bad, i = [], 0
    while i < len(s):
        u = next((u for u in UNITS if s.startswith(u, i)), None)
        if u:
            i += len(u)
        else:
            bad.append(s[i])
            i += 1
    return s, bad


def tts(ssml, rate):
    body = json.dumps({'input': {'ssml': ssml}, 'voice': VOICE,
                       'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': rate, 'sampleRateHertz': 24000}}).encode()
    req = urllib.request.Request(f'https://texttospeech.googleapis.com/v1/text:synthesize?key={KEY}', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return base64.b64decode(json.load(r)['audioContent'])


def phon(text, gipa):
    return f'<phoneme alphabet="ipa" ph="{gipa.replace(".", "")}">{escape(text)}</phoneme>'


def read(name):
    p = DATA / name
    return list(csv.DictReader(p.open(encoding='utf-8-sig'))) if p.exists() else []


def key(t):
    return re.sub(r'[^a-z]', '', t.lower())


def main():
    words = [r for r in read('words.csv') if r.get('word') and r.get('checked') != 'N']
    sentences = [r for r in read('sentences.csv') if r.get('text') and r.get('checked') != 'N']
    stories = [r for r in read('stories.csv') if r.get('text') and r.get('checked') != 'N']
    pairs = read('pairs.csv')
    man = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    for k in [k for k in man if not k.startswith('audio/')]:  # 舊版紀錄格式（單字: 音標）：這些檔案要依新規則重產
        LEGACY.add(f'audio/words/{k}.mp3')
        LEGACY.update(f'audio/syllables/{k}-{i}.mp3' for i in range(12))
        del man[k]
    errors, jobs = [], []  # job = (相對路徑, 紀錄內容, ssml, 語速)

    # 字庫：整字＋音節
    bank = {}
    for r in words:
        w = r['word'].strip().lower()
        if not r.get('ipa', '').strip('/ '):
            errors.append(f'{w}：沒有音標')
            continue
        g, bad = to_google(r['ipa'])
        if bad:
            errors.append(f'{w}：音標 {r["ipa"]} 有 Google 不認得的符號 {" ".join(sorted(set(bad)))}，請修改音標')
            continue
        bank[w] = g
        jobs.append((f'audio/words/{w}.mp3', 'ipa:' + g, f'<speak>{phon(w, g)}</speak>', RATE['word']))
        syls = [s for s in (r.get('syllables') or w).split('/') if s]
        if len(syls) > 1:
            parts = [p for p in re.sub(r'(?<=.)([ˈˌ])', r'.\1', g).split('.') if p]
            if len(parts) != len(syls):
                errors.append(f'{w}：音節 {r["syllables"]} 有 {len(syls)} 節，音標 {r["ipa"]} 切成 {len(parts)} 節，對不上，音節語音沒有產生')
                continue
            for i, (s, p) in enumerate(zip(syls, parts)):
                p = p.replace('ˈ', '').replace('ˌ', '')
                jobs.append((f'audio/syllables/{w}-{i}.mp3', 'ipa:' + p, f'<speak>{phon(s, p)}</speak>', RATE['syllable']))

    # 句子、故事：字庫裡的字照字庫音標念
    def sentence_ssml(text):
        out = []
        for tok in re.findall(r"[A-Za-z']+|[^A-Za-z']+", text):
            k = key(tok)
            out.append(phon(tok, bank[k]) if k in bank else escape(tok))
        return '<speak>' + ''.join(out) + '</speak>'

    def fingerprint(text):
        ks = sorted({key(t) for t in re.findall(r"[A-Za-z']+", text)})
        return 'text:' + text + '|' + ','.join(f'{k}={bank[k]}' for k in ks if k in bank)

    for r in sentences:
        jobs.append((f'audio/sentences/{r["id"]}.mp3', fingerprint(r['text']), sentence_ssml(r['text']), RATE['sentence']))
    for r in stories:
        jobs.append((f'audio/stories/{r["stage"]}-{r["page"]}.mp3', fingerprint(r['text']), sentence_ssml(r['text']), RATE['sentence']))

    # 句子、故事、聽聽看裡不在字庫的字（點單字時用）
    extra = {}
    for r in sentences + stories:
        for t in re.findall(r"[A-Za-z']+", r['text']):
            if key(t) and key(t) not in bank:
                extra.setdefault(key(t), t.lower())
    for r in pairs:
        for c in ('word_a', 'word_b'):
            if r.get(c) and key(r[c]) not in bank:
                extra.setdefault(key(r[c]), r[c].lower())
    for k, t in sorted(extra.items()):
        jobs.append((f'audio/words/{k}.mp3', 'google:' + t, f'<speak>{escape(t)}</speak>', RATE['word']))

    print(f'字庫 {len(bank)} 字、句子 {len(sentences)}、故事 {len(stories)} 頁、其他單字 {len(extra)}，共 {len(jobs)} 個語音')
    if not KEY:
        print('沒有設定 GOOGLE_TTS_API_KEY，略過產生語音。請到 Settings → Secrets and variables → Actions 新增。')
        report(errors)
        return 0

    made = 0
    for rel, fp, ssml, rate in jobs:
        f = ROOT / rel
        if man.get(rel) == fp and f.exists():
            continue
        if f.exists() and rel not in man and not legacy(rel):
            continue  # 家長自己上傳的錄音
        try:
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(tts(ssml, rate))
            man[rel] = fp
            made += 1
            print('產生', rel)
        except Exception as e:  # noqa: BLE001
            errors.append(f'{rel}：Google 產生失敗 {e}')
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(man, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(f'完成，共產生 {made} 個音檔')
    report(errors)
    return 1 if errors else 0


# 舊版流程產生過的檔案（紀錄格式不同），一律依新規則重新產生
LEGACY = set()


def legacy(rel):
    return rel in LEGACY


def report(errors):
    if not errors:
        return
    text = '## 有些語音沒有產生\n\n' + '\n'.join('- ' + e for e in errors) + '\n'
    print(text, file=sys.stderr)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as fh:
            fh.write(text)


if __name__ == '__main__':
    sys.exit(main())
