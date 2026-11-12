// 聲音播放
// 英文來源順序：本站上傳的音檔（audio/…）→ phonics-kids 的共用音檔 → 瀏覽器英式語音
// 中文（口訣、指令）：本站 audio/rules、audio/say 音檔 → 瀏覽器中文語音（蒙蒙）
import { DB } from './data.js';

const PK = 'https://hswenforwork.github.io/phonics-kids/';
let assets = new Set();
let pkIndex = {};
let pkSounds = {};
const settings = { rate: 1, sfx: true };
export const setAudioSettings = (s) => Object.assign(settings, s);

export async function initAudio() {
  const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [a, idx, sheet] = await Promise.all([get('assets.json'), get(PK + 'audio/index.json'), get(PK + 'data/sheet.json')]);
  if (a && a.files) assets = new Set(a.files);
  if (idx && idx.items) pkIndex = idx.items;
  if (sheet && sheet.sounds) pkSounds = sheet.sounds;
}
export const hasAsset = (p) => assets.has(p);

// iOS：在第一次觸碰時解鎖音訊
const el = new Audio();
el.preload = 'auto';
let unlocked = false;
function unlock() {
  if (unlocked) return; unlocked = true;
  try { el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; el.play().catch(() => {}); } catch (e) { /* 忽略 */ }
  if (window.speechSynthesis) try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* 忽略 */ }
}
['touchend', 'pointerdown', 'click'].forEach((ev) => addEventListener(ev, unlock, { capture: true, passive: true }));

let token = 0;
function playUrl(url, rate, my) {
  return new Promise((res) => {
    if (my !== token) return res(false);
    let done = false;
    const fin = (ok) => { if (!done) { done = true; el.onended = el.onerror = null; res(ok); } };
    el.onended = () => fin(true); el.onerror = () => fin(false);
    el.src = url; el.playbackRate = rate || 1;
    const p = el.play(); if (p && p.catch) p.catch(() => fin(false));
    setTimeout(() => fin(true), 8000);
  });
}

let voices = { en: null, zh: null };
function pickVoices() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const gb = vs.filter((v) => /^en[-_]GB/i.test(v.lang));
  const pref = ['Serena', 'Kate', 'Martha', 'Stephanie', 'Google UK English Female', 'Sonia', 'Libby', 'Daniel'];
  voices.en = pref.map((n) => gb.find((v) => v.name.includes(n))).find(Boolean) || gb[0] || vs.find((v) => /^en/i.test(v.lang)) || null;
  const tw = vs.filter((v) => /zh[-_](TW|Hant)/i.test(v.lang));
  voices.zh = tw.find((v) => /Mei-?Jia|Meijia|HsiaoChen|Hanhan/i.test(v.name)) || tw[0] || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoices(); speechSynthesis.onvoiceschanged = pickVoices; }

function tts(text, lang, rate, my) {
  return new Promise((res) => {
    if (!window.speechSynthesis || my !== token || !text) return res(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-TW' : 'en-GB';
    const v = lang === 'zh' ? voices.zh : voices.en; if (v) u.voice = v;
    u.rate = (rate || 0.85) * settings.rate; u.pitch = lang === 'zh' ? 1.25 : 1.05;
    let done = false; const fin = () => { if (!done) { done = true; res(true); } };
    u.onend = u.onerror = fin; speechSynthesis.speak(u);
    setTimeout(fin, Math.max(3000, text.length * 300));
  });
}

// 一個片段：{ urls: [...], text, lang, rate, pause, onstart }
async function playOne(it, my) {
  if (my !== token) return;
  if (it.pause) { await new Promise((r) => setTimeout(r, it.pause)); return; }
  if (it.onstart) it.onstart();
  for (const u of it.urls || []) { if (u && await playUrl(u, (it.rate || 1) * settings.rate, my)) return; if (my !== token) return; }
  if (it.text) await tts(it.text, it.lang || 'en', it.ttsRate, my);
}
export async function play(items) {
  const my = ++token;
  if (window.speechSynthesis) speechSynthesis.cancel();
  el.pause();
  for (const it of [].concat(items)) { if (my !== token) break; await playOne(it, my); }
  return my === token;
}
export function stop() { token++; el.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); }

const own = (p) => (assets.has(p) ? p : null);
const phFile = (ph) => Array.from(ph).map((c) => c.codePointAt(0).toString(16)).join('_');

// 一個音（IPA）
export function soundItem(ph, extra) {
  if (!ph) return { pause: 250 };
  const s = DB.soundByIpa[ph];
  const urls = [];
  if (s) urls.push(own('audio/sounds/' + s.sound_id + '.mp3'));
  if (pkSounds[ph]) urls.push(PK + 'audio/' + pkSounds[ph] + '.mp3');
  if (pkIndex['p/' + phFile(ph)]) urls.push(PK + 'audio/p/' + phFile(ph) + '.mp3');
  return Object.assign({ urls, text: '', ttsRate: 0.6 }, extra);
}
export function wordItem(w, extra) {
  const word = typeof w === 'string' ? w : w.word;
  const urls = [own('audio/words/' + word + '.mp3')];
  if (pkIndex['w/' + word]) urls.push(PK + 'audio/w/' + word + '.mp3');
  return Object.assign({ urls, text: word, ttsRate: 0.8 }, extra);
}
export function syllableItem(w, i, extra) {
  const syl = w.sylText[i];
  // 自己的音檔：先找自動產生的「單字-第幾節」，再找共用的音節檔
  const urls = [own('audio/syllables/' + w.word + '-' + i + '.mp3'), own('audio/syllables/' + syl + '.mp3')];
  if (pkIndex['s/' + w.word + '-' + i]) urls.push(PK + 'audio/s/' + w.word + '-' + i + '.mp3');
  return Object.assign({ urls, text: syl, ttsRate: 0.7 }, extra);
}
export function sentenceItem(id, text) {
  return { urls: [own('audio/sentences/' + id + '.mp3')], text, ttsRate: 0.8 };
}
// 中文（蒙蒙說話）
export function say(text, file) {
  return play({ urls: [file && own(file)], text, lang: 'zh', ttsRate: 1 });
}
export function sayRule(r) {
  return play({ urls: [own('audio/rules/' + r.id + '.mp3')], text: r.mnemonic, lang: 'zh', ttsRate: 1 });
}

// 音效（簡單的合成音，不需要檔案）
let ctx;
export function sfx(kind) {
  if (!settings.sfx) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const t = ctx.currentTime;
    const notes = { ok: [660, 880], bad: [300, 220], tap: [520], win: [523, 659, 784, 1047], stamp: [440, 660] }[kind] || [500];
    o.type = kind === 'bad' ? 'triangle' : 'sine';
    notes.forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.09));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + notes.length * 0.09 + 0.15);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + notes.length * 0.09 + 0.2);
  } catch (e) { /* 忽略 */ }
}

// 錄音跟讀（只存在這台裝置的記憶體，不上傳）
let rec = null; let chunks = []; let lastUrl = null;
export async function recordToggle() {
  if (rec && rec.state === 'recording') { rec.stop(); return 'stopped'; }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = []; rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(new Blob(chunks)); };
  rec.start(); return 'recording';
}
export function playRecording() { if (lastUrl) { const my = ++token; return playUrl(lastUrl, 1, my); } return Promise.resolve(false); }
