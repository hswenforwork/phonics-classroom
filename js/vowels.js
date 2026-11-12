// 母音沙谷：把字庫每個字的母音格，依「聲音」分到 data/vowels.csv 的卡片上
// 一張卡＝一個聲音；卡上列出這個聲音的各種拼法，每個拼法配字庫裡的例字
import { DB } from './data.js';

// 這一格的拼法：魔法 e 寫成 a_e
export const spellOf = (b) => (b.magicVowel ? b.g + '_e' : b.g);

// 這個聲音＋拼法屬於哪張卡（/ɔː/ 有 r 的拼法放 r 控制區的 or 卡，其他放沙谷的 aw 卡）
export function cardFor(ph, spell) {
  const cards = DB.vowels.filter((c) => c.ipa.split(' ').includes(ph));
  if (cards.length < 2) return cards[0] || null;
  return cards.find((c) => (c.group === 'r') === /r/.test(spell)) || cards[0];
}

let cache = null; let cacheKey = 0;
// 回傳 { cardId: { spellings: [拼法], words: { 拼法: [字] } } }，用全部的字（含還沒有語音的）
export function vowelIndex() {
  if (cache && cacheKey === DB.allWords.length) return cache;
  const idx = {};
  for (const c of DB.vowels) idx[c.id] = { card: c, spellings: c.spellings.split(' ').filter(Boolean), words: {} };
  for (const w of DB.allWords) {
    for (const syl of w.syls) for (const b of syl) {
      if (!b.vowel || !b.ph) continue;
      const sp = spellOf(b); const c = cardFor(b.ph, sp);
      if (!c) continue;
      const e = idx[c.id];
      if (!e.spellings.includes(sp)) e.spellings.push(sp);
      (e.words[sp] ||= []).includes(w) || e.words[sp].push(w);
    }
  }
  cache = idx; cacheKey = DB.allWords.length;
  return idx;
}

// 這個拼法所在的卡（提示視窗連到沙谷用）
export function cardOfSpelling(spell) {
  const idx = vowelIndex();
  return Object.values(idx).find((e) => e.words[spell] && e.words[spell].length)?.card || null;
}
