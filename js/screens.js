// 各個畫面
import { DB, PLACES, NODES, DEFAULT_PH, wordsOf, rule } from './data.js';
import { play, stop, wordItem, sentenceItem, say, sfx, setAudioSettings } from './audio.js';
import { h, title, bubble, mascot, toast, confetti, stamps, paw, wordPicture, shuffle, ruleDialog } from './ui.js';
import { playWord, spellWord } from './word.js';
import * as S from './store.js';

const app = () => document.getElementById('app');
const REPO = 'hswenforwork/phonics-classroom';

function topBar(back, ...right) {
  return h('header', { class: 'top' },
    back ? h('button', { class: 'icon-btn', 'aria-label': '返回', onClick: back }, '‹') : h('div', { class: 'brand' }, h('img', { src: 'images/mascot.png', alt: '', width: 44, height: 47 }), h('div', {}, h('b', {}, '蒙蒙的拼音家園'), h('small', {}, 'Phonics Burrow'))),
    h('div', { class: 'top-right' }, ...right));
}
const stampCount = () => h('div', { class: 'stamp-count', role: 'img', 'aria-label': '腳印章 ' + S.balance() }, paw('#E2483D', 26), String(S.balance()));
const dune = () => h('div', { class: 'dune', 'aria-hidden': 'true' });

// ---------- 選孩子 ----------
const COLORS = ['#E2483D', '#F2A541', '#7BA05B', '#5DAAB8', '#9C86D9', '#B5643C'];
export function profilesScreen() {
  const list = S.profiles();
  let color = COLORS[list.length % COLORS.length];
  const name = h('input', { id: 'pname', maxlength: 8, placeholder: '名字', autocomplete: 'off' });
  const colorRow = h('div', { class: 'colors' }, ...COLORS.map((c) => h('button', { class: 'color' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': '選這個顏色', onClick: (e) => { color = c; colorRow.querySelectorAll('.color').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
  app().replaceChildren(h('div', { class: 'screen profiles' }, dune(),
    h('main', { class: 'center' }, bubble('歡迎來我家！你是誰呢？', 150),
      h('div', { class: 'who' }, ...list.map((p) => h('button', { class: 'who-card', style: { borderColor: p.color }, onClick: () => { S.useProfile(p.id); go('home'); } }, h('span', { class: 'avatar', style: { background: p.color } }, p.name.slice(0, 1)), p.name))),
      h('form', { class: 'new-kid', onSubmit: (e) => { e.preventDefault(); const n = name.value.trim(); if (!n) return name.focus(); S.addProfile(n, color); go('home'); } },
        h('label', { for: 'pname' }, '新的探險隊員'), name, colorRow, h('button', { class: 'btn primary', type: 'submit' }, '加入探險隊')))));
}

// ---------- 首頁地圖 ----------
function placeProgress(no) {
  const ws = wordsOf(no); const p = S.me();
  const done = ws.filter((w) => p.words[w.id]).length;
  return { done, total: ws.length, lamps: ws.length ? Math.round((done / ws.length) * 5) : 0 };
}
function mysteryWord() {
  const ws = DB.words; if (!ws.length) return null;
  const d = S.today().replace(/-/g, ''); let x = 0; for (const c of d) x = (x * 31 + c.charCodeAt(0)) % 100003;
  return ws[x % ws.length];
}
export function homeScreen() {
  const p = S.me(); if (!p) return go('profiles');
  const resume = S.resume();
  const mw = mysteryWord();
  const spots = PLACES.slice(1).map((pl) => {
    const pr = placeProgress(pl.no);
    return h('a', { class: 'spot', href: '#place/' + pl.no, style: { '--fg': pl.fg, '--bg': pl.bg, '--tx': pl.tx } },
      h('span', { class: 'spot-ico icon-' + pl.icon, 'aria-hidden': 'true' }), h('span', { class: 'spot-no' }, pl.no),
      h('b', {}, pl.name), h('small', {}, pl.topic), h('span', { class: 'eg' }, pl.eg),
      h('span', { class: 'lamps', role: 'img', 'aria-label': `已走 ${pr.lamps} / 5 個腳印` }, ...Array.from({ length: 5 }, (_, i) => paw(i < pr.lamps ? '#E2483D' : '#E6D3B6', 18))));
  });
  app().replaceChildren(h('div', { class: 'screen home' },
    topBar(null, stampCount(),
      h('a', { class: 'btn green', href: '#book' }, '探險手冊'),
      h('a', { class: 'btn', href: '#burrow' }, '我的地洞'),
      h('button', { class: 'icon-btn', 'aria-label': '換人', onClick: () => go('profiles') }, h('span', { class: 'avatar sm', style: { background: p.color } }, p.name.slice(0, 1))),
      h('a', { class: 'icon-btn lock', href: '#parent', 'aria-label': '家長專區' }, '⚙')),
    dune(),
    h('main', { class: 'home-main' },
      h('aside', { class: 'home-side' },
        bubble(resume ? '上次的探險還沒走完喔！' : '今天去哪裡探險？', 170),
        resume && DB.byId[resume.wordId] ? h('button', { class: 'btn primary', onClick: () => runWords([DB.byId[resume.wordId]], { quick: resume.quick }) }, '繼續上次的探險') : null,
        h('button', { class: 'btn primary big', onClick: startAdventure }, '出發探險！'),
        mw ? h('button', { class: 'mystery' + (S.mysteryDone() ? ' done' : ''), onClick: () => runWords([mw], { mystery: true }) }, h('span', { class: 'glow', 'aria-hidden': 'true' }), S.mysteryDone() ? '今天的神秘字找到了！' : '今天的神秘洞口')
          : null),
      h('section', { class: 'map', 'aria-label': '八個探險地點' }, ...spots))));
}

// 一趟探險：巡邏暖身 3 個舊字 → 2～3 個新字
function startAdventure() {
  const p = S.me();
  const warm = S.dueWords(DB.words, 3);
  let stage = 1;
  for (let i = 1; i <= 8; i++) { const pr = placeProgress(i); if (pr.done < pr.total) { stage = i; break; } }
  const fresh = wordsOf(stage).filter((w) => !p.words[w.id]).slice(0, warm.length ? 2 : 3);
  const list = [...warm, ...fresh];
  if (!list.length) return toast('全部都探險過了！到探險手冊看看吧！');
  runWords(list, { warmCount: warm.length });
}

export function runWords(list, { quick = false, warmCount = 0, mystery = false, back = 'home' } = {}) {
  let i = 0;
  const results = [];
  const nextWord = () => {
    if (i >= list.length) return summary();
    const w = list[i];
    const isWarm = i < warmCount;
    if (isWarm && i === 0) { say('先跟蒙蒙巡邏一下，複習以前的字！'); }
    playWord(app(), w, {
      quick: quick || isWarm,
      onDone: (got) => { results.push([w, got]); if (mystery) { S.markMystery(); toast('神秘字找到了！多 3 個腳印章！'); } i++; nextWord(); },
      onExit: () => go(back),
    });
  };
  const summary = () => {
    stop(); sfx('win'); confetti();
    const total = results.reduce((s, r) => s + r[1], 0);
    app().replaceChildren(h('div', { class: 'screen' }, dune(), h('main', { class: 'center' },
      bubble(`這趟探險收集了 ${total} 個腳印章！`, 160),
      h('div', { class: 'sum-list' }, ...results.map(([w, g]) => h('div', { class: 'sum-item' }, wordPicture(w, 40), h('b', {}, w.word), stamps(g, 3, 20)))),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: () => go(back) }, '回到地圖'), h('a', { class: 'btn', href: '#burrow' }, '去佈置地洞')))));
    say(`這趟探險收集了 ${total} 個腳印章！`);
  };
  nextWord();
}

// ---------- 一個地點 ----------
const TABS = [['words', '單字'], ['spell', '我來拼'], ['sent', '讀句子'], ['story', '小故事'], ['pairs', '聽聽看']];
export function placeScreen(no, tab = 'words') {
  no = +no; const pl = PLACES[no]; const p = S.me(); if (!p || !pl) return go('home');
  const ws = wordsOf(no); const pr = placeProgress(no);
  const body = h('div', { class: 'tab-body' });
  const tabs = h('nav', { class: 'tabs' }, ...TABS.map(([k, n]) => h('a', { class: 'tab' + (k === tab ? ' on' : ''), href: `#place/${no}/${k}` }, n)));
  app().replaceChildren(h('div', { class: 'screen place', style: { '--bg': pl.bg, '--fg': pl.fg, '--tx': pl.tx } },
    topBar(() => go('home'), h('div', { class: 'place-title' }, h('b', {}, pl.name), h('small', {}, pl.topic + `｜探險過 ${pr.done} / ${pr.total} 個字`)), stampCount()),
    dune(), tabs, body));
  ({ words: tabWords, spell: tabSpell, sent: tabSentences, story: tabStory, pairs: tabPairs })[tab](body, no, ws);
}

function wordCard(w, onClick) {
  const st = S.wordState(w.id);
  return h('button', { class: 'wcard' + (st ? ' done' : ' new') + (w.boss ? ' boss' : ''), onClick },
    w.boss ? h('span', { class: 'boss-tag' }, '隊長挑戰字') : null,
    wordPicture(w, 50), h('b', {}, w.word), st ? stamps(st.best, 3, 18) : h('small', {}, '還沒探險'));
}
function tabWords(body, no, ws) {
  const boss = ws.find((w) => w.boss);
  body.append(title('選一個字開始探險！'),
    h('div', { class: 'cards-grid' }, ...ws.filter((w) => !w.boss).map((w) => wordCard(w, () => runWords([w], { back: 'place/' + no })))),
    boss ? h('div', { class: 'boss-row' }, wordCard(boss, () => runWords([boss], { back: 'place/' + no })), h('p', {}, '蓋滿 3 個腳印章，挑戰成功！')) : null);
}
function tabSpell(body, no, ws) {
  const pick = shuffle(ws).slice(0, 5); let i = 0;
  const one = () => { if (i >= pick.length) { go('place/' + no + '/spell'); return; } spellWord(app(), pick[i], { onDone: () => { i++; one(); }, onExit: () => go('place/' + no) }); };
  body.append(title('聽一聽，自己拼拼看！'), bubble('蒙蒙唸一個字，你把字母放進格子裡。', 90), h('button', { class: 'btn primary big', onClick: one }, '開始拼（5 個字）'));
}
function tabSentences(body, no) {
  const list = DB.sentences.filter((s) => +s.stage === no);
  body.append(title('讀讀看，點一個字聽它怎麼唸！'), ...list.map((s) => h('div', { class: 'sentence' },
    h('div', { class: 'sent-words' }, ...s.text.split(/\s+/).map((tok) => h('button', { class: 'sw', onClick: () => play(wordItem(tok.replace(/[^A-Za-z']/g, '').toLowerCase())) }, tok))),
    h('button', { class: 'btn', onClick: () => play(sentenceItem(s.id, s.text)) }, '聽整句'),
    S.settings().meaning ? h('small', { class: 'zh' }, s.meaning_zh) : null)));
}
function tabStory(body, no) {
  const pages = DB.stories.filter((s) => +s.stage === no);
  if (!pages.length) return;
  const pr = placeProgress(no);
  const open = Math.max(1, Math.ceil((pr.done / Math.max(1, pr.total)) * pages.length));
  let k = 0;
  const box = h('div', { class: 'story' });
  const draw = () => {
    const pg = pages[k];
    box.replaceChildren(
      h('div', { class: 'story-page' }, mascot(110), h('div', { class: 'story-text' }, ...pg.text.split(/\s+/).map((tok) => h('button', { class: 'sw', onClick: () => play(wordItem(tok.replace(/[^A-Za-z']/g, '').toLowerCase())) }, tok))),
        S.settings().meaning ? h('small', { class: 'zh' }, pg.meaning_zh) : null),
      h('div', { class: 'story-nav' },
        h('button', { class: 'btn', disabled: k === 0, onClick: () => { k--; draw(); } }, '上一頁'),
        h('button', { class: 'btn', onClick: () => play({ urls: [], text: pg.text, ttsRate: 0.8 }) }, '聽這一頁'),
        h('span', {}, `${k + 1} / ${pages.length}`),
        h('button', { class: 'btn primary', disabled: k + 1 >= open, onClick: () => { k++; draw(); } }, k + 1 >= open && k + 1 < pages.length ? '多探險幾個字解鎖' : '下一頁')));
  };
  body.append(title(pages[0].title_zh), box); draw();
}
function tabPairs(body, no) {
  let list = DB.pairs.filter((p) => +p.stage <= no);
  if (!list.length) list = DB.pairs;
  let cur; let target;
  const area = h('div', { class: 'pairs' });
  const round = () => {
    cur = list[Math.floor(Math.random() * list.length)]; target = Math.random() < 0.5 ? 'a' : 'b';
    const r = rule('pair:' + cur.rule);
    area.replaceChildren(
      h('button', { class: 'big-round', onClick: () => play(wordItem(cur['word_' + target])) }, '聽一聽'),
      h('div', { class: 'choices' }, ...['a', 'b'].map((k) => h('button', { class: 'choice pair', onClick: (e) => {
        if (k !== target) { sfx('bad'); e.currentTarget.classList.add('shake'); toast(r ? r.mnemonic : '再聽一次！'); play(wordItem(cur['word_' + target])); return; }
        sfx('ok'); e.currentTarget.classList.add('right'); setTimeout(round, 900);
      } }, h('b', {}, cur['word_' + k]), h('small', {}, cur['sound_' + k])))),
      r ? h('button', { class: 'link', onClick: () => ruleDialog([r]) }, '嘴巴怎麼做？') : null);
    play(wordItem(cur['word_' + target]));
  };
  body.append(title('聽聽看，蒙蒙說的是哪一個？'), area); round();
}

// ---------- 探險手冊：地道網、深淺房間、收集 ----------
export function bookScreen(tab = 'net') {
  const p = S.me(); if (!p) return go('profiles');
  const body = h('div', { class: 'tab-body' });
  app().replaceChildren(h('div', { class: 'screen book' }, topBar(() => go('home'), h('b', {}, '探險手冊'), stampCount()), dune(),
    h('nav', { class: 'tabs' }, ...[['net', '地道網'], ['rooms', '深淺房間'], ['stickers', '收集冊']].map(([k, n]) => h('a', { class: 'tab' + (k === tab ? ' on' : ''), href: '#book/' + k }, n))), body));
  if (tab === 'net') {
    const lit = new Set(); for (const id of Object.keys(p.words)) { const w = DB.byId[id]; if (w) w.tags.forEach((t) => lit.add(t)); }
    const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
    const edges = Object.entries(p.edges).map(([k, n]) => [k.split('|'), n]).filter(([[a, b]]) => pos[a] && pos[b]);
    const svg = `<svg viewBox="0 0 860 490" role="img" aria-label="地道網：學會的規則會亮起來，一起用過的規則會挖通地道">
      <rect x="0" y="0" width="860" height="490" rx="28" fill="#B07A4E"/>
      ${edges.map(([[a, b], n]) => `<line x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}" stroke="#F2A541" stroke-opacity="${Math.min(1, 0.35 + n * 0.12)}" stroke-width="${Math.min(14, 4 + n)}" stroke-linecap="round"/>`).join('')}
      ${NODES.map((n) => `<g><ellipse cx="${n.x}" cy="${n.y}" rx="70" ry="32" fill="${lit.has(n.id) ? '#FFF1D2' : '#5A3E2B'}" stroke="${lit.has(n.id) ? '#F2A541' : '#4A3426'}" stroke-width="4"/><text x="${n.x}" y="${n.y + 6}" text-anchor="middle" font-size="17" font-weight="700" fill="${lit.has(n.id) ? '#4A3426' : '#C9A98A'}">${n.name}</text></g>`).join('')}
    </svg>`;
    body.append(title('地道網：學會的規則房間會亮起來！'), h('div', { class: 'net', html: svg }),
      h('p', { class: 'hint' }, `已經點亮 ${lit.size} / ${NODES.length} 間房，挖通 ${edges.length} 條地道。同一個字用到兩條規則，兩間房之間就會挖通。`));
  } else if (tab === 'rooms') {
    const names = ['洞口（明天再見）', '淺房間（3 天後）', '中房間（1 週後）', '深房間（2 週後）', '最深的寶藏房'];
    const cols = names.map(() => []);
    for (const [id, st] of Object.entries(p.words)) { const w = DB.byId[id]; if (w) cols[st.room || 0].push(w); }
    body.append(title('記得越牢的字，住得越深！'),
      h('div', { class: 'depth' }, ...names.map((n, i) => h('section', { class: 'depth-row d' + i }, h('b', {}, n), h('div', { class: 'depth-words' }, ...cols[i].map((w) => h('span', { class: 'chip' }, w.emoji || '', ' ', w.word)))))));
  } else {
    body.append(title('收集冊：探險過的字都在這裡'), h('div', { class: 'cards-grid small' }, ...DB.words.map((w) => {
      const st = S.wordState(w.id);
      return h('div', { class: 'sticker-slot' + (st ? '' : ' empty') }, st ? wordPicture(w, 40) : h('span', { class: 'q' }, '?'), h('small', {}, st ? w.word : ''));
    })));
  }
}

// ---------- 我的地洞：用腳印章佈置 ----------
const ITEMS = [
  { id: 'rug', name: '小地毯', emoji: '🟫', cost: 5 }, { id: 'lamp', name: '小燈', emoji: '🪔', cost: 8 }, { id: 'plant', name: '仙人掌', emoji: '🌵', cost: 8 },
  { id: 'bed', name: '軟軟的床', emoji: '🛏️', cost: 15 }, { id: 'books', name: '書架', emoji: '📚', cost: 15 }, { id: 'beetle', name: '甲蟲點心', emoji: '🪲', cost: 6 },
  { id: 'flower', name: '沙漠花', emoji: '🌼', cost: 10 }, { id: 'radio', name: '收音機', emoji: '📻', cost: 20 }, { id: 'telescope', name: '望遠鏡', emoji: '🔭', cost: 25 },
  { id: 'baby', name: '狐獴寶寶', emoji: '🐣', cost: 30 }, { id: 'star', name: '星星燈', emoji: '🌟', cost: 30 }, { id: 'trophy', name: '探險獎盃', emoji: '🏆', cost: 40 },
];
export function burrowScreen() {
  const p = S.me(); if (!p) return go('profiles');
  let holding = null;
  const room = h('div', { class: 'burrow-room' });
  const shop = h('div', { class: 'shop' });
  const draw = () => {
    room.replaceChildren(...Array.from({ length: 12 }, (_, i) => {
      const it = ITEMS.find((x) => x.id === p.placed[i]);
      return h('button', { class: 'slot-cell' + (it ? ' has' : ''), 'aria-label': it ? it.name : '空位', onClick: () => { if (holding) { S.place(holding, i); holding = null; sfx('stamp'); } else if (it) { S.place(it.id, null); } draw(); } }, it ? it.emoji : '');
    }), h('div', { class: 'room-mascot' }, mascot(120)));
    shop.replaceChildren(...ITEMS.map((it) => {
      const owned = p.items.includes(it.id);
      return h('button', { class: 'shop-item' + (owned ? ' owned' : '') + (holding === it.id ? ' holding' : ''), onClick: () => {
        if (!owned) { if (S.buy(it)) { sfx('win'); toast(`買到${it.name}了！點地洞裡的位置放上去`); holding = it.id; } else { sfx('bad'); toast(`還差 ${it.cost - S.balance()} 個腳印章`); } }
        else holding = holding === it.id ? null : it.id;
        draw(); document.querySelector('.stamp-count').replaceWith(stampCount());
      } }, h('span', { class: 'big-emoji' }, it.emoji), h('b', {}, it.name), owned ? h('small', {}, holding === it.id ? '點地洞放上去' : '已擁有') : h('small', {}, paw('#E2483D', 14), ' ', it.cost));
    }));
  };
  app().replaceChildren(h('div', { class: 'screen burrow' }, topBar(() => go('home'), h('b', {}, '我的地洞'), stampCount()), dune(),
    h('main', { class: 'burrow-main' }, h('section', {}, title('用腳印章佈置你的地洞！'), room), h('aside', {}, h('h2', {}, '沙漠小舖'), shop))));
  draw();
}

// ---------- 家長專區 ----------
export function parentScreen(unlocked) {
  if (!unlocked) {
    const a = 3 + Math.floor(Math.random() * 6); const b = 4 + Math.floor(Math.random() * 5);
    const inp = h('input', { inputmode: 'numeric', 'aria-label': '答案' });
    app().replaceChildren(h('div', { class: 'screen' }, topBar(() => go('home')), h('main', { class: 'center' }, h('h1', {}, '家長專區'), h('p', {}, `請家長回答：${a} × ${b} = ?`), inp,
      h('button', { class: 'btn primary', onClick: () => (+inp.value === a * b ? parentScreen(true) : toast('答案不對')) }, '進入'))));
    return;
  }
  const p = S.me(); const st = S.settings();
  const toggle = (k, label) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!st[k], onChange: (e) => { S.setSetting(k, e.target.checked); setAudioSettings(S.settings()); } }), label);
  const weak = p ? Object.entries(p.words).filter(([, s]) => s.best < 3).map(([id, s]) => [DB.byId[id], s]).filter(([w]) => w) : [];
  const stepNames = { 1: '聽音', 3: '例外字', 4: '字尾', 5: '母音', 6: '子音', 7: '切開', 8: '類型' };
  const missRows = p ? Object.entries(p.stepMiss).sort((a, b) => b[1] - a[1]) : [];

  const f = { word: h('input', { placeholder: 'rabbit' }), stage: h('select', {}, ...PLACES.slice(1).map((pl) => h('option', { value: pl.no }, pl.no + ' ' + pl.name))), emoji: h('input', { placeholder: '🐰' }), zh: h('input', { placeholder: '兔子' }),
    syllables: h('input', { placeholder: 'rab/bit' }), sounds: h('input', { placeholder: 'r-a-b/b-i-t' }), ipa: h('input', { placeholder: '/ˈræb.ɪt/' }), types: h('input', { placeholder: 'C/C' }), stress: h('input', { placeholder: '1', inputmode: 'numeric' }),
    tricky: h('input', {}), suffix: h('input', { placeholder: 'swim+ing|雙寫' }) };
  const fill = (w) => { if (!w) return; Object.assign(f.word, { value: w.word }); f.stage.value = w.stage; f.emoji.value = w.emoji; f.zh.value = w.zh; f.syllables.value = w.sylText.join('/'); f.ipa.value = w.ipa; f.types.value = w.types.join('/'); f.stress.value = w.stress; f.tricky.value = w.tricky; f.suffix.value = w.suffix;
    f.sounds.value = w.syls.map((s) => s.map((b) => (b.silentBefore ? `[${b.silentBefore}]` : '') + b.g + (b.ph !== DEFAULT_PH[b.g] ? '=' + b.ph : '') + (b.magic ? '(e)' : '') + (b.silentAfter ? `[${b.silentAfter}]` : '')).join('-')).join('/'); };
  const pickWord = h('select', { onChange: (e) => fill(DB.words.find((w) => w.id === e.target.value)) }, h('option', { value: '' }, '（新增一個字，或選一個字來修改）'), ...DB.words.map((w) => h('option', { value: w.id }, `${w.stage}｜${w.word}`)));
  const submit = () => {
    const data = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
    if (!data.word) return toast('請填英文單字');
    const body = `pc-action: word\n\n\`\`\`json\n${JSON.stringify(data, null, 1)}\n\`\`\`\n\n送出後，自動流程會把這個字寫進 data/words.csv（同一個字會覆蓋舊的）。`;
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent('單字：' + data.word)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  app().replaceChildren(h('div', { class: 'screen parent' }, topBar(() => go('home'), h('b', {}, '家長專區')),
    h('main', { class: 'parent-main' },
      h('section', { class: 'panel' }, h('h2', {}, '設定'), toggle('sfx', '音效'), toggle('meaning', '顯示中文意思（字義提示）'),
        h('label', { class: 'switch' }, '語速 ', h('select', { onChange: (e) => { S.setSetting('rate', +e.target.value); setAudioSettings(S.settings()); } }, ...[[0.8, '慢'], [1, '一般'], [1.15, '快']].map(([v, n]) => h('option', { value: v, selected: st.rate === v }, n))))),
      h('section', { class: 'panel' }, h('h2', {}, (p ? p.name : '') + ' 的學習狀況'),
        h('p', {}, `探險過 ${p ? Object.keys(p.words).length : 0} / ${DB.words.length} 個字，腳印章 ${S.stampsTotal()} 個。`),
        h('h3', {}, '最常卡住的步驟'), missRows.length ? h('table', {}, h('tr', {}, h('th', {}, '步驟'), h('th', {}, '錯誤次數')), ...missRows.map(([k, n]) => h('tr', {}, h('td', {}, stepNames[k] || k), h('td', {}, n)))) : h('p', { class: 'muted' }, '還沒有紀錄'),
        h('h3', {}, '還沒拿滿 3 個章的字'), weak.length ? h('div', { class: 'chips' }, ...weak.map(([w, s]) => h('span', { class: 'chip' }, w.word, ' ', s.best, '★'))) : h('p', { class: 'muted' }, '沒有，太棒了！')),
      h('section', { class: 'panel' }, h('h2', {}, '新增或修改單字（送到 GitHub）'),
        h('p', { class: 'muted' }, '填好後按送出，會開啟 GitHub 的申請單頁面，按 Submit 即可；約 1～3 分鐘後網站更新。欄位寫法見 data/README.md。'),
        pickWord, h('div', { class: 'form-grid' }, ...Object.entries({ word: '英文單字', stage: '地點', emoji: '圖示 emoji', zh: '中文意思', syllables: '音節', sounds: '音格', ipa: '英式音標', types: '音節類型', stress: '重音在第幾節', tricky: '調皮字母', suffix: '字尾' }).map(([k, n]) => h('label', {}, n, f[k]))),
        h('button', { class: 'btn primary', onClick: submit }, '送出到 GitHub')),
      h('section', { class: 'panel' }, h('h2', {}, '換圖片、換音檔'), h('p', {}, '把同檔名的檔案上傳到 GitHub 對應的資料夾就會自動替換，例如 images/words/rabbit.png、audio/words/rabbit.mp3、audio/rules/L6-13.mp3（口訣語音）。'),
        h('a', { class: 'btn', href: `https://github.com/${REPO}/tree/main/data`, target: '_blank' }, '打開 GitHub 資料夾')),
      h('section', { class: 'panel' }, h('h2', {}, '探險隊員'), ...S.profiles().map((x) => h('div', { class: 'row' }, h('span', { class: 'avatar sm', style: { background: x.color } }, x.name.slice(0, 1)), x.name,
        h('button', { class: 'btn small', onClick: () => { if (confirm(`確定要刪除 ${x.name} 的進度嗎？`)) { S.removeProfile(x.id); parentScreen(true); } } }, '刪除')))))));
}

// ---------- 路由 ----------
export function go(path) { if (location.hash === '#' + path) route(); else location.hash = path; }
export function route() {
  stop();
  const [name, a, b] = location.hash.replace(/^#/, '').split('/');
  if (!S.me() && name !== 'parent') return profilesScreen();
  switch (name) {
    case 'profiles': return profilesScreen();
    case 'place': return placeScreen(a, b);
    case 'book': return bookScreen(a);
    case 'burrow': return burrowScreen();
    case 'parent': return parentScreen(false);
    default: return homeScreen();
  }
}
