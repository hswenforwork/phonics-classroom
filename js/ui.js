// 畫面小工具
import { say, sayRule, sfx } from './audio.js';
import { hasAsset } from './audio.js';
import { zy } from './zhuyin.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(zy(c)));
  return el;
}

export const MASCOT = 'images/mascot.png';
export const mascot = (size = 120, cls = '') => h('img', { src: MASCOT, alt: '蒙蒙', class: 'mascot ' + cls, width: size, height: Math.round(size * 1.08) });

// 點標題，蒙蒙就唸出來（不放喇叭圖示）
export function title(text, extra) {
  const t = h('h1', { class: 'speak-title', tabindex: 0, role: 'button', onClick: () => { t.classList.remove('bounce'); void t.offsetWidth; t.classList.add('bounce'); say(text.replace(/[A-Za-z|/]+/g, (m) => m)); } }, text);
  return extra ? h('div', { class: 'title-row' }, t, extra) : t;
}

// 蒙蒙說話泡泡
export function bubble(text, size = 110) {
  return h('div', { class: 'bubble-wrap' }, mascot(size), h('div', { class: 'bubble', onClick: () => say(text) }, text));
}

export function toast(text, ms = 1800) {
  const t = h('div', { class: 'toast' }, text);
  document.body.append(t); setTimeout(() => t.remove(), ms);
}

export function confetti() {
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['#E2483D', '#F2A541', '#7BA05B', '#5DAAB8', '#E3B676'];
  for (let i = 0; i < 40; i++) box.append(h('i', { style: { left: Math.random() * 100 + '%', background: colors[i % 5], animationDelay: Math.random() * 0.5 + 's' } }));
  document.body.append(box); setTimeout(() => box.remove(), 2200);
}

const RELIABILITY = { 一定: ['rock', '一定'], 常常: ['paw', '常常'], 有時候: ['ask', '有時候'] };
export function reliabilityBadge(r) {
  const x = RELIABILITY[r]; if (!x) return null;
  return h('span', { class: 'rel rel-' + x[0], title: '這條規則' + x[1] + '成立' }, h('span', { class: 'rel-ico', 'aria-hidden': 'true' }), x[1]);
}

// 「?」提示視窗：上層給孩子（口訣附注音、點一下蒙蒙唸），下層「更多」給家長
export function ruleDialog(rules) {
  rules = rules.filter(Boolean);
  if (!rules.length) return;
  const close = () => { wrap.remove(); };
  const cards = rules.map((r) => h('section', { class: 'rule-card' },
    h('div', { class: 'rule-head' }, h('span', { class: 'rule-title' }, r.title), reliabilityBadge(r.reliability)),
    h('div', { class: 'rule-kid' }, mascot(78),
      h('div', {},
        h('div', { class: 'rule-who' }, r.character),
        h('button', { class: 'rule-mn bpmf', onClick: () => sayRule(r) }, r.mnemonic),
        r.action && r.action !== '—' ? h('div', { class: 'rule-act' }, '一起做：' + r.action) : null,
        h('div', { class: 'rule-eg' }, r.examples))),
    mouthImage(r),
    h('details', { class: 'rule-more' }, h('summary', {}, '更多（給家長／老師）'),
      h('p', {}, r.parent_note),
      r.contrast && r.contrast !== '—' ? h('p', {}, '對比：' + r.contrast) : null,
      h('p', { class: 'muted' }, '規則編號 ' + r.id))));
  const wrap = h('div', { class: 'modal', role: 'dialog', 'aria-label': '規則提示', onClick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal-box' }, h('button', { class: 'modal-x', 'aria-label': '關閉', onClick: close }, '×'), ...cards));
  document.body.append(wrap);
  sfx('tap');
}
function mouthImage(r) {
  const m = r.title.match(/\/([^/]+)\//); if (!m) return null;
  const p = 'images/mouth/' + encodeURIComponent(m[1]) + '.png';
  return hasAsset('images/mouth/' + m[1] + '.png') ? h('img', { class: 'mouth', src: p, alt: '嘴型示範' }) : null;
}

export function helpButton(getRules) {
  return h('button', { class: 'help', 'aria-label': '這一步的規則說明', onClick: () => ruleDialog(getRules()) }, '?');
}

export const paw = (color = '#E2483D', size = 22) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<g fill="${color}"><ellipse cx="12" cy="15.5" rx="5" ry="4.2"/><ellipse cx="6" cy="10" rx="2.1" ry="2.6"/><ellipse cx="9.7" cy="6.6" rx="2.1" ry="2.6"/><ellipse cx="14.3" cy="6.6" rx="2.1" ry="2.6"/><ellipse cx="18" cy="10" rx="2.1" ry="2.6"/></g>`;
  return s;
};
export const stamps = (n, max = 3, size = 22) => h('span', { class: 'stamps', role: 'img', 'aria-label': n + ' 個腳印章' }, ...Array.from({ length: max }, (_, i) => paw(i < n ? '#E2483D' : '#E6D3B6', size)));

export function wordPicture(w, size = 64) {
  const p = 'images/words/' + w.word + '.png';
  if (hasAsset(p)) return h('img', { src: p, alt: w.word, class: 'wpic', style: { width: size + 'px', height: size + 'px' } });
  if (w.emoji) return h('span', { class: 'wemoji', style: { fontSize: size + 'px' }, 'aria-hidden': 'true' }, w.emoji);
  return h('span', { class: 'wtext', style: { fontSize: Math.round(size * 0.45) + 'px' } }, w.word);
}

export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
