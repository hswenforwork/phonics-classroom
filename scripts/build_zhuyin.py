"""全站中文注音：產生注音字型子集、破音字資料、待確認的破音字清單（部署時自動執行）。

注音字型「Bpmf Huninn」會在每個國字旁邊畫注音；破音字用 IVS（字後面接 U+E01E0+n）選第 n 個讀音。
- fonts/BpmfHuninn-subset.woff2：只含網站孩子會看到的字（含各讀音），檔案小
- data/zhuyin.json：每段文字標好讀音的版本（map），以及網站用到的破音字資料（js/zhuyin.js 用）
- data/zhuyin-check.json：自動判斷不了、也還沒在 data/zhuyin-fix.csv 指定的破音字，列在家長專區讓家長選

判斷順序：家長指定（data/zhuyin-fix.csv）→ 教育部一字多音審訂表的常見詞語（poyin_db）→ 詞庫（新酷音 tsi）→ 判斷不了

來源（fonts/src/，授權見 fonts/NOTICE-bpmfvs.txt）：
- BpmfHuninn-Regular.ttf：注音字型（ButTaiwan/bpmfvs）
- phonic_table_Z.txt：每個破音字的讀音順序（對應 IVS 編號）
- poyin_db.txt：破音字常見詞語（bpmfvs 讀音選擇工具，依教育部一字多音審訂表）
- tsi-poly.txt.gz：新酷音詞庫（libchewing tsi.src，LGPL-2.1）中含破音字的詞與注音
"""
import csv
import gzip
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'fonts', 'src')
CJK = re.compile(r'[㐀-鿿豈-﫿]')


def read_csv(name):
    p = os.path.join(ROOT, 'data', name)
    if not os.path.exists(p):
        return []
    with open(p, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def kid_texts():
    """孩子會看到的中文（每一筆是一段完整文字，當作判斷破音字的上下文）。"""
    out = []
    cols = {'words.csv': ['meaning_zh', 'place'], 'sentences.csv': ['meaning_zh', 'place'], 'stories.csv': ['title_zh', 'meaning_zh', 'place'],
            'rules.csv': ['character', 'title', 'mnemonic', 'action', 'parent_note', 'contrast', 'reliability'], 'vowels.csv': ['name_zh', 'mnemonic', 'note'], 'pairs.csv': [], 'sounds.csv': []}
    for name, cs in cols.items():
        for r in read_csv(name):
            out += [r.get(c, '') for c in cs if CJK.search(r.get(c, '') or '')]
    for fn in sorted(os.listdir(os.path.join(ROOT, 'js'))):
        if not fn.endswith('.js') or fn == 'autogen.js':
            continue
        src = open(os.path.join(ROOT, 'js', fn), encoding='utf-8').read()
        if fn == 'screens.js':  # 家長專區不加注音
            a = src.find('export function parentScreen')
            b = src.find('// ---------- 路由')
            if a >= 0 and b > a:
                src = src[:a] + src[b:]
        src = re.sub(r'^\s*//.*$', '', src, flags=re.M)
        for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|\"((?:[^\"\\\n]|\\.)*)\"", src):
            s = m.group(1) or m.group(2) or m.group(3) or ''
            if CJK.search(s):
                out.append(s)
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    out += [t for t in re.findall(r'>([^<]+)<', html) if CJK.search(t)]
    return [t for t in dict.fromkeys(out) if t]


def load_tables():
    readings = {}
    for line in open(os.path.join(SRC, 'phonic_table_Z.txt'), encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) > 4:
            readings[p[0]] = p[3:9]  # 字型最多 6 個讀音
    pats = {}
    for line in open(os.path.join(SRC, 'poyin_db.txt'), encoding='utf-8'):
        m = re.match(r'\[(.)[\]}]\s(\S+)\t?(.*)$', line.rstrip('\n'))
        if m and m[1] in readings and m[2] in readings[m[1]]:
            pats.setdefault(m[1], {})[readings[m[1]].index(m[2])] = [x for x in m[3].split('/') if '*' in x]
    return readings, pats


def load_tsi(readings):
    """詞 → 每個字可能的讀音集合（同一個詞有多種念法時全部收）。"""
    tsi = {}
    freq = {}
    with gzip.open(os.path.join(SRC, 'tsi-poly.txt.gz'), 'rt', encoding='utf-8') as f:
        for line in f:
            p = line.split()
            if len(p) < 2:
                continue
            if p[0].startswith('@'):  # 單字的使用次數：@字 次數 注音
                z = re.sub(r'^(.*)˙$', r'˙\1', p[2])
                freq.setdefault(p[0][1:], {})[z] = freq.get(p[0][1:], {}).get(z, 0) + int(p[1])
                continue
            w, zy = p[0], [re.sub(r'^(.*)˙$', r'˙\1', z) for z in p[1:]]  # 輕聲寫在前面：ㄗ˙ → ˙ㄗ
            if len(zy) != len(w):
                continue
            e = tsi.setdefault(w, [set() for _ in w])
            for k, z in enumerate(zy):
                e[k].add(z)
    tsi['@freq'] = freq
    return tsi


# 注音字型裡沒有的字與讀音
EXTRA_READINGS = {'獴': 'ㄇㄥˊ'}

# 一、不：變調字，沒有詞語規則時用本調（字型預設）
SAFE_DEFAULT = set('一不')


def default_safe(c, readings, tsi):
    """這個字單獨使用時，預設讀音佔 85% 以上，就直接用預設讀音（例如「的」念 ˙ㄉㄜ、「讀」念 ㄉㄨˊ）。"""
    if c in SAFE_DEFAULT:
        return True
    f = tsi['@freq'].get(c, {})
    total = sum(f.values())
    return total > 0 and f.get(readings[c][0], 0) / total >= 0.85


def from_tsi(text, i, c, readings, tsi):
    """找涵蓋這個字的最長詞；讀音只有一種就用它，有輕聲變體時用輕聲（課本標法）。"""
    for n in range(5, 1, -1):
        for s in range(i - n + 1, i + 1):
            if s < 0 or s + n > len(text):
                continue
            w = text[s:s + n]
            if w in tsi:
                opts = [z for z in tsi[w][i - s] if z in readings[c]]
                if len(opts) == 1:
                    return readings[c].index(opts[0])
                light = [z for z in opts if z.startswith('˙')]
                if len(light) == 1:
                    return readings[c].index(light[0])
                if opts:
                    return None
    return None


def match_at(text, i, c, pat):
    pos = pat.index('*')
    s = i - pos
    if s < 0 or s + len(pat) > len(text):
        return False
    return text[s:s + len(pat)] == pat.replace('*', c)


def fixes():
    """家長指定的讀音：data/zhuyin-fix.csv（字、詞語（* 代表這個字）、讀音）。"""
    return [r for r in read_csv('zhuyin-fix.csv') if r.get('char') and r.get('pattern') and r.get('reading')]


def resolve(text, i, c, readings, pats, fx, tsi):
    """回傳 (讀音編號, 來源)；來源 None 代表判斷不了（用預設讀音）。"""
    best = None
    for f in fx:  # 家長指定的優先，越長的詞語越優先
        if f['char'] == c and f['reading'] in readings[c] and match_at(text, i, c, f['pattern']):
            if not best or len(f['pattern']) > len(best[1]):
                best = (readings[c].index(f['reading']), f['pattern'])
    if best:
        return best[0], 'fix'
    for j in sorted(pats.get(c, {})):
        if any(match_at(text, i, c, p) for p in pats[c][j]):
            return j, 'auto'
    j = from_tsi(text, i, c, readings, tsi)
    if j is not None:
        return j, 'dict'
    if default_safe(c, readings, tsi):
        return 0, 'freq'
    return 0, None


def annotate(text, readings, pats, fx, tsi):
    out = []
    for i, c in enumerate(text):
        out.append(c)
        if c in readings:
            j, _ = resolve(text, i, c, readings, pats, fx, tsi)
            if j > 0:
                out.append(chr(0xE01E0 + j))
    return ''.join(out)


def main():
    readings, pats = load_tables()
    tsi = load_tsi(readings)
    fx = fixes()
    texts = kid_texts()
    chars = sorted({ch for t in texts for ch in t if CJK.match(ch)})
    used = [c for c in chars if c in readings]

    # 破音字資料（只放網站用到的字）
    poyin = {c: {'r': readings[c], 'p': {str(j): v for j, v in pats.get(c, {}).items() if v}} for c in used}
    # 注音字型裡沒有的字（例如「獴」）：網站另外在字旁邊畫注音
    from fontTools.ttLib import TTFont
    cmap = TTFont(os.path.join(SRC, 'BpmfHuninn-Regular.ttf')).getBestCmap()
    missing = {c: EXTRA_READINGS.get(c, '') for c in chars if ord(c) not in cmap}
    for c, r in missing.items():
        if not r:
            print(f'注意：字型沒有「{c}」，也不知道讀音，請加到 scripts/build_zhuyin.py 的 EXTRA_READINGS', file=sys.stderr)
    tmap = {}
    for t in texts:
        a = annotate(t, readings, pats, fx, tsi)
        if a != t:
            tmap[t] = a
    with open(os.path.join(ROOT, 'data', 'zhuyin.json'), 'w', encoding='utf-8') as f:
        json.dump({'map': tmap, 'poyin': poyin, 'fix': fx, 'extra': {c: r for c, r in missing.items() if r}}, f, ensure_ascii=False, separators=(',', ':'))

    # 判斷不了的破音字：同一個字、同一段上下文只列一次
    check, seen = [], set()
    for t in texts:
        for i, c in enumerate(t):
            if c not in readings:
                continue
            j, how = resolve(t, i, c, readings, pats, fx, tsi)
            if how:
                continue
            ctx = t[max(0, i - 6):i + 7]
            k = (c, t[max(0, i - 2):i + 3])
            if k in seen:
                continue
            seen.add(k)
            check.append({'char': c, 'readings': readings[c], 'context': ctx, 'at': i - max(0, i - 6),
                          'pattern': t[max(0, i - 2):i].replace(c, c) + '*' + t[i + 1:i + 3]})
    with open(os.path.join(ROOT, 'data', 'zhuyin-check.json'), 'w', encoding='utf-8') as f:
        json.dump(check, f, ensure_ascii=False, indent=0)

    # 字型子集：網站用到的國字＋各讀音（IVS）＋常用符號
    try:
        from fontTools import subset
    except ImportError:
        print('沒有安裝 fonttools，略過字型子集（pip install fonttools brotli）', file=sys.stderr)
        return 0
    text = ''.join(chars) + '，。、！？：；「」（）『』—…～·0123456789'
    uni = ['U+E01E0-E01E5', 'U+3100-312F', 'U+02C7', 'U+02CA', 'U+02CB', 'U+02D9', 'U+0020-007E']
    subset.main([os.path.join(SRC, 'BpmfHuninn-Regular.ttf'), '--text=' + text, '--unicodes=' + ','.join(uni),
                 '--layout-features=*', '--flavor=woff2', '--output-file=' + os.path.join(ROOT, 'fonts', 'BpmfHuninn-subset.woff2')])
    # 字型網址加上版本號，避免瀏覽器沿用舊的字型（舊字型缺字就沒有注音）
    import hashlib
    out = os.path.join(ROOT, 'fonts', 'BpmfHuninn-subset.woff2')
    ver = hashlib.md5(open(out, 'rb').read()).hexdigest()[:10]
    css = os.path.join(ROOT, 'css', 'app.css')
    src = open(css, encoding='utf-8').read()
    src2 = re.sub(r"url\('\.\./fonts/BpmfHuninn-subset\.woff2(\?v=[0-9a-f]*)?'\)", f"url('../fonts/BpmfHuninn-subset.woff2?v={ver}')", src)
    if src2 != src:
        open(css, 'w', encoding='utf-8').write(src2)
    print(f'注音：{len(texts)} 段文字、{len(chars)} 個國字、{len(used)} 個破音字、待確認 {len(check)} 處')
    return 0


if __name__ == '__main__':
    sys.exit(main())
