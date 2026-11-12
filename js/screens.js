// 各個畫面
import { DB, PLACES, NODES, DEFAULT_PH, wordsOf, rule } from './data.js';
import { soundItem } from './audio.js';
import { vowelIndex, spellOf, cardFor } from './vowels.js';
import { play, stop, wordItem, syllableItem, sentenceItem, storyItem, say, sfx, setAudioSettings, hasAsset } from './audio.js';
import { autogen } from './autogen.js';
import { applyZhuyin } from './zhuyin.js';
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
const TABS = [['words', '單字'], ['spell', '我來拼'], ['vowel', '母音挑戰'], ['sent', '讀句子'], ['story', '小故事'], ['pairs', '聽聽看']];
const vowelTabName = (no) => (no <= 2 ? '聽音選母音' : '這個音怎麼拼');
export function placeScreen(no, tab = 'words') {
  no = +no; const pl = PLACES[no]; const p = S.me(); if (!p || !pl) return go('home');
  const ws = wordsOf(no); const pr = placeProgress(no);
  const body = h('div', { class: 'tab-body' });
  const tabs = h('nav', { class: 'tabs' }, ...TABS.map(([k, n]) => h('a', { class: 'tab' + (k === tab ? ' on' : ''), href: `#place/${no}/${k}` }, k === 'vowel' ? vowelTabName(no) : n)));
  app().replaceChildren(h('div', { class: 'screen place', style: { '--bg': pl.bg, '--fg': pl.fg, '--tx': pl.tx } },
    topBar(() => go('home'), h('div', { class: 'place-title' }, h('b', {}, pl.name), h('small', {}, pl.topic + `｜探險過 ${pr.done} / ${pr.total} 個字`)), stampCount()),
    dune(), tabs, body));
  ({ words: tabWords, spell: tabSpell, vowel: tabVowel, sent: tabSentences, story: tabStory, pairs: tabPairs }[tab] || tabWords)(body, no, ws);
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
    h('button', { class: 'btn', onClick: () => play(sentenceItem(s.id)) }, '聽整句'),
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
        h('button', { class: 'btn', onClick: () => play(storyItem(pg.stage, pg.page)) }, '聽這一頁'),
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

// ---------- 母音挑戰：第 1、2 站聽音選母音；第 3 站起這個音怎麼拼 ----------
const SHORT_V = { a: 'æ', e: 'e', i: 'ɪ', o: 'ɒ', u: 'ʌ' };
function vowelQuestions(no) {
  const idx = vowelIndex();
  const qs = [];
  const add = (ws, mode) => {
    for (const w of ws) {
      const boxes = w.syls.flat();
      if (mode === 'short') {
        const vs = boxes.filter((b) => b.vowel);
        if (w.syls.length === 1 && vs.length === 1 && SHORT_V[vs[0].g] === vs[0].ph && !boxes.some((b) => b.magic)) qs.push({ w, b: vs[0], mode, options: ['a', 'e', 'i', 'o', 'u'] });
      } else {
        for (const b of boxes) {
          if (!b.vowel || !b.ph) continue;
          const sp = spellOf(b); const c = cardFor(b.ph, sp); if (!c) continue;
          const alts = idx[c.id].spellings.filter((x) => x !== sp && (idx[c.id].words[x] || []).length);
          if (alts.length) { qs.push({ w, b, mode, card: c, options: [sp, ...shuffle(alts).slice(0, 2)] }); break; }
        }
      }
    }
  };
  const mode = no <= 2 ? 'short' : 'spell';
  add(wordsOf(no), mode);
  for (let st = no - 1; st >= 1 && qs.length < 8; st--) add(wordsOf(st), mode);
  return shuffle(qs).slice(0, 5);
}
// 字的骨架：要問的那一格挖空（魔法 e 也一起挖空）
function skeleton(w, target, fill) {
  const out = [];
  for (const syl of w.syls) for (const b of syl) {
    const magicHere = target.magicVowel && b.magic && syl.includes(target);
    const sb = b.silentBefore || ''; const sa = b.silentAfter || '';
    if (b === target) out.push(h('span', { class: 'gap-slot' + (fill ? ' filled' : '') }, fill ? fill.split('_')[0] : '\u00a0'));
    else out.push(h('span', {}, sb + b.g + sa));
    if (b.magic) out.push(magicHere ? h('span', { class: 'gap-slot' + (fill ? ' filled' : '') }, fill ? 'e' : '\u00a0') : h('span', {}, 'e'));
  }
  return h('div', { class: 'skeleton' }, ...out);
}
function tabVowel(body, no) {
  const qs = vowelQuestions(no);
  const area = h('div', { class: 'vowel-game' });
  body.append(title(no <= 2 ? '聽一聽，中間是哪一個母音？' : '聽一聽，這個音要怎麼拼？'), area);
  if (!qs.length) { area.append(h('p', { class: 'hint' }, '這一站還沒有適合的字，先去探險其他站吧！')); return; }
  let i = 0; let right = 0;
  const next = () => {
    if (i >= qs.length) {
      const got = S.vowelReward(no, right);
      area.replaceChildren(h('div', { class: 'vg-end' }, h('h2', {}, `答對 ${right} / ${qs.length} 題！`),
        got ? h('p', {}, `拿到 ${got} 個腳印章！`, stamps(got, got, 26)) : h('p', { class: 'muted' }, right ? '今天這一站的腳印章已經拿過了，明天再來！' : '再玩一次試試看！'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: () => tabVowelRestart() }, '再玩一次'), h('a', { class: 'btn', href: '#book/valley' }, '去母音沙谷'))));
      if (right) { sfx('win'); confetti(); }
      return;
    }
    const q = qs[i]; let first = true;
    const say1 = () => play(wordItem(q.w));
    const opts = shuffle(q.options.slice());
    area.replaceChildren(
      h('div', { class: 'vg-progress' }, `第 ${i + 1} / ${qs.length} 題`),
      // 沒有圖片或 emoji 的字不顯示文字卡（不然就看到答案了）
      h('div', { class: 'listen-row' }, h('div', { class: 'pic-card' }, q.w.emoji || hasAsset('images/words/' + q.w.word + '.png') ? wordPicture(q.w, 80) : mascot(80)), h('button', { class: 'big-round', onClick: say1 }, '再聽一次')),
      skeleton(q.w, q.b),
      h('div', { class: 'choices four' }, ...opts.map((o) => h('button', { class: 'choice vg-opt', onClick: (e) => {
        const btn = e.currentTarget;
        if (o !== (q.mode === 'short' ? q.b.g : spellOf(q.b))) { first = false; sfx('bad'); btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 400); say1(); return; }
        if (first) right++;
        sfx('ok'); area.querySelector('.skeleton').replaceWith(skeleton(q.w, q.b, o));
        area.querySelector('.choices').replaceWith(h('div', { class: 'vg-after' },
          q.card ? h('p', {}, '這個音也可以拼成：', vowelIndex()[q.card.id].spellings.filter((x) => x !== o).join('、')) : null,
          h('div', { class: 'row' }, q.card ? h('a', { class: 'btn small', href: '#book/valley/' + q.card.id }, '去母音沙谷') : null,
            h('button', { class: 'btn primary', onClick: () => { i++; next(); } }, i + 1 < qs.length ? '下一題 →' : '看結果'))));
        play(wordItem(q.w));
      } }, o))));
    say1();
  };
  const tabVowelRestart = () => { body.replaceChildren(); tabVowel(body, no); };
  next();
}

// ---------- 探險手冊：地道網、深淺房間、收集 ----------
// ---------- 母音沙谷 ----------
const MOUTH_SVG = {
  smile: '<path d="M5 12 Q24 30 43 12 Q24 20 5 12Z" fill="#B5302A"/><path d="M10 14 Q24 19 38 14" stroke="#fff" stroke-width="3" fill="none"/>',
  open: '<ellipse cx="24" cy="16" rx="12" ry="13" fill="#6B2420" stroke="#E2836B" stroke-width="4"/><path d="M15 9 h18" stroke="#fff" stroke-width="3"/>',
  round: '<circle cx="24" cy="16" r="9" fill="#6B2420" stroke="#E2836B" stroke-width="6"/>',
  relaxed: '<ellipse cx="24" cy="16" rx="11" ry="5" fill="#6B2420" stroke="#E2836B" stroke-width="4"/>',
};
const MOUTH_NAME = { smile: '笑笑嘴', open: '張大嘴', round: '圓圓嘴', relaxed: '放鬆嘴' };
// 嘴型圖：家長上傳的 images/mouth/<音標>.png 優先，沒有就用簡單圖示
function mouthIcon(c, size = 40) {
  const ipa = c.ipa.split(' ')[0];
  for (const ext of ['png', 'jpg', 'webp', 'svg']) if (hasAsset(`images/mouth/${ipa}.${ext}`)) return h('img', { class: 'mouth-img', src: `images/mouth/${ipa}.${ext}`, alt: MOUTH_NAME[c.mouth] || '', width: size, height: size });
  return h('span', { class: 'mouth-ico', title: MOUTH_NAME[c.mouth] || '', html: `<svg viewBox="0 0 48 32" width="${size}" height="${Math.round(size * 0.67)}">${MOUTH_SVG[c.mouth] || MOUTH_SVG.relaxed}</svg>` });
}
function valleyTab(body, openId) {
  const idx = vowelIndex();
  const done = (w) => !!S.wordState(w.id);
  const litCount = (e) => e.spellings.filter((sp) => (e.words[sp] || []).some(done)).length;
  const detail = h('div', { class: 'vv-detail' });
  const card = (c, style) => {
    const e = idx[c.id]; const n = litCount(e);
    return h('button', { class: 'vv-card' + (n ? ' lit' : '') + ' m-' + c.mouth, style, 'data-id': c.id, onClick: () => open(c.id) },
      h('span', { class: 'vv-label' }, c.label), h('small', {}, c.name_zh), h('span', { class: 'vv-count' }, `${n}/${e.spellings.length}`));
  };
  function open(id) {
    const e = idx[id]; if (!e) return; const c = e.card;
    body.querySelectorAll('.vv-card').forEach((x) => x.classList.toggle('on', x.dataset.id === id));
    play(soundItem(c.ipa.split(' ')[0]));
    detail.replaceChildren(h('div', { class: 'vv-head' }, mouthIcon(c, 56),
      h('button', { class: 'vv-big', onClick: () => play(soundItem(c.ipa.split(' ')[0])) }, '🔊 ', c.label),
      h('div', {}, h('b', {}, c.name_zh, '（', MOUTH_NAME[c.mouth], '）'), h('p', { class: 'vv-mn', onClick: () => say(c.mnemonic) }, c.mnemonic), c.note ? h('p', { class: 'vv-note' }, '💡 ', c.note) : null)),
      h('div', { class: 'vv-spells' }, ...e.spellings.map((sp) => {
        const ws = e.words[sp] || []; const learned = ws.filter(done);
        const cls = !ws.length ? ' none' : learned.length ? ' lit' : '';
        return h('div', { class: 'vv-spell' + cls },
          h('span', { class: 'vv-sp' }, sp),
          !ws.length ? h('small', {}, '還沒有字') : learned.length
            ? h('div', { class: 'vv-words' }, ...learned.slice(0, 4).map((w) => h('button', { class: 'vv-word', onClick: () => play(wordItem(w)) }, wordPicture(w, 24), w.word)))
            : h('small', {}, '還沒探險'));
      })));
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const valley = DB.vowels.filter((c) => c.group === 'valley').sort((a, b) => a.order - b.order);
  const n = valley.length; const mid = (n - 1) / 2;
  const top = DB.vowels.find((c) => c.group === 'top');
  body.append(title('母音沙谷：點一張卡，聽聽這個音有哪些拼法！'),
    h('div', { class: 'vv-mouths' }, ...['smile', 'open', 'round'].map((m) => h('span', {}, mouthIcon({ ipa: '', mouth: m }, 44), MOUTH_NAME[m]))),
    h('div', { class: 'vv-valley' },
      top ? card(top, { left: '50%', top: '0px', transform: 'translateX(-50%)' }) : null,
      ...valley.map((c, i) => card(c, { left: `calc(${(i / (n - 1)) * 100}% - ${(i / (n - 1)) * 76}px)`, top: `${20 + (1 - Math.abs(i - mid) / mid) * 210}px` }))),
    h('div', { class: 'vv-groups' },
      h('section', {}, h('h3', {}, '雙母音（嘴巴會滑）'), h('div', { class: 'vv-row' }, ...DB.vowels.filter((c) => c.group === 'diph').map((c) => card(c)))),
      h('section', {}, h('h3', {}, 'r 控制母音（英式 r 不出聲）'), h('div', { class: 'vv-row' }, ...DB.vowels.filter((c) => c.group === 'r').map((c) => card(c))))),
    detail,
    h('p', { class: 'hint' }, '亮起來的拼法是你探險過的字；虛線的拼法字庫裡還沒有字。'));
  if (openId) open(openId);
}

export function bookScreen(tab = 'net', sub) {
  const p = S.me(); if (!p) return go('profiles');
  const body = h('div', { class: 'tab-body' });
  app().replaceChildren(h('div', { class: 'screen book' }, topBar(() => go('home'), h('b', {}, '探險手冊'), stampCount()), dune(),
    h('nav', { class: 'tabs' }, ...[['net', '地道網'], ['valley', '母音沙谷'], ['rooms', '深淺房間'], ['stickers', '收集冊']].map(([k, n]) => h('a', { class: 'tab' + (k === tab ? ' on' : ''), href: '#book/' + k }, n))), body));
  if (tab === 'valley') return valleyTab(body, sub);
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

// ---------- 我的地洞：用腳印章佈置（自由拖曳） ----------
const SHOP_CATS = [['furniture', '家具'], ['plant', '植物'], ['friend', '沙漠朋友'], ['food', '好吃的'], ['gear', '探險裝備'], ['sparkle', '閃亮亮']];
const ITEMS = [
  // 家具
  { id: 'rug', cat: 'furniture', name: '小地毯', emoji: '🟫', cost: 5 }, { id: 'chair', cat: 'furniture', name: '小椅子', emoji: '🪑', cost: 8 }, { id: 'lamp', cat: 'furniture', name: '小燈', emoji: '🪔', cost: 8 },
  { id: 'teddy', cat: 'furniture', name: '泰迪熊', emoji: '🧸', cost: 12 }, { id: 'bed', cat: 'furniture', name: '軟軟的床', emoji: '🛏️', cost: 15 }, { id: 'books', cat: 'furniture', name: '書架', emoji: '📚', cost: 15 },
  { id: 'window', cat: 'furniture', name: '小窗戶', emoji: '🪟', cost: 15 }, { id: 'clock', cat: 'furniture', name: '時鐘', emoji: '🕰️', cost: 18 }, { id: 'radio', cat: 'furniture', name: '收音機', emoji: '📻', cost: 20 },
  { id: 'sofa', cat: 'furniture', name: '沙發', emoji: '🛋️', cost: 20 },
  // 植物
  { id: 'grass', cat: 'plant', name: '小草', emoji: '🌱', cost: 5 }, { id: 'mushroom', cat: 'plant', name: '蘑菇', emoji: '🍄', cost: 6 }, { id: 'plant', cat: 'plant', name: '仙人掌', emoji: '🌵', cost: 8 },
  { id: 'flower', cat: 'plant', name: '沙漠花', emoji: '🌼', cost: 10 }, { id: 'sunflower', cat: 'plant', name: '向日葵', emoji: '🌻', cost: 12 }, { id: 'palm', cat: 'plant', name: '棕櫚樹', emoji: '🌴', cost: 18 },
  // 沙漠朋友
  { id: 'snail', cat: 'friend', name: '蝸牛', emoji: '🐌', cost: 6 }, { id: 'butterfly', cat: 'friend', name: '蝴蝶', emoji: '🦋', cost: 8 }, { id: 'scorpion', cat: 'friend', name: '蠍子', emoji: '🦂', cost: 10 },
  { id: 'lizard', cat: 'friend', name: '蜥蜴', emoji: '🦎', cost: 10 }, { id: 'baby', cat: 'friend', name: '狐獴寶寶', emoji: '🐣', cost: 30 }, { id: 'camel', cat: 'friend', name: '駱駝', emoji: '🐪', cost: 35 },
  // 好吃的
  { id: 'cookie', cat: 'food', name: '餅乾', emoji: '🍪', cost: 5 }, { id: 'beetle', cat: 'food', name: '甲蟲點心', emoji: '🪲', cost: 6 }, { id: 'melon', cat: 'food', name: '西瓜', emoji: '🍉', cost: 6 },
  { id: 'honey', cat: 'food', name: '蜂蜜', emoji: '🍯', cost: 8 }, { id: 'cake', cat: 'food', name: '蛋糕', emoji: '🎂', cost: 20 },
  // 探險裝備
  { id: 'map', cat: 'gear', name: '地圖', emoji: '🗺️', cost: 10 }, { id: 'torch', cat: 'gear', name: '手電筒', emoji: '🔦', cost: 10 }, { id: 'compass', cat: 'gear', name: '指南針', emoji: '🧭', cost: 12 },
  { id: 'backpack', cat: 'gear', name: '背包', emoji: '🎒', cost: 15 }, { id: 'telescope', cat: 'gear', name: '望遠鏡', emoji: '🔭', cost: 25 }, { id: 'tent', cat: 'gear', name: '帳篷', emoji: '⛺', cost: 40 },
  // 閃亮亮
  { id: 'balloon', cat: 'sparkle', name: '氣球', emoji: '🎈', cost: 8 }, { id: 'star', cat: 'sparkle', name: '星星燈', emoji: '🌟', cost: 30 }, { id: 'trophy', cat: 'sparkle', name: '探險獎盃', emoji: '🏆', cost: 40 },
  { id: 'gem', cat: 'sparkle', name: '寶石', emoji: '💎', cost: 45 }, { id: 'rainbow', cat: 'sparkle', name: '彩虹', emoji: '🌈', cost: 50 }, { id: 'fireworks', cat: 'sparkle', name: '煙火', emoji: '🎆', cost: 60 },
];
const SIZES = [0.7, 1, 1.45];
let shopCat = 'furniture';
export function burrowScreen() {
  const p = S.me(); if (!p) return go('profiles');
  let selected = null; // 被點選的擺飾 uid
  const room = h('div', { class: 'burrow-room' });
  const trash = h('div', { class: 'trash', 'aria-label': '垃圾桶' }, '🗑️');
  const tools = h('div', { class: 'decor-tools', hidden: true });
  const shop = h('div', { class: 'shop' });
  const catTabs = h('div', { class: 'shop-cats' });
  const itemOf = (id) => ITEMS.find((x) => x.id === id);
  const posIn = (el, cx, cy) => { const r = el.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100, inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom }; };
  const clamp = (v) => Math.max(3, Math.min(97, v));
  const overTrash = (cx, cy) => { const r = trash.getBoundingClientRect(); return cx >= r.left - 10 && cx <= r.right + 10 && cy >= r.top - 10 && cy <= r.bottom + 10; };

  function decorEl(d) {
    const it = itemOf(d.id); if (!it) return null;
    const el = h('div', { class: 'decor' + (selected === d.uid ? ' sel' : ''), role: 'button', 'aria-label': it.name,
      style: { left: d.x + '%', top: d.y + '%', zIndex: d.z || 1, '--sz': SIZES[d.s ?? 1], '--fx': d.f ? -1 : 1 } }, it.emoji);
    // 拖曳：手指或滑鼠都可以；移動很少就當作「點一下」
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY }; let moved = false;
      const move = (ev) => {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
        if (!moved) return;
        const q = posIn(room, ev.clientX, ev.clientY);
        el.style.left = clamp(q.x) + '%'; el.style.top = clamp(q.y) + '%';
        trash.classList.toggle('hot', overTrash(ev.clientX, ev.clientY)); tools.hidden = true;
      };
      const up = (ev) => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        trash.classList.remove('hot');
        if (!moved) { selected = selected === d.uid ? null : d.uid; draw(); return; }
        if (overTrash(ev.clientX, ev.clientY)) { S.removeDecor(d.uid); selected = null; sfx('tap'); draw(); return; }
        const q = posIn(room, ev.clientX, ev.clientY);
        S.updateDecor(d.uid, { x: clamp(q.x), y: clamp(q.y) }); S.bringFront(d.uid); selected = d.uid; draw();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    return el;
  }
  function drawTools() {
    const d = S.decor().find((x) => x.uid === selected);
    if (!d) { tools.hidden = true; return; }
    const it = itemOf(d.id);
    tools.hidden = false;
    tools.style.left = Math.min(Math.max(d.x, 18), 82) + '%';
    tools.style.top = (d.y > 40 ? d.y - 14 : d.y + 14) + '%';
    const btn = (label, aria, fn, dis) => h('button', { class: 'tool-btn', 'aria-label': aria, disabled: !!dis, onClick: (e) => { e.stopPropagation(); fn(); sfx('tap'); draw(); } }, label);
    tools.replaceChildren(h('b', {}, it ? it.name : ''),
      btn('－', '縮小', () => S.updateDecor(d.uid, { s: Math.max(0, (d.s ?? 1) - 1) }), (d.s ?? 1) <= 0),
      btn('＋', '放大', () => S.updateDecor(d.uid, { s: Math.min(2, (d.s ?? 1) + 1) }), (d.s ?? 1) >= 2),
      btn('↔', '左右翻轉', () => S.updateDecor(d.uid, { f: !d.f })),
      btn('⬆', '移到最前面', () => S.bringFront(d.uid)),
      btn('🗑️', '刪除', () => { S.removeDecor(d.uid); selected = null; }),
      btn('✓', '完成', () => { selected = null; }));
  }
  // 從小舖拖進地洞（已擁有的物件）；只點一下就放在地洞中間
  function dragFromShop(it, e) {
    const ghost = h('div', { class: 'decor ghost', style: { '--sz': 1, '--fx': 1 } }, it.emoji);
    const start = { x: e.clientX, y: e.clientY }; let moved = false;
    const place = (cx, cy) => { ghost.style.left = cx + 'px'; ghost.style.top = cy + 'px'; };
    const target = e.currentTarget; target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) { moved = true; document.body.append(ghost); }
      if (moved) place(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up);
      ghost.remove();
      if (!moved) { const d = S.addDecor(it.id, 50, 55); selected = d.uid; sfx('stamp'); draw(); return; }
      const q = posIn(room, ev.clientX, ev.clientY);
      if (q.inside) { const d = S.addDecor(it.id, clamp(q.x), clamp(q.y)); selected = d.uid; sfx('stamp'); draw(); }
    };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
  }
  function draw() {
    const list = S.decor().slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    room.replaceChildren(h('div', { class: 'room-mascot' }, mascot(110)), ...list.map(decorEl).filter(Boolean), trash, tools);
    drawTools();
    catTabs.replaceChildren(...SHOP_CATS.map(([k, n]) => h('button', { class: 'shop-cat' + (k === shopCat ? ' on' : ''), onClick: () => { shopCat = k; draw(); } }, n)));
    shop.replaceChildren(...ITEMS.filter((it) => it.cat === shopCat).sort((a, b) => a.cost - b.cost).map((it) => {
      const owned = p.items.includes(it.id);
      const el = h('button', { class: 'shop-item' + (owned ? ' owned' : ''), 'aria-label': it.name },
        h('span', { class: 'big-emoji' }, it.emoji), h('b', {}, it.name), owned ? h('small', {}, '拖進地洞') : h('small', {}, paw('#E2483D', 14), ' ', it.cost));
      if (owned) el.addEventListener('pointerdown', (e) => { e.preventDefault(); dragFromShop(it, e); });
      else el.addEventListener('click', () => {
        if (S.buy(it)) { sfx('win'); toast(`買到${it.name}了！把它拖進地洞吧`); } else { sfx('bad'); toast(`還差 ${it.cost - S.balance()} 個腳印章`); }
        draw(); document.querySelector('.stamp-count').replaceWith(stampCount());
      });
      return el;
    }));
  }
  room.addEventListener('pointerdown', (e) => { if (e.target === room && selected) { selected = null; draw(); } });
  app().replaceChildren(h('div', { class: 'screen burrow' }, topBar(() => go('home'), h('b', {}, '我的地洞'), stampCount()), dune(),
    h('main', { class: 'burrow-main' },
      h('section', {}, title('用腳印章佈置你的地洞！'), room, h('p', { class: 'hint' }, '把買到的東西拖進地洞；點一下可以放大、縮小、翻面、移到最前面；拖到垃圾桶就收起來。')),
      h('aside', {}, h('h2', {}, '沙漠小舖'), catTabs, shop))));
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

  // ---------- 新增或修改單字：家長只輸入英文單字，其他欄位自動產生，確認後送到 GitHub ----------
  const LABELS = { stage: '地點', emoji: '圖示 emoji', zh: '中文意思', syllables: '音節', sounds: '音格', ipa: '英式音標', types: '音節類型', stress: '重音在第幾節', tricky: '調皮字母', suffix: '字首字尾' };
  const f = { word: h('input', { placeholder: '輸入一個英文單字，例如 rabbit', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', onKeydown: (e) => { if (e.key === 'Enter') generate(false); } }),
    stage: h('select', {}, ...PLACES.slice(1).map((pl) => h('option', { value: pl.no }, pl.no + ' ' + pl.name))), emoji: h('input', { placeholder: '空白＝文字卡' }), zh: h('input', { placeholder: '兔子' }),
    syllables: h('input', { placeholder: 'rab/bit' }), sounds: h('input', { placeholder: 'r-a-b/b-i-t' }), ipa: h('input', { placeholder: '/ˈræb.ɪt/' }), types: h('input', { placeholder: 'C/C' }), stress: h('input', { placeholder: '1', inputmode: 'numeric' }),
    tricky: h('input', {}), suffix: h('input', { placeholder: 'swim+ing|雙寫' }) };
  const why = Object.fromEntries(Object.keys(LABELS).map((k) => [k, h('small', { class: 'why', hidden: true })]));
  const fieldRow = (k) => h('label', { class: 'field', 'data-k': k }, LABELS[k], f[k], why[k]);
  const rows = Object.fromEntries(Object.keys(LABELS).map((k) => [k, fieldRow(k)]));
  const status = h('p', { class: 'gen-status', hidden: true });
  const regenBtn = h('button', { class: 'btn small', hidden: true, onClick: () => generate(true) }, '重新自動產生');
  const form = h('div', { class: 'gen-form', hidden: true },
    h('div', { class: 'form-grid' }, ...Object.keys(LABELS).map((k) => rows[k])),
    h('p', { class: 'muted' }, '黃色欄位是工具沒把握的地方，請看下方說明再確認。送出後會自動依音標產生英式語音（約 3～5 分鐘）；語音產生好之前，這個字不會出現在孩子的練習裡。產生後請到「發音檢查」聽一次。'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: () => submit() }, '送出到 GitHub')));
  // 欄位一改就取消黃色提示（家長已確認）
  Object.keys(LABELS).forEach((k) => f[k].addEventListener('input', () => mark(k, '')));
  f.stage.addEventListener('change', () => mark('stage', ''));
  function mark(k, msg, info) {
    rows[k].classList.toggle('warn', !!msg);
    why[k].hidden = !(msg || info); why[k].textContent = msg || info || '';
  }
  const soundsOf = (w) => w.syls.map((s) => s.map((b) => (b.silentBefore ? `[${b.silentBefore}]` : '') + b.g + (b.ph !== DEFAULT_PH[b.g] ? '=' + b.ph : '') + (b.magic ? '(e)' : '') + (b.silentAfter ? `[${b.silentAfter}]` : '')).join('-')).join('/');
  const fill = (w) => {
    f.word.value = w.word; f.stage.value = w.stage; f.emoji.value = w.emoji; f.zh.value = w.zh; f.syllables.value = w.sylText.join('/'); f.ipa.value = w.ipa;
    f.types.value = w.types.join('/'); f.stress.value = w.stress; f.tricky.value = w.tricky; f.suffix.value = w.suffix; f.sounds.value = soundsOf(w);
    Object.keys(LABELS).forEach((k) => mark(k, ''));
  };
  const showStatus = (t) => { status.hidden = !t; status.textContent = t || ''; };
  let busy = false;
  async function generate(force) {
    const word = f.word.value.trim().toLowerCase();
    if (!/^[a-z]+$/.test(word)) return toast('請輸入一個英文單字（只用字母）');
    const old = DB.allWords.find((w) => w.word === word);
    regenBtn.hidden = !old;
    if (old && !force) {
      fill(old); form.hidden = false;
      const pl = PLACES.find((x) => x && +x.no === +old.stage);
      showStatus(`這個字已經在第 ${old.stage} 站（${pl ? pl.name : ''}），下面是目前的內容，可以直接修改後送出；想讓工具重新判斷，請按「重新自動產生」。`);
      return;
    }
    if (busy) return; busy = true;
    showStatus('正在查字典、分析自然發音規則…'); form.hidden = true;
    try {
      const g = await autogen(word);
      Object.entries(g.fields).forEach(([k, v]) => { f[k].value = v; });
      Object.keys(LABELS).forEach((k) => mark(k, g.warn[k], g.note[k]));
      form.hidden = false;
      const n = Object.keys(g.warn).length;
      showStatus((old ? `這個字已經在第 ${old.stage} 站，以下是重新自動產生的內容（送出會覆蓋舊的）。` : '已自動產生。') + (n ? `有 ${n} 個欄位請特別確認（黃色）。` : '請確認後送出。'));
    } catch (e) { showStatus('自動產生失敗：' + (e.message || e)); }
    finally { busy = false; }
  }
  const submit = () => {
    const data = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
    if (!data.word) return toast('請填英文單字');
    const body = `pc-action: word\n\n\`\`\`json\n${JSON.stringify(data, null, 1)}\n\`\`\`\n\n送出後，自動流程會把這個字寫進 data/words.csv（同一個字會覆蓋舊的），再自動產生英式語音。`;
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent('單字：' + data.word)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  app().replaceChildren(h('div', { class: 'screen parent' }, topBar(() => go('home'), h('b', {}, '家長專區')),
    h('main', { class: 'parent-main' },
      h('section', { class: 'panel' }, h('h2', {}, '設定'), toggle('sfx', '音效'), toggle('meaning', '顯示中文意思（字義提示）'),
        h('label', { class: 'switch' }, '語速 ', h('select', { onChange: (e) => { S.setSetting('rate', +e.target.value); setAudioSettings(S.settings()); } }, ...[[0.8, '慢'], [1, '一般'], [1.15, '快']].map(([v, n]) => h('option', { value: v, selected: st.rate === v }, n))))),
      h('section', { class: 'panel' }, h('h2', {}, (p ? p.name : '') + ' 的學習狀況'),
        h('p', {}, `探險過 ${p ? Object.keys(p.words).length : 0} / ${DB.words.length} 個字，腳印章 ${S.stampsTotal()} 個。`),
        h('h3', {}, '最常卡住的步驟'), missRows.length ? h('table', {}, h('tr', {}, h('th', {}, '步驟'), h('th', {}, '錯誤次數')), ...missRows.map(([k, n]) => h('tr', {}, h('td', {}, stepNames[k] || k), h('td', {}, n)))) : h('p', { class: 'muted' }, '還沒有紀錄'),
        h('h3', {}, '還沒拿滿 3 個章的字'), weak.length ? h('div', { class: 'chips' }, ...weak.map(([w, s]) => h('span', { class: 'chip' }, w.word, ' ', s.best, '★'))) : h('p', { class: 'muted' }, '沒有，太棒了！'),
        h('h3', {}, '進度對照：網站 8 站 ↔ MB Phonics Scope & Sequence'), scopeTable(p)),
      h('section', { class: 'panel' }, h('h2', {}, '新增或修改單字（送到 GitHub）'),
        h('p', { class: 'muted' }, '只要輸入一個英文單字，按「自動產生」，工具會查字典並依自然發音規則填好其他欄位；確認後按送出，會開啟 GitHub 的申請單頁面，按 Submit 即可，約 1～3 分鐘後網站更新。欄位寫法見 data/README.md。'),
        h('div', { class: 'row gen-row' }, f.word, h('button', { class: 'btn primary', onClick: () => generate(false) }, '自動產生'), regenBtn),
        status, form),
      zhuyinCheckPanel(),
      pronCheckPanel((word) => { f.word.value = word; generate(false); f.word.scrollIntoView({ behavior: 'smooth', block: 'center' }); }),
      h('section', { class: 'panel' }, h('h2', {}, '換圖片、換音檔'), h('p', {}, '把同檔名的檔案上傳到 GitHub 對應的資料夾就會自動替換，例如 images/words/rabbit.png、audio/words/rabbit.mp3、audio/rules/L6-13.mp3（口訣語音）。'),
        h('a', { class: 'btn', href: `https://github.com/${REPO}/tree/main/data`, target: '_blank' }, '打開 GitHub 資料夾')),
      h('section', { class: 'panel' }, h('h2', {}, '探險隊員'), ...S.profiles().map((x) => h('div', { class: 'row' }, h('span', { class: 'avatar sm', style: { background: x.color } }, x.name.slice(0, 1)), x.name,
        h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: x.zhuyin !== false, onChange: (e) => { x.zhuyin = e.target.checked; S.persist(); } }), '顯示注音'),
        h('button', { class: 'btn small', onClick: () => { if (confirm(`確定要刪除 ${x.name} 的進度嗎？`)) { S.removeProfile(x.id); parentScreen(true); } } }, '刪除')))))));
}

// 網站 8 站對應 Scope & Sequence（Becca Rose, 2025）的階段
const SCOPE = {
  1: ['1. Letter Sounds 字母音', '2. CVC Words 短母音 CVC'],
  2: ['3. Digraphs 雙字母', '5. Welded Sounds 黏合音'],
  3: ['7. Vowel Teams 母音組合', '8. R-Controlled Vowels r 控制母音'],
  4: ['4. Consonant Blends 子音群', '10. Three-consonant Blends 三子音'],
  5: ['6. Long Vowels（Magic E）', '11／15. Soft C／Soft G 軟 c、g'],
  6: ['13. Compound Words 複合字', '14. Closed／Open Syllables 閉／開音節', '18. Syllable Division 切音節'],
  7: ['12. Inflectional Endings 詞尾變化', '17. Complex Inflectional Endings 複雜詞尾', '19. Affixes 字首字尾'],
  8: ['16. Complex Patterns（dge tch igh ind old ost tion ture）', '弱讀與例外字（網站額外）'],
};
function scopeTable(p) {
  return h('table', { class: 'scope' }, h('tr', {}, h('th', {}, '網站地點'), h('th', {}, 'Scope & Sequence 階段'), h('th', {}, '探險過')),
    ...PLACES.slice(1).map((pl) => {
      const all = DB.allWords.filter((w) => w.stage === pl.no);
      const done = p ? all.filter((w) => p.words[w.id]).length : 0;
      return h('tr', {}, h('td', {}, pl.no + ' ' + pl.name), h('td', {}, ...(SCOPE[pl.no] || []).map((x) => h('div', {}, x))),
        h('td', {}, h('div', { class: 'scope-bar' }, h('span', { style: { width: (all.length ? (done / all.length) * 100 : 0) + '%' } })), `${done} / ${all.length}`));
    }));
}

// ---------- 發音檢查：逐字聽單字與音節，確認 Google 有照音標念 ----------
// 進度存在這台裝置；語音重新產生（音標改了）後自動回到「待檢查」
const CHECK_KEY = 'pc-pron-check-v1';
function pronCheckPanel(onEdit) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch (e) { saved = {}; }
  const save = () => { try { localStorage.setItem(CHECK_KEY, JSON.stringify(saved)); } catch (e) { /* 忽略 */ } };
  let gen = null; let filter = 'todo';
  const list = h('div', { class: 'pron-list' }, h('p', { class: 'muted' }, '讀取中…'));
  const summary = h('p', {});
  const files = (w) => ['audio/words/' + w.word + '.mp3', ...(w.sylText.length > 1 ? w.sylText.map((_, i) => 'audio/syllables/' + w.word + '-' + i + '.mp3') : [])];
  const fp = (w) => files(w).map((f) => (gen && gen[f]) || (hasAsset(f) ? 'file' : '')).join('|');
  const state = (w) => {
    if (!files(w).every(hasAsset)) return 'none';
    const s = saved[w.word];
    return s && s.fp === fp(w) ? (s.ok ? 'ok' : 'bad') : 'todo';
  };
  const mark = (w, ok) => { saved[w.word] = { fp: fp(w), ok }; save(); draw(); };
  const LABEL = { todo: '待檢查', ok: '✓ 正確', bad: '✗ 有問題', none: '語音還沒產生' };
  function row(w) {
    const st = state(w);
    const syl = w.sylText.length > 1 ? w.sylText.map((t, i) => h('button', { class: 'btn small', disabled: st === 'none', onClick: () => play(syllableItem(w, i)) }, '🔊 ' + t)) : [];
    return h('div', { class: 'pron-row ' + st },
      h('button', { class: 'btn small', disabled: st === 'none', onClick: () => play(wordItem(w)) }, '🔊 ' + w.word),
      ...syl,
      h('span', { class: 'pron-ipa' }, w.ipa),
      w.aligned ? null : h('span', { class: 'pron-warn', title: '音格的讀音和音標對不上，孩子點格子聽到的音可能跟整字不同' }, '⚠ 音格對不上音標'),
      h('span', { class: 'pron-state' }, LABEL[st]),
      st === 'none' ? null : h('button', { class: 'btn small', onClick: () => mark(w, true) }, '✓'),
      st === 'none' ? null : h('button', { class: 'btn small', onClick: () => mark(w, false) }, '✗'),
      h('button', { class: 'btn small', onClick: () => onEdit(w.word) }, '修改'));
  }
  function draw() {
    const all = DB.allWords;
    const count = (k) => all.filter((w) => state(w) === k).length;
    summary.textContent = `共 ${all.length} 字：待檢查 ${count('todo')}、正確 ${count('ok')}、有問題 ${count('bad')}、語音還沒產生 ${count('none')}`;
    const ws = all.filter((w) => filter === 'all' || state(w) === filter);
    list.replaceChildren(...(ws.length ? ws.map(row) : [h('p', { class: 'muted' }, '沒有符合的字')]));
  }
  const tabs = h('div', { class: 'row' }, ...[['todo', '待檢查'], ['bad', '有問題'], ['none', '語音還沒產生'], ['ok', '正確'], ['all', '全部']].map(([k, n]) =>
    h('button', { class: 'btn small' + (k === filter ? ' primary' : ''), onClick: (e) => { filter = k; tabs.querySelectorAll('.btn').forEach((b) => b.classList.remove('primary')); e.currentTarget.classList.add('primary'); draw(); } }, n)));
  const missing = DB.sounds.filter((x) => !hasAsset('audio/sounds/' + x.sound_id + '.mp3'));
  fetch('audio/generated.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((g) => { gen = g; draw(); });
  return h('section', { class: 'panel' }, h('h2', {}, '發音檢查'),
    h('p', { class: 'muted' }, '每個字聽一次整字和每個音節，確認念法跟音標一樣再按 ✓；不對就按 ✗，再按「修改」改音標後送出，語音會重新產生並回到「待檢查」。語音還沒產生的字不會出現在孩子的練習裡。檢查進度只存在這台裝置。'),
    missing.length ? h('p', { class: 'gen-status' }, '還沒有錄音的單音（格子會顯示灰色）：' + missing.map((x) => `${x.ipa}（上傳 audio/sounds/${x.sound_id}.mp3）`).join('、')) : null,
    summary, tabs, list);
}

// ---------- 破音字確認：自動判斷不了的破音字，由家長選讀音 ----------
const ZY_SENT = 'pc-zhuyin-sent-v1';
function zhuyinCheckPanel() {
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(ZY_SENT)) || {}; } catch (e) { sent = {}; }
  const list = h('div', { class: 'pron-list' }, h('p', { class: 'muted' }, '讀取中…'));
  const info = h('p', {});
  let rows = [];
  const send = () => {
    const pick = rows.filter((r) => r.ok.checked).slice(0, 25);
    if (!pick.length) return toast('請先勾選「確認」');
    const items = pick.map((r) => ({ char: r.it.char, pattern: r.it.pattern, reading: r.sel.value }));
    const body = `pc-action: zhuyin\n\n\`\`\`json\n${JSON.stringify({ items })}\n\`\`\`\n\n送出後，自動流程會把讀音寫進 data/zhuyin-fix.csv。`;
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent('破音字讀音 ' + items.length + ' 個')}&body=${encodeURIComponent(body)}`, '_blank');
    pick.forEach((r) => { sent[r.it.char + '|' + r.it.pattern] = r.sel.value; });
    try { localStorage.setItem(ZY_SENT, JSON.stringify(sent)); } catch (e) { /* 忽略 */ }
    draw(all);
  };
  let all = [];
  function draw(items) {
    const todo = items.filter((it) => !sent[it.char + '|' + it.pattern]);
    info.textContent = todo.length ? `還有 ${todo.length} 處要確認（已送出、還沒更新的不列出）。` : '全部確認完了！';
    rows = todo.map((it) => {
      const sel = h('select', {}, ...it.readings.map((r) => h('option', { value: r }, r)));
      const ok = h('input', { type: 'checkbox' });
      sel.addEventListener('change', () => { ok.checked = true; });
      const ctx = h('span', { class: 'zy-ctx' }, it.context.slice(0, it.at), h('mark', {}, it.char), it.context.slice(it.at + 1));
      return { it, sel, ok, el: h('div', { class: 'pron-row' }, ctx, sel, h('label', { class: 'switch' }, ok, '確認')) };
    });
    list.replaceChildren(...(rows.length ? rows.map((r) => r.el) : [h('p', { class: 'muted' }, '沒有要確認的破音字')]));
  }
  fetch('data/zhuyin-check.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((d) => { all = d; draw(d); });
  return h('section', { class: 'panel' }, h('h2', {}, '破音字確認'),
    h('p', { class: 'muted' }, '注音會依常見詞語自動判斷破音字的讀音。下面是判斷不了的地方（黃色是那個字），預設選第一個讀音；選好正確讀音並勾「確認」，再按送出。一次最多送 25 個，網站約 1～3 分鐘後更新。'),
    info, list, h('button', { class: 'btn primary', onClick: send }, '送出已確認的讀音'));
}

// ---------- 路由 ----------
export function go(path) { if (location.hash === '#' + path) route(); else location.hash = path; }
export function route() {
  stop();
  const [name, a, b] = location.hash.replace(/^#/, '').split('/');
  applyZhuyin(S.me() ? S.me().zhuyin : true);
  if (!S.me() && name !== 'parent') return profilesScreen();
  switch (name) {
    case 'profiles': return profilesScreen();
    case 'place': return placeScreen(a, b);
    case 'book': return bookScreen(a, b);
    case 'burrow': return burrowScreen();
    case 'parent': return parentScreen(false);
    default: return homeScreen();
  }
}
