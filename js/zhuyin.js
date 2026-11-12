// 注音：字型「Bpmf Huninn」會在國字旁邊畫注音；破音字在字後面加 IVS（U+E01E0＋第幾個讀音）選讀音
// data/zhuyin.json 由 scripts/build_zhuyin.py 產生：
//   map：網站上每段文字標好讀音的版本（依家長指定 → 教育部常見詞語 → 詞庫判斷）
//   poyin／fix：組合出來的文字（例如「探險過 12 個字」）臨時判斷用
let Z = { map: {}, poyin: {}, fix: [], extra: {} };
export async function initZhuyin() {
  const d = await fetch('data/zhuyin.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (d) Z = d;
}
const CJK = /[㐀-鿿]/;
const matchAt = (t, i, c, p) => { const pos = p.indexOf('*'); const s = i - pos; return s >= 0 && s + p.length <= t.length && t.slice(s, s + p.length) === p.replace(/\*/g, c); };
function pick(t, i, c) {
  const z = Z.poyin[c];
  let best = null;
  for (const f of Z.fix) if (f.char === c && matchAt(t, i, c, f.pattern) && (!best || f.pattern.length > best.pattern.length)) best = f;
  if (best && z.r.includes(best.reading)) return z.r.indexOf(best.reading);
  for (const j of Object.keys(z.p).sort()) if (z.p[j].some((p) => matchAt(t, i, c, p))) return +j;
  return 0;
}
export function zy(text) {
  const t = String(text);
  if (!CJK.test(t)) return t;
  if (Z.map[t]) return Z.map[t];
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i]; out += c;
    if (Z.poyin[c]) { const j = pick(t, i, c); if (j > 0) out += String.fromCodePoint(0xE01E0 + j); }
  }
  return out;
}
// 每個孩子各自的「顯示注音」開關（預設開）
export function applyZhuyin(on) { document.body.classList.toggle('zy', on !== false); }

// 字型裡沒有的字（例如「獴」）：字旁邊另外畫注音。回傳字串（一般情況）或 DocumentFragment
export function zyNode(text) {
  const t = zy(text);
  const keys = Object.keys(Z.extra || {});
  if (!keys.length || !keys.some((k) => t.includes(k))) return document.createTextNode(t);
  const frag = document.createDocumentFragment();
  let buf = '';
  for (const ch of t) {
    if (Z.extra[ch]) {
      if (buf) { frag.append(buf); buf = ''; }
      const s = document.createElement('span'); s.className = 'zy-x';
      const r = document.createElement('span'); r.className = 'zy-x-r'; r.textContent = Z.extra[ch];
      s.append(ch, r); frag.append(s);
    } else buf += ch;
  }
  if (buf) frag.append(buf);
  return frag;
}
