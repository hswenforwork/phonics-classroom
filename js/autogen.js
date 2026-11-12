// 家長專區：輸入一個英文單字，自動產生字庫欄位
// 音標：線上字典（優先英式）→ 只有美式就轉成英式 → 查不到就依規則推測
// 音節、音格、類型、調皮字母、字尾：用 phonics-kids 的自然發音分析引擎（js/vendor/pk-phonics.js）
import { DB, DEFAULT_PH } from './data.js';

const DICT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const CACHE_KEY = 'pc-dict-cache-v1';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { cache = {}; }
const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* 忽略 */ } };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

let engineReady;
function engine() {
  if (window.PK_PHONICS) return Promise.resolve(window.PK_PHONICS);
  engineReady = engineReady || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'js/vendor/pk-phonics.js';
    s.onload = () => res(window.PK_PHONICS); s.onerror = () => rej(new Error('分析引擎載入失敗'));
    document.head.append(s);
  });
  return engineReady;
}
let emojiMap;
async function emojiFor(words) {
  if (!emojiMap) emojiMap = await fetch('data/emoji.json').then((r) => r.json()).catch(() => ({}));
  for (const w of words) if (w && emojiMap[w]) return emojiMap[w];
  return '';
}

// 查字典：回傳 { ok, ipa, source: 'uk' | 'us' | 'none' }
async function dict(w) {
  if (cache[w]) return cache[w];
  let out = { ok: false, ipa: '', source: 'none' };
  try {
    const r = await withTimeout(fetch(DICT + encodeURIComponent(w)), 8000);
    if (r.ok) {
      const data = await r.json();
      const ph = data.flatMap((d) => (d.phonetics || []).map((p) => ({ text: p.text || '', audio: p.audio || '' })));
      const uk = ph.find((p) => /-uk\.mp3/.test(p.audio) && p.text);
      const us = ph.find((p) => /-us\.mp3/.test(p.audio) && p.text);
      const any = ph.find((p) => p.text) || { text: (data[0] && data[0].phonetic) || '' };
      if (uk) out = { ok: true, ipa: uk.text, source: 'uk' };
      else if (us || any.text) out = { ok: true, ipa: (us || any).text, source: 'us' };
      else out = { ok: true, ipa: '', source: 'none' };
    } else if (r.status === 404) out = { ok: false, ipa: '', source: 'none' };
    else return out; // 其他錯誤不快取
  } catch (e) { return out; }
  cache[w] = out; saveCache();
  return out;
}

async function translate(w) {
  try {
    const r = await withTimeout(fetch('https://api.mymemory.translated.net/get?langpair=en|zh-TW&q=' + encodeURIComponent(w)), 8000);
    if (!r.ok) return '';
    const d = await r.json();
    const t = ((d.responseData || {}).translatedText || '').trim();
    if (!t || t.toLowerCase() === w || /MYMEMORY|QUERY LENGTH|INVALID/i.test(t)) return '';
    return t.replace(/[。.]$/, '');
  } catch (e) { return ''; }
}

// 美式音標轉英式（粗略）：r 不發音、oʊ→əʊ、ɑ→ɒ（短 o）
function usToUk(ipa) {
  return ipa
    .replace(/oʊ/g, 'əʊ').replace(/ɝ/g, 'ɜː').replace(/ɚ/g, 'ə')
    .replace(/ɑ(ː)?[rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'ɑː').replace(/ɔ(ː)?[rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'ɔː')
    .replace(/[ɛe][rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'eə').replace(/ɪ[rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'ɪə').replace(/ʊ[rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'ʊə')
    .replace(/ɜ[rɹ]/g, 'ɜː').replace(/ə[rɹ](?![aeiouæɑɒɔəɛɪʊʌ])/g, 'ə')
    .replace(/ɑ(?!ː)/g, 'ɒ').replace(/ɛ/g, 'e').replace(/ɹ/g, 'r');
}
function cleanIpa(ipa) {
  return String(ipa || '').replace(/\([^)]*\)/g, '').replace(/[\/\[\]]/g, '').replace(/l̩/g, 'əl').replace(/n̩/g, 'ən').replace(/m̩/g, 'əm')
    .replace(/ɹ/g, 'r').replace(/g/g, 'ɡ').replace(/ɐ/g, 'ə').replace(/ᵻ/g, 'ɪ').replace(/\s+/g, '').trim();
}
// 引擎內部用美式寫法，轉回英式寫法
const UK = (ph) => ({ oʊ: 'əʊ', ɑ: 'ɒ', ɛ: 'e', 'ɛr': 'eə', 'ɪr': 'ɪə', 'ɑr': 'ɑː', 'ɔr': 'ɔː', 'ɜr': 'ɜː', 'ər': 'ə', 'ʊr': 'ʊə', g: 'ɡ' }[ph] || ph);

const US = (ph) => ({ 'əʊ': 'oʊ' }[ph] || ph);

// 從英文字找出要問字典「是不是一個字」的候選（字根、複合字兩半）
function candidates(w) {
  const c = new Set();
  for (const s of ['ing', 'ed', 'er', 'est', 'ly', 'ful', 'less', 'ness', 'ment', 'y', 's', 'es']) {
    if (!w.endsWith(s) || w.length <= s.length + 2) continue;
    const st = w.slice(0, -s.length);
    c.add(st); c.add(st + 'e');
    if (st.length > 2 && st.at(-1) === st.at(-2)) c.add(st.slice(0, -1));
    if (st.endsWith('i')) c.add(st.slice(0, -1) + 'y');
    if (s === 'es' && st.endsWith('v')) { c.add(st.slice(0, -1) + 'f'); c.add(st.slice(0, -1) + 'fe'); }
  }
  for (const p of ['un', 're']) if (w.startsWith(p) && w.length > p.length + 2) c.add(w.slice(p.length));
  for (let k = 3; k <= w.length - 3; k++) { c.add(w.slice(0, k)); c.add(w.slice(k)); }
  c.delete(w);
  // 字尾、字首本身不算一個字（字典可能查得到 ing、ness 等縮寫）
  for (const a of ['ing', 'ed', 'er', 'est', 'ly', 'ful', 'less', 'ness', 'ment', 'es', 'un', 're', 'pre', 'dis', 'mis', 'non', 'sub', 'over']) c.delete(a);
  return [...c];
}
async function knownSet(w) {
  const known = new Set((DB.allWords.length ? DB.allWords : DB.words).map((x) => x.word));
  const list = candidates(w).filter((x) => !known.has(x));
  await Promise.all(list.map(async (x) => { const d = await dict(x); if (d.ok) known.add(x); }));
  return known;
}

// 依「這個字用到的最難規則」決定地點
function stageOf(info) {
  if (info.tricky || info.types.includes('W') || info.silent) return [8, '有不照規則的讀音或不發音的字母'];
  if (info.schwa) return [8, '有弱讀 /ə/'];
  if (info.suffix) return [7, '有字首或字尾'];
  if (info.types.length > 1) return [6, '有 ' + info.types.length + ' 個音節'];
  if (info.magic || info.soft || info.yVowel || info.alt) return [5, info.magic ? '有魔法 e' : info.soft ? '有軟 c 或軟 g' : info.yVowel ? 'y 當母音' : '母音不是最常見的讀法'];
  if (info.blend) return [4, '有子音群'];
  if (/[TRD]/.test(info.types.join(''))) return [3, '有母音組合或 r 控制母音'];
  if (info.digraph) return [2, '有二合字母'];
  return [1, '短母音 CVC'];
}

/**
 * 回傳 { fields: {word, stage, emoji, zh, syllables, sounds, ipa, types, stress, tricky, suffix}, warn: {欄位: 原因}, note: {欄位: 說明} }
 */
export async function autogen(raw, opts = {}) {
  const w = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) throw new Error('請輸入英文單字');
  const P = await engine();
  const [d, zh, known] = await Promise.all([opts.ipa ? { ok: true, ipa: opts.ipa, source: 'uk' } : dict(w), opts.offline ? '' : translate(w), knownSet(w)]);
  const warn = {}; const note = {};
  let ipa = '';
  if (d.ipa && d.source === 'uk') ipa = cleanIpa(d.ipa);
  else if (d.ipa) { ipa = cleanIpa(usToUk(d.ipa)); warn.ipa = '字典只有美式音標，已自動轉成英式，請確認'; }
  else warn.ipa = '字典查不到這個字，音標是依規則推測的，請確認';

  // 常見視字（said、was…）引擎會整個字略過分析；這裡先拿掉，讓它照樣切音節、對讀音，再找出不照規則的字母
  const wasSight = P.SIGHT.has(w);
  if (wasSight) P.SIGHT.delete(w);
  let r;
  try { r = P.analyze(w, { ipa: ipa || undefined, known }); } finally { if (wasSight) P.SIGHT.add(w); }
  let boxes = P.elkonin(r);
  let syllables = r.syllables.slice();
  const ipaFlat = ipa.replace(/[ˈˌ.]/g, '');
  // 複數 -es / -ves 念 /z/、/s/（leaves）：e 不自成音節，es 放同一格
  if (/es$/.test(w) && ipaFlat && !/ɪz$/.test(ipaFlat) && syllables.length > 1 && /^[^aeiouy]*es$/.test(syllables.at(-1))) {
    const last = syllables.pop(); syllables[syllables.length - 1] += last;
    const n = syllables.length - 1;
    const e = boxes.at(-2); const sB = boxes.at(-1);
    boxes = boxes.slice(0, -2).map((x) => ((x.syl || 0) > n ? Object.assign(x, { syl: n }) : x));
    boxes.push({ letters: 'es', ph: /s$/.test(ipaFlat) ? 's' : 'z', type: 'C', syl: n, unit: null });
    if (!e || !sB) boxes = P.elkonin(r);
  }
  // 過去式 -ed 不自成音節（jumped、played）：ed 放同一格
  if (r.affix && r.affix.suffix === 'ed' && boxes.length > 1 && boxes.at(-2).silent && boxes.at(-2).letters === 'e' && boxes.at(-1).letters === 'd') {
    const dB = boxes.pop(); boxes.pop();
    boxes.push({ letters: 'ed', ph: dB.ph || 'd', type: 'C', syl: dB.syl, unit: null });
  }
  const sylN = syllables.length;
  if (r.warnings && r.warnings.length && sylN === r.syllables.length) warn.syllables = r.warnings.join('；') + '，請確認音節切法';

  // 音格寫法
  const sylTok = Array.from({ length: sylN }, () => []);
  let pendingPrefix = '';
  const info = { silent: false, magic: false, soft: false, yVowel: false, alt: false, blend: false, digraph: false, suffix: '', tricky: '', types: [] };
  const sylIpa = Array.from({ length: sylN }, () => '');
  const silentLetters = [];
  const SY = (b) => Math.min(b.syl || 0, sylN - 1);
  // 沒有字典音標時，依規則推測每格的讀音
  const LONGV = { a: 'eɪ', e: 'iː', i: 'aɪ', o: 'əʊ', u: 'juː' };
  const at = (k) => { let i = 0; for (let j = 0; j < k; j++) i += boxes[j].letters.length; return i; };
  function guessPh(b, k) {
    const nx = w[at(k) + b.letters.length] || '';
    if (b.type === 'V' && b.letters.length === 1) {
      const s = SY(b); const inSyl = boxes.filter((x) => !x.silent && SY(x) === s);
      const magic = b.magicBy || boxes.some((x) => x.silent && x.magic && SY(x) === s);
      const open = inSyl[inSyl.length - 1] === b;
      if (b.letters === 'y') return sylN > 1 ? 'i' : 'aɪ';
      if (magic || (open && (sylN > 1 || k === boxes.length - 1) && b.letters !== 'e')) return LONGV[b.letters] || '';
      if (open && b.letters === 'e' && boxes.length <= 3) return 'iː';
      return '';
    }
    if (b.letters === 'c' && /[eiy]/.test(nx)) return 's';
    if (b.letters === 'g' && /[eiy]/.test(nx) && k > 0) return 'dʒ';
    if (b.letters === 'y' && k > 0) return sylN > 1 ? 'i' : 'aɪ';
    return '';
  }
  boxes.forEach((b, k) => {
    const s = SY(b);
    const toks = sylTok[s];
    if (b.silent) {
      if (b.magic) { const t = toks.length ? toks : sylTok[s - 1] || toks; if (t.length) t[t.length - 1] += '(e)'; info.magic = true; return; }
      const finalE = b.letters === 'e' && k === boxes.length - 1;
      if (!finalE) { info.silent = true; silentLetters.push(b.letters); }
      if (toks.length) toks[toks.length - 1] += '[' + b.letters + ']';
      else pendingPrefix += '[' + b.letters + ']';
      return;
    }
    let ph = ipa ? UK(b.ph || '') : guessPh(b, k);
    if (!ph) ph = DEFAULT_PH[b.letters] || '';
    const def = DEFAULT_PH[b.letters];
    const dupSecond = b.dblSplit && boxes[k - 1] && boxes[k - 1].dblSplit && boxes[k - 1].letters === b.letters;
    toks.push(pendingPrefix + b.letters + (ph && ph !== def ? '=' + ph : '')); pendingPrefix = '';
    if (!dupSecond) sylIpa[s] += ph;
    b._ph = ph;
    // 子音群：同一音節裡兩個相鄰、各自發音的單一子音（fr、st、mp）
    const prev = boxes[k - 1];
    if (b.type === 'C' && b.letters.length === 1 && prev && !prev.silent && prev.type === 'C' && prev.letters.length === 1 && SY(prev) === s && !b.dblSplit && b.letters !== 'x') info.blend = true;
    if (b.type === 'C' && (b.sub === 'digraph' || b.sub === 'trigraph' || b.dbl || b.letters.length > 1) && b.letters !== 'es' && b.letters !== 'ed') info.digraph = true;
    if ((b.letters === 'c' && ph === 's') || (b.letters === 'g' && ph === 'dʒ')) info.soft = true;
    if (b.letters === 'y' && b.type === 'V') info.yVowel = true;
  });

  // 音節類型與調皮字母
  const types = []; const tricky = []; const whyW = [];
  for (let s = 0; s < sylN; s++) {
    const bs = boxes.filter((b) => !b.silent && SY(b) === s);
    const v = bs.find((b) => b.type === 'V');
    const hasMagic = boxes.some((b) => b.silent && b.magic && SY(b) === s);
    let t = 'C';
    if (!v) t = 'C';
    else if (hasMagic || v.magicBy) t = 'E';
    else if (v.sub === 'le' || v.letters === 'le') t = 'L';
    else if (v.sub === 'bossy' || v.sub === 'team_r') t = 'R';
    else if (v.letters.length > 1) t = /^(aʊ|ɔɪ)$/.test(v._ph) ? 'D' : 'T';
    else t = bs[bs.length - 1] === v ? 'O' : 'C';
    if (v && v.unit && !v.weak) {
      const u = v.unit; const keep = u.ph;
      u.ph = US(u.ph); // 規則表用美式寫法比對
      const n = P.ruleNote(r, u);
      u.ph = keep;
      if (n && !/英式念法|去 E/.test(n.why)) { t = 'W'; if (/例外|w 後面/.test(n.why)) tricky.push(v.letters); whyW.push(`${v.letters} 念 /${keep}/：${n.why}`); }
      else if (n && v.letters.length === 1 && !/去 E/.test(n.why)) info.alt = true;
    }
    if (v && sylN > 1 && s < sylN - 1 && v.letters.length === 1 && v._ph === 'ə') { info.schwa = true; note.schwa = `${v.letters} 弱讀成 /ə/`;
    }
    types.push(t);
  }
  if (wasSight && !types.includes('W')) { types[0] = 'W'; whyW.push('這是常見的視字（看到就要認得的字）'); }
  tricky.push(...silentLetters);
  info.types = types; info.tricky = [...new Set(tricky)].join('');
  if (whyW.length) warn.types = '有不照規則的念法（' + whyW.join('；') + '），請確認';
  if (info.tricky) warn.tricky = '依字典讀音判斷這些字母不照規則念或不發音，請確認';

  // 重音與音標（多音節用點分開，重音符號放在重音節前面，不另加點）
  let stress = 1;
  boxes.forEach((b) => { if (b.type === 'V' && b.unit && b.unit.stressed && sylN > 1 && /ˈ/.test(ipa)) stress = SY(b) + 1; });
  const ipaOut = sylIpa.map((x, i) => (i > 0 && i + 1 !== stress ? '.' : '') + (sylN > 1 && i + 1 === stress ? 'ˈ' : '') + x).join('');
  if (sylN > 1 && !/ˈ/.test(ipa)) warn.stress = '字典沒有標重音，先放在第 1 節，請確認';

  // 字首、字尾
  const af = r.affix || {};
  const lastPh = ipaOut.replace(/[ˈ.]/g, '');
  const end = (re) => re.test(lastPh);
  const SP = { double: '雙寫', drop_e: '去e', y_to_i: 'y變i' };
  let suffix = '';
  if (af.suffix) {
    const base = af.spell && af.spell.base ? af.spell.base : af.root;
    let rule = (af.spell && SP[af.spell.type]) || '';
    if (af.suffix === 'ed') rule = (rule ? rule + ' ' : '') + (end(/[^eaɔo]ɪd$/) ? '/ɪd/' : end(/t$/) ? '/t/' : '/d/');
    suffix = `${base}+${af.suffix}${rule ? '|' + rule : ''}`;
  } else if (/s$/.test(w)) {
    const tries = [['es', (s) => (/i$/.test(s) ? s.slice(0, -1) + 'y' : ''), 'y變i'], ['ves', (s) => s + 'f', 'f變ves'], ['ves', (s) => s + 'fe', 'f變ves'], ['es', (s) => s, ''], ['s', (s) => s, '']];
    for (const [sfx, mk, rule] of tries) {
      if (!w.endsWith(sfx)) continue;
      const base = mk(w.slice(0, -sfx.length));
      if (base.length < 2 || !known.has(base)) continue;
      const sound = end(/ɪz$/) ? '/ɪz/' : end(/s$/) ? '/s/' : '/z/';
      suffix = `${base}+${sfx}|${rule || sound}`; break;
    }
  }
  if (af.prefix) suffix = `${af.prefix}+${af.root}` + (suffix ? '；' + suffix : '');
  info.suffix = suffix;
  if (suffix) warn.suffix = `自動拆成「${suffix.split('|')[0]}」，請確認 ${w} 真的是這樣組成的`;

  // 地點、圖示、中文
  const [stage, why] = stageOf(info);
  note.stage = '依規則判斷：' + why;
  const emoji = await emojiFor([w, af.root, af.spell && af.spell.base, suffix.split('+')[0]]);
  if (!emoji) warn.emoji = '找不到對應的圖示，空白會顯示文字卡';
  if (zh) warn.zh = '自動翻譯的，請確認是孩子聽得懂的說法'; else warn.zh = '查不到中文，請自己填寫';
  if (!ipa) { warn.syllables = warn.syllables || '沒有字典音標，音節與音格是依規則推測的，請確認'; warn.sounds = '沒有字典音標，每格的讀音是依規則推測的，請確認'; }

  return {
    fields: { word: w, stage: String(stage), emoji, zh, syllables: syllables.join('/'), sounds: sylTok.map((t) => t.join('-')).join('/'), ipa: '/' + ipaOut + '/', types: types.join('/'), stress: String(stress), tricky: info.tricky, suffix },
    warn, note, source: d.source,
  };
}
