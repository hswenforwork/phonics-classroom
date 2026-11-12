// 進度只存在這台裝置（localStorage），每個孩子一份
const KEY = 'pc-store-v1';
const ROOM_DAYS = [0, 1, 3, 7, 14]; // 深淺房間：越深隔越久才回來巡邏

function safeGet() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
let root = safeGet() || { profiles: [], current: null, settings: { sfx: true, rate: 1, meaning: false } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (e) { /* 忽略 */ } };

export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export const settings = () => root.settings;
export function setSetting(k, v) { root.settings[k] = v; save(); }
export const profiles = () => root.profiles;
export function addProfile(name, color) {
  const p = { id: 'p' + Date.now(), name, color, words: {}, spent: 0, bonus: 0, items: [], placed: {}, seenGuide: false, edges: {}, mystery: {}, resume: null, stepMiss: {} };
  root.profiles.push(p); root.current = p.id; save(); return p;
}
export function removeProfile(id) { root.profiles = root.profiles.filter((p) => p.id !== id); if (root.current === id) root.current = null; save(); }
export function useProfile(id) { root.current = id; save(); }
export const me = () => root.profiles.find((p) => p.id === root.current) || null;
export const persist = save;

export const wordState = (id) => (me() && me().words[id]) || null;
export function stampsTotal() {
  const p = me(); if (!p) return 0;
  return Object.values(p.words).reduce((s, w) => s + (w.best || 0), 0) + (p.bonus || 0);
}
export const balance = () => stampsTotal() - (me() ? me().spent : 0);

// 完成一個字：記錄最佳腳印章、深淺房間、地道網的連線
export function finishWord(word, stamps, misses) {
  const p = me(); if (!p) return;
  const w = p.words[word.id] || { best: 0, room: 0, plays: 0 };
  w.best = Math.max(w.best, stamps); w.plays++; w.last = today();
  w.room = stamps === 3 ? Math.min(4, (w.room || 0) + 1) : Math.max(0, (w.room || 0) - 1);
  w.due = addDays(today(), ROOM_DAYS[w.room]);
  p.words[word.id] = w;
  const tags = word.tags;
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    const k = [tags[i], tags[j]].sort().join('|'); p.edges[k] = (p.edges[k] || 0) + 1;
  }
  for (const [step, n] of Object.entries(misses || {})) p.stepMiss[step] = (p.stepMiss[step] || 0) + n;
  save();
}

// 巡邏暖身：到期的舊字，最多 n 個
export function dueWords(all, n = 3) {
  const p = me(); if (!p) return [];
  const t = today();
  return all.filter((w) => p.words[w.id] && (p.words[w.id].due || t) <= t)
    .sort((a, b) => (p.words[a.id].room - p.words[b.id].room) || ((p.words[a.id].due || '') < (p.words[b.id].due || '') ? -1 : 1))
    .slice(0, n);
}

export function buy(item) {
  const p = me(); if (!p || balance() < item.cost || p.items.includes(item.id)) return false;
  p.spent += item.cost; p.items.push(item.id); save(); return true;
}
export function place(itemId, slot) { const p = me(); for (const k in p.placed) if (p.placed[k] === itemId) delete p.placed[k]; if (slot != null) p.placed[slot] = itemId; save(); }

export function mysteryDone() { const p = me(); return !!(p && p.mystery[today()]); }
export function markMystery() { const p = me(); if (!p || p.mystery[today()]) return; p.mystery[today()] = 1; p.bonus = (p.bonus || 0) + 3; save(); }

// 母音小遊戲：每一站每天第一次玩完可以拿腳印章
export function vowelReward(no, n) {
  const p = me(); if (!p) return 0;
  p.vowelGame = p.vowelGame || {};
  const k = today() + '|' + no;
  if (p.vowelGame[k] != null || n <= 0) { if (p.vowelGame[k] == null) p.vowelGame[k] = 0; save(); return 0; }
  p.vowelGame[k] = n; p.bonus = (p.bonus || 0) + n; save(); return n;
}
export function setResume(r) { const p = me(); if (!p) return; p.resume = r; save(); }
export const resume = () => (me() ? me().resume : null);
export function guideSeen() { const p = me(); if (p) { p.seenGuide = true; save(); } }
