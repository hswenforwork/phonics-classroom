"""處理家長專區送出的單字申請單：把 JSON 寫進 data/words.csv（同一個字覆蓋），並檢查寫法。
結果寫到 RESULT_FILE，由 workflow 留言到申請單。"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data', 'words.csv')
PLACES = {1: '地洞入口', 2: '沙丘', 3: '金合歡樹', 4: '岩石瞭望台', 5: '綠洲水塘', 6: '地道迷宮', 7: '大草原', 8: '星空營地'}
TYPES = set('COETRDLW')
body = os.environ.get('ISSUE_BODY', '')
out = os.environ.get('RESULT_FILE', '/dev/stdout')


def done(msg, ok):
    with open(out, 'w', encoding='utf-8') as f:
        f.write(msg)
    print(msg)
    sys.exit(0 if ok else 1)


m = re.search(r'```json\s*(\{.*?\})\s*```', body, re.S)
if not m:
    done('找不到單字資料（```json 區塊）。', False)
try:
    d = {k: str(v).strip() for k, v in json.loads(m.group(1)).items()}
except Exception as e:  # noqa: BLE001
    done(f'資料格式錯誤：{e}', False)

word = d.get('word', '').lower()
errors = []
if not re.fullmatch(r'[a-z]+', word):
    errors.append('英文單字只能有英文字母')
stage = int(d.get('stage') or 0)
if stage not in PLACES:
    errors.append('地點要是 1～8')
syl = d.get('syllables') or word
sounds = d.get('sounds', '')
if syl.replace('/', '') != word:
    errors.append(f'音節 {syl} 合起來不是 {word}')
letters = re.sub(r'=[^-/(\[]+', '', sounds).replace('(e)', 'e')
letters = re.sub(r'\[([a-z]+)\]', r'\1', letters).replace('-', '').replace('/', '')
if letters != word:
    errors.append(f'音格 {sounds} 的字母合起來是 {letters}，不是 {word}')
types = d.get('types') or 'C'
n = syl.count('/') + 1
if sounds.count('/') + 1 != n or len(types.split('/')) != n:
    errors.append('音節、音格、音節類型的節數要一樣（用 / 分隔）')
if any(t not in TYPES for t in types.split('/')):
    errors.append('音節類型只能用 C O E T R D L W')
ipa = d.get('ipa', '').strip('/')
if ipa:
    k = re.sub(r'(?<=.)[ˈˌ]', '.', ipa).replace('ˈ', '').replace('ˌ', '').count('.') + 1
    if k != n:
        errors.append(f'音標有 {k} 段，音節有 {n} 節，要對齊（音標用 . 分段）')
    # 語音是照音標產生的：音標裡有 Google 英式語音不認得的符號，就沒辦法照音標念
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from build_audio import to_google  # noqa: E402
    _, bad = to_google(ipa)
    if bad:
        errors.append(f'音標裡有語音不認得的符號：{" ".join(sorted(set(bad)))}（請用英式音標，例如 /ˈræb.ɪt/）')
if errors:
    done('沒有寫入，請修正後重新送出：\n\n' + '\n'.join('- ' + e for e in errors), False)

with open(PATH, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
fields = list(rows[0].keys())
old = next((r for r in rows if r['word'] == word), None)
if old:
    rows.remove(old)
    rid = old['id'] if int(old['stage']) == stage else None
else:
    rid = None
if not rid:
    nums = [int(r['id'].split('-')[1]) for r in rows if r['id'].startswith(f'S{stage}-')]
    rid = f'S{stage}-{(max(nums) + 1 if nums else 1):02d}'
row = {'id': rid, 'word': word, 'stage': stage, 'place': PLACES[stage], 'emoji': d.get('emoji', ''), 'meaning_zh': d.get('zh', ''),
       'syllables': syl, 'sounds': sounds, 'ipa': '/' + ipa + '/' if ipa else '', 'types': types, 'stress': d.get('stress') or '1',
       'tricky': d.get('tricky', ''), 'suffix': d.get('suffix', ''), 'source': (old or {}).get('source', '補充'),
       'boss': (old or {}).get('boss', ''), 'checked': 'Y'}
rows.append(row)
rows.sort(key=lambda r: (int(r['stage']), r['id']))
with open(PATH, 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
done(f"已{'更新' if old else '新增'} {word}（{rid}，{PLACES[stage]}）。約 1～3 分鐘後網站更新。", True)
