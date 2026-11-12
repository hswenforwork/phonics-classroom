// 讀取 data/*.csv，並把單字的 sounds 寫法解析成音格
export const PLACES = [
  null,
  { no: 1, name: '地洞入口', topic: '字母音 CVC', eg: 'cat · dog', bg: '#F7E1BC', fg: '#C98E4E', tx: '#A5652C', icon: 'burrow' },
  { no: 2, name: '沙丘', topic: '二合字母', eg: 'ship · chair', bg: '#FBE7C2', fg: '#E3B676', tx: '#A5652C', icon: 'dune' },
  { no: 3, name: '金合歡樹', topic: '長母音組合', eg: 'rain · boat', bg: '#E4EED7', fg: '#7BA05B', tx: '#4F7A33', icon: 'tree' },
  { no: 4, name: '岩石瞭望台', topic: '子音群', eg: 'frog · jump', bg: '#EDE3D8', fg: '#A68B73', tx: '#6B4C36', icon: 'rock' },
  { no: 5, name: '綠洲水塘', topic: '魔法 e', eg: 'cake · bike', bg: '#DDEFF2', fg: '#5DAAB8', tx: '#2D7684', icon: 'pond' },
  { no: 6, name: '地道迷宮', topic: '音節拆分', eg: 'rab | bit', bg: '#F3DCCB', fg: '#B5643C', tx: '#9A4A26', icon: 'tunnel' },
  { no: 7, name: '大草原', topic: '字尾變化', eg: 'swim → swimming', bg: '#EAF0CF', fg: '#A3B653', tx: '#5E7020', icon: 'grass' },
  { no: 8, name: '星空營地', topic: '弱讀與例外字', eg: 'said · banana', bg: '#E3E1EE', fg: '#5B5A8C', tx: '#46457A', icon: 'stars' },
];

export const TYPES = {
  C: { name: '閉音節', en: 'Closed', color: '#E2836B', rule: 'type:C' },
  O: { name: '開音節', en: 'Open', color: '#6FB5C9', rule: 'type:O' },
  E: { name: '魔法 e', en: 'Magic e', color: '#9C86D9', rule: 'type:E' },
  T: { name: '母音組合', en: 'Vowel team', color: '#7BA05B', rule: 'type:T' },
  R: { name: 'r 控制', en: 'Bossy r', color: '#C98E4E', rule: 'type:R' },
  D: { name: '雙母音', en: 'Diphthong', color: '#E0A33A', rule: 'type:D' },
  L: { name: '子音＋le', en: 'C-le', color: '#B5643C', rule: 'type:L' },
  W: { name: '調皮音節', en: 'Tricky', color: '#5B5A8C', rule: 'tricky' },
};

// 每種拼法的預設讀音（sounds 欄沒寫 =音 時使用）
export const DEFAULT_PH = {
  b: 'b', c: 'k', d: 'd', f: 'f', g: 'ɡ', h: 'h', j: 'dʒ', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', r: 'r', s: 's', t: 't', v: 'v', w: 'w', x: 'ks', y: 'j', z: 'z',
  a: 'æ', e: 'e', i: 'ɪ', o: 'ɒ', u: 'ʌ', qu: 'kw',
  sh: 'ʃ', ch: 'tʃ', th: 'θ', ng: 'ŋ', ph: 'f', ck: 'k', ll: 'l', ss: 's', zz: 'z', ff: 'f', tch: 'tʃ', dge: 'dʒ', wh: 'w',
  ai: 'eɪ', ay: 'eɪ', ee: 'iː', ea: 'iː', igh: 'aɪ', ie: 'aɪ', oa: 'əʊ', ow: 'əʊ', oo: 'uː', ou: 'aʊ', oi: 'ɔɪ', oy: 'ɔɪ', oe: 'əʊ', ue: 'uː', ew: 'uː',
  bb: 'b', dd: 'd', gg: 'ɡ', mm: 'm', nn: 'n', pp: 'p', rr: 'r', tt: 't',
  ar: 'ɑː', or: 'ɔː', ir: 'ɜː', ur: 'ɜː', er: 'ɜː', air: 'eə', ear: 'ɪə', le: 'əl', ed: 'd', es: 'ɪz', all: 'ɔːl', eo: 'iː', eye: 'aɪ',
};
const VOWEL_PH = /^(æ|e|ɪ|ɒ|ʌ|eɪ|iː|aɪ|əʊ|uː|ʊ|juː|ɑː|ɔː|ɜː|eə|ɪə|aʊ|ɔɪ|ə|i|əl|ɪz|wʌ|ɔːl)$/;

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

// 一格：{ g: 拼法, ph: 讀音, vowel, silentBefore, silentAfter, magic, display }
export function parseBox(tok) {
  const m = tok.match(/^(?:\[([a-z]+)\])?([a-z]+)(?:=([^[(]+))?(\(e\))?(?:\[([a-z]+)\])?$/);
  if (!m) return { g: tok, ph: '', vowel: false, bad: true };
  const [, sb, g, ov, magic, sa] = m;
  const ph = ov || DEFAULT_PH[g] || '';
  return { g, ph, vowel: VOWEL_PH.test(ph), silentBefore: sb || '', silentAfter: sa || '', magic: !!magic, explicit: !!ov };
}

// 把音標切成一個個音素（多字元的雙母音、長母音、tʃ、dʒ 算一個）
const IPA_UNITS = ['juː', 'eɪ', 'aɪ', 'ɔɪ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə', 'iː', 'ɑː', 'ɔː', 'uː', 'ɜː', 'tʃ', 'dʒ'];
const IPA_V = /^(juː|eɪ|aɪ|ɔɪ|əʊ|aʊ|ɪə|eə|ʊə|iː|ɑː|ɔː|uː|ɜː|[æeɪɒʌʊəi])$/;
export function ipaTokens(ipa) {
  const s = String(ipa || '').replace(/[\/ˈˌ.\s]/g, '').replace(/g/g, 'ɡ');
  const out = [];
  for (let i = 0; i < s.length;) {
    const u = IPA_UNITS.find((x) => s.startsWith(x, i)) || s[i];
    out.push(u); i += u.length;
  }
  return out;
}
// 依字庫音標，決定每一格實際念什麼（沒寫 =音 的格子才調整）。
// 例如 cake 的 a、bone 的 o、baby 的 a 是長音，camel 的 e 是弱讀 /ə/。對不起來就維持原樣。
export function alignIpa(syls, ipa) {
  const tk = ipaTokens(ipa);
  if (!tk.length) return false;
  const boxes = syls.flat();
  const plan = []; let pos = 0;
  for (let k = 0; k < boxes.length; k++) {
    const b = boxes[k]; const prev = boxes[k - 1];
    let n = 0; let acc = '';
    while (pos + n < tk.length && acc.length < b.ph.length) acc += tk[pos + n++];
    if (b.ph && acc === b.ph) { plan.push(b.ph); pos += n; continue; }
    if (b.ph && tk[pos] && tk[pos].length > b.ph.length && tk[pos].startsWith(b.ph)) { plan.push(b.ph); tk[pos] = tk[pos].slice(b.ph.length); continue; } // you：/juː/ 的 j 給 y
    const t = tk[pos];
    if (prev && prev.g === b.g && !b.vowel && plan[k - 1] !== undefined && t !== b.ph) { plan.push(plan[k - 1]); continue; } // rab/bit 的第二個 b
    if (t === undefined) return false;
    const tv = IPA_V.test(t);
    const spellV = /^[aeiouy]/.test(b.g) || /^(ar|or|er|ir|ur)$/.test(b.g);
    if (b.explicit) return false;
    if (tv && (b.vowel || spellV)) {
      // 母音格：可能吃兩個音素（le → əl、y → i）
      if (b.g === 'le' && tk[pos + 1] === 'l') { plan.push(t + 'l'); pos += 2; continue; }
      plan.push(t); pos += 1; continue;
    }
    if (!tv && !b.vowel && !spellV) { plan.push(t); pos += 1; continue; }
    return false;
  }
  if (pos !== tk.length) return false;
  boxes.forEach((b, k) => { if (!b.explicit && plan[k] && plan[k] !== b.ph) { b.ph = plan[k]; b.vowel = VOWEL_PH.test(b.ph); b.aligned = true; } });
  markLong(syls);
  return true;
}
// 單一母音字母念長音：同一節有魔法 e → magicVowel；否則（開音節）→ longOpen。讓提示視窗找對口訣
const LONG_PH = { a: 'eɪ', e: 'iː', i: 'aɪ', o: 'əʊ', u: 'juː|uː' };
function markLong(syls) {
  for (const syl of syls) {
    const magic = syl.some((x) => x.magic);
    for (const b of syl) {
      if (!LONG_PH[b.g] || !new RegExp('^(' + LONG_PH[b.g] + ')$').test(b.ph)) continue;
      if (magic) b.magicVowel = true; else b.longOpen = true;
    }
  }
}

export function parseSounds(s) {
  return s.split('/').map((syl) => syl.split('-').filter(Boolean).map(parseBox));
}

// 音節之間的拆分模式
export function divisionKey(word) {
  if (word.syls.length < 2) return null;
  const keys = [];
  const isR = (b) => /r$/.test(b.g) && /^(ɑː|ɔː|ɜː|eə|ɪə|ə)$/.test(b.ph);
  for (let i = 0; i < word.syls.length - 1; i++) {
    const a = word.syls[i]; const b = word.syls[i + 1];
    const last = a[a.length - 1]; const first = b[0];
    const tail = []; for (let k = a.length - 1; k >= 0 && (!a[k].vowel || (k === a.length - 1 && isR(a[k]))); k--) { tail.push(a[k]); if (a[k].vowel) break; }
    const head = []; for (let k = 0; k < b.length && !b[k].vowel; k++) head.push(b[k]);
    const lastV = last.vowel && !isR(last);
    let key;
    if (word.compound && i === 0) key = 'div:compound';
    else if (word.suf && ((word.suf.root === 'un' && i === 0) || (i === word.syls.length - 2 && first.vowel))) key = 'div:affix';
    else if (b.some((x) => x.g === 'le')) key = 'div:cle';
    else if (lastV && first.vowel) key = 'div:VV';
    else if (tail.length && head.length && tail[0].g === head[0].g) key = 'div:double';
    else if (tail.length + head.length >= 3) key = 'div:VCCCV';
    else if (tail.length && head.length) key = 'div:VCCV';
    else if (lastV && head.length) key = 'div:VCV-open';
    else if (tail.length && first.vowel) key = 'div:VCV-closed';
    else key = 'div:VCCV';
    keys.push(key);
  }
  return keys;
}

const COMPOUNDS = new Set(['sunflower', 'football', 'cupcake', 'rainbow']);

function enrichWord(r) {
  const syls = parseSounds(r.sounds);
  const aligned = alignIpa(syls, r.ipa);
  markLong(syls);
  const types = r.types.split('/');
  const w = {
    id: r.id, word: r.word, stage: +r.stage, emoji: r.emoji, zh: r.meaning_zh,
    sylText: r.syllables.split('/'), syls, types, ipa: r.ipa, stress: +r.stress || 1,
    tricky: r.tricky, suffix: r.suffix, source: r.source, boss: r.boss === 'Y', compound: COMPOUNDS.has(r.word), aligned,
  };
  w.boxes = syls.flat();
  if (w.suffix) {
    const [form, rule] = w.suffix.split('|');
    const parts = form.split(/[+→]/);
    w.suf = { root: parts[0], add: parts[1] || '', rule: rule || '直接加', irregular: form.includes('→') };
  }
  w.division = divisionKey(w);
  w.tags = wordTags(w);
  return w;
}

// 這個字用到哪些「地道網」節點
export function wordTags(w) {
  const t = new Set(['letters']);
  for (const b of w.boxes) {
    if (['sh', 'ch', 'th', 'ng', 'ph', 'ck', 'll', 'ss', 'zz', 'tch', 'dge', 'wh'].includes(b.g)) t.add('digraph');
    if (b.magic) t.add('magic');
    if (b.silentBefore || b.silentAfter) t.add('silent');
    if (b.ph === 'ə') t.add('schwa');
    if (b.g === 'y' && b.vowel) t.add('y');
    if ((b.g === 'c' && b.ph === 's') || (b.g === 'g' && b.ph === 'dʒ')) t.add('soft');
  }
  for (const ty of w.types) t.add({ T: 'team', R: 'bossy', D: 'slide', L: 'tail', W: 'tricky', O: 'door', C: 'door', E: 'magic' }[ty]);
  for (const s of w.syls) {
    for (let i = 0; i < s.length - 1; i++) if (!s[i].vowel && !s[i + 1].vowel && s[i].g.length === 1 && s[i + 1].g.length === 1 && s[i].g !== s[i + 1].g) t.add('blend');
  }
  if (w.syls.length > 1) t.add('door');
  if (w.suf) t.add('bag');
  if (w.tricky) t.add('tricky');
  return [...t].filter(Boolean);
}

export const NODES = [
  { id: 'letters', name: '字母音', x: 120, y: 70 },
  { id: 'digraph', name: '抱抱好朋友', x: 300, y: 50 },
  { id: 'blend', name: '手牽手小隊', x: 480, y: 70 },
  { id: 'team', name: '並肩雙胞胎', x: 650, y: 60 },
  { id: 'bossy', name: '老鷹 r', x: 90, y: 200 },
  { id: 'slide', name: '滑沙板', x: 260, y: 190 },
  { id: 'magic', name: '綠洲精靈 e', x: 440, y: 200 },
  { id: 'soft', name: '軟沙', x: 610, y: 190 },
  { id: 'y', name: '變裝的 y', x: 760, y: 200 },
  { id: 'door', name: '石頭門', x: 140, y: 330 },
  { id: 'tail', name: '狐獴尾巴', x: 320, y: 320 },
  { id: 'bag', name: '探險背包', x: 500, y: 330 },
  { id: 'schwa', name: '懶甲蟲', x: 660, y: 320 },
  { id: 'silent', name: '隱形狐獴', x: 300, y: 430 },
  { id: 'tricky', name: '星空小精靈', x: 540, y: 430 },
];

async function load(name) {
  const r = await fetch('data/' + name, { cache: 'no-cache' });
  if (!r.ok) throw new Error('讀不到 ' + name);
  return parseCSV(await r.text());
}

export const DB = { words: [], allWords: [], byId: {}, sentences: [], stories: [], pairs: [], rules: [], ruleByKey: {}, sounds: [], soundByIpa: {} };

export async function loadAll() {
  const [words, sentences, stories, pairs, rules, sounds] = await Promise.all(
    ['words.csv', 'sentences.csv', 'stories.csv', 'pairs.csv', 'rules.csv', 'sounds.csv'].map(load));
  DB.words = words.filter((r) => r.checked !== 'N' && r.word).map(enrichWord);
  DB.byId = Object.fromEntries(DB.words.map((w) => [w.id, w]));
  DB.allWords = DB.words;
  DB.sentences = sentences.filter((r) => r.checked !== 'N');
  DB.stories = stories.filter((r) => r.checked !== 'N');
  DB.pairs = pairs;
  DB.rules = rules;
  for (const r of rules) DB.ruleByKey[r.key] = r;
  DB.sounds = sounds;
  for (const s of sounds) DB.soundByIpa[s.ipa.replace(/\//g, '')] = s;
}

// 孩子練習只用已經有語音的字（DB.allWords 保留全部，給家長專區用）
export function onlyReadyWords(isReady) { DB.words = DB.allWords.filter(isReady); }
export const wordsOf = (stage) => DB.words.filter((w) => w.stage === stage);
export const rule = (key) => DB.ruleByKey[key];

// 找一格拼法對應的規則（第 5、9 步的提示視窗）
export function ruleForBox(b) {
  if (b.magic) return rule('g:' + b.g + '-e') || rule('type:E');
  if (b.magicVowel) return rule('g:' + b.g + '-e') || rule('type:E');
  if (b.longOpen) return rule('g:' + b.g + ':' + b.ph) || rule('type:O');
  return rule('g:' + b.g + ':' + b.ph) || (b.g === 'y' && rule('y:' + b.ph)) || (b.ph === 'ə' && rule('g:ə')) || rule('g:' + b.g)
    || ({ ur: rule('g:ir'), le: rule('type:L'), eo: rule('tricky'), eye: rule('tricky') })[b.g] || (b.ph === 'ɜː' && rule('g:ir'))
    || (b.vowel && b.g.length > 1 && rule(/r$/.test(b.g) ? 'type:R' : 'type:T')) || null;
}
