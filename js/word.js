// 一個字的九步驟探險
import { DB, TYPES, rule, ruleForBox } from './data.js';
import { play, stop, soundItem, wordItem, syllableItem, say, sfx, recordToggle, playRecording } from './audio.js';
import { h, title, bubble, helpButton, toast, confetti, stamps, wordPicture, shuffle, mascot } from './ui.js';
import * as S from './store.js';

const STEPS = [
  { n: 1, name: '聽音', title: '仔細聽，這個字有幾節？', applies: () => true },
  { n: 2, name: '看字', title: '看看這個字！', applies: () => true },
  { n: 3, name: '例外字', title: '這個字有調皮字母嗎？', applies: () => true },
  { n: 4, name: '字尾', title: '卸下背包：加字尾發生什麼事？', applies: (w) => !!w.suf },
  { n: 5, name: '母音', title: '點出所有母音！', applies: () => true },
  { n: 6, name: '子音', title: '點出兩個母音中間的子音！', applies: (w) => w.syls.length > 1 },
  { n: 7, name: '切開', title: '在地道中間挖一道牆！', applies: (w) => w.syls.length > 1 },
  { n: 8, name: '類型', title: '每一間房是哪一種門？', applies: () => true },
  { n: 9, name: '拼讀', title: '手指滑過房間，把音連起來！', applies: () => true },
];

// 字母方塊（不發音的字母淡灰色，magic e 用弧線連到母音）
function tileRow(w, opts = {}) {
  const row = h('div', { class: 'tiles' + (opts.gaps ? ' with-gaps' : '') });
  const tiles = [];
  w.syls.forEach((syl, si) => {
    syl.forEach((b, bi) => {
      const t = h('button', { class: 'tile' + (b.vowel ? ' is-v' : ' is-c'), 'data-si': si, 'data-bi': bi },
        b.silentBefore ? h('span', { class: 'silent' }, b.silentBefore) : null,
        h('span', { class: 'g' }, b.g),
        b.silentAfter ? h('span', { class: 'silent' }, b.silentAfter) : null);
      t.box = b; t.si = si; t.bi = bi; tiles.push(t); row.append(t);
      if (b.magic) { const e = h('button', { class: 'tile magic-e', 'data-si': si }, h('span', { class: 'silent' }, 'e')); e.box = { g: 'e', magic: true, vowel: true, isMagicE: true }; e.si = si; tiles.push(e); row.append(e); }
      if (opts.gaps) {
        const last = bi === syl.length - 1;
        if (!(last && si === w.syls.length - 1)) {
          const gap = h('button', { class: 'gap', 'aria-label': '在這裡挖牆' }); gap.after = { si, bi, boundary: last };
          row.append(gap);
        }
      }
    });
  });
  row.tiles = tiles;
  return row;
}

function trickyMark(w, row) {
  if (!w.tricky) return;
  const word = w.word; const idx = w.tricky === w.word ? 0 : word.indexOf(w.tricky);
  let pos = 0;
  for (const t of row.tiles) {
    const len = (t.box.silentBefore || '').length + t.box.g.length + (t.box.silentAfter || '').length;
    const isMagic = t.box.isMagicE;
    const start = pos; pos += isMagic ? 1 : len;
    if (idx >= 0 && start < idx + w.tricky.length && pos > idx) t.classList.add('heart');
  }
}

export function playWord(root, w, { quick = false, onDone, onExit }) {
  let steps = STEPS.filter((s) => s.applies(w));
  if (quick) steps = steps.filter((s) => [1, 7, 9].includes(s.n));
  const misses = {};
  let idx = 0;
  const firstTime = !(S.me() && S.me().seenGuide);
  const miss = (n) => { misses[n] = (misses[n] || 0) + 1; sfx('bad'); };

  const bar = h('ol', { class: 'paws-bar', 'aria-label': '步驟' });
  const main = h('main', { class: 'step-main' });
  const shell = h('div', { class: 'screen word-screen' },
    h('header', { class: 'top' }, h('button', { class: 'icon-btn', 'aria-label': '離開', onClick: () => { stop(); onExit && onExit(); } }, '×'), bar),
    main);
  root.replaceChildren(shell);

  function drawBar() {
    bar.replaceChildren(...steps.map((s, i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' }, h('span', { class: 'dot' }, String(i + 1)), h('span', { class: 'lbl' }, s.name))));
  }

  function next() {
    idx++;
    if (idx >= steps.length) return finish();
    show();
  }

  function frame(step, helpRules, ...content) {
    const nextBtn = h('button', { class: 'btn primary next', hidden: true, onClick: next }, idx === steps.length - 1 ? '完成！' : '下一步');
    main.replaceChildren(title(step.title, helpButton(helpRules)), ...content, h('div', { class: 'actions' }, nextBtn));
    if (firstTime) say(step.title);
    return { ready: () => { nextBtn.hidden = false; sfx('ok'); nextBtn.focus(); } };
  }

  function show() {
    drawBar();
    const step = steps[idx];
    S.setResume({ wordId: w.id, quick, step: idx });
    ({ 1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9 })[step.n](step);
  }

  // 1 聽音：放石頭
  function s1(step) {
    const n = w.syls.length;
    const tray = h('div', { class: 'tray' }); const track = h('div', { class: 'track' });
    const say1 = () => play(wordItem(w));
    const pebble = () => { const p = h('button', { class: 'pebble', 'aria-label': '小石頭' }); p.onclick = () => { sfx('tap'); (p.parentNode === tray ? track : tray).append(p); }; return p; };
    for (let i = 0; i < n + 1; i++) tray.append(pebble());
    const f = frame(step, () => [rule('step:segment')],
      h('div', { class: 'listen-row' }, h('div', { class: 'pic-card' }, wordPicture(w, 92)), h('button', { class: 'big-round', onClick: say1 }, '再聽一次')),
      h('section', { class: 'hole-box' }, h('div', { class: 'hint' }, '聽到幾節，就放幾顆小石頭到洞口！'), track, h('div', { class: 'tray-row' }, h('span', {}, '我的小石頭'), tray)),
      h('button', { class: 'btn ok', onClick: check }, '放好了！'));
    say1();
    function check() {
      const k = track.children.length;
      if (k !== n) { miss(1); toast(k < n ? '好像少了一節，拍拍手再聽一次！' : '好像多了一節，再聽一次！'); say1(); return; }
      [...track.children].forEach((p, i) => p.classList.add('ok'));
      play(w.sylText.map((_, i) => syllableItem(w, i, { onstart: () => track.children[i].classList.add('pop') })));
      f.ready();
    }
  }

  // 2 看字
  function s2(step) {
    const showZh = S.settings().meaning;
    const f = frame(step, () => [rule('step:blend')],
      h('div', { class: 'see-word' }, wordPicture(w, 110), h('button', { class: 'word-big', onClick: () => play(wordItem(w)) }, w.word),
        showZh ? h('div', { class: 'zh' }, w.zh) : null, h('div', { class: 'ipa' }, w.ipa)));
    play(wordItem(w)); f.ready();
  }

  // 3 例外字
  function s3(step) {
    const has = !!w.tricky;
    const row = tileRow(w);
    const f = frame(step, () => [rule('tricky')], row,
      h('div', { class: 'choices' },
        h('button', { class: 'choice', onClick: () => pick(true) }, '有調皮字母 ❤'),
        h('button', { class: 'choice', onClick: () => pick(false) }, '沒有，照規則讀')));
    let done = false;
    function pick(v) {
      if (done) return;
      if (v !== has) { miss(3); toast(has ? '仔細看，有一個字母不照規則喔！' : '這個字很乖，都照規則！'); }
      done = true; trickyMark(w, row);
      if (has) bubble('畫愛心的字母要特別記住，其他照規則拼！', 70);
      main.querySelector('.choices').replaceChildren(h('div', { class: 'result' }, has ? '有調皮字母，畫上愛心了！' : '沒有調皮字母！'));
      f.ready();
    }
  }

  // 4 字尾
  function s4(step) {
    const s = w.suf;
    const soundQ = s.rule.startsWith('/');
    const KEY = { 雙寫: 'suf:雙寫', 去e: 'suf:去e', y變i: 'suf:y變i', f變ves: 'suf:f變ves', 不規則: 'suf:不規則', '/s/': 'suf:/s/', '/z/': 'suf:/s/', '/ɪz/': 'suf:/s/', '/t/': 'suf:/t/', '/d/': 'suf:/t/', '/ɪd/': 'suf:/t/' };
    const LABEL = { 雙寫: '子音雙寫', 去e: '去掉 e', y變i: 'y 變 i', f變ves: 'f 變 ves', 不規則: '整個變身', 直接加: '直接加上去' };
    const ruleKey = KEY[s.rule] || (s.add === 'ing' ? 'suf:ing' : s.root === 'un' ? 'suf:un' : 'suf:es');
    const pool = soundQ ? (['/t/', '/d/', '/ɪd/'].includes(s.rule) ? ['/t/', '/d/', '/ɪd/'] : ['/s/', '/z/', '/ɪz/']) : ['直接加', '雙寫', '去e', 'y變i', '不規則', 'f變ves'];
    const correct = soundQ ? s.rule : (s.rule in LABEL ? s.rule : '直接加');
    const opts = shuffle([correct, shuffle(pool.filter((x) => x !== correct))[0]]);
    const f = frame(step, () => [rule(ruleKey)],
      h('div', { class: 'suffix-eq' }, h('span', { class: 'chip root' }, s.root), h('span', {}, s.irregular ? '→' : '+'), h('span', { class: 'chip add' }, s.add || '?'), h('span', {}, '='), h('button', { class: 'chip word', onClick: () => play(wordItem(w)) }, w.word)),
      h('p', { class: 'q' }, soundQ ? '這個背包怎麼唸？' : '背上背包時，字發生了什麼事？'),
      h('div', { class: 'choices' }, ...opts.map((o) => h('button', { class: 'choice', onClick: (e) => pick(o, e.currentTarget) }, soundQ ? o : LABEL[o]))));
    let done = false;
    function pick(o, btn) {
      if (done) return;
      if (o !== correct) { miss(4); btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 400); return; }
      done = true; btn.classList.add('right'); f.ready();
    }
  }

  // 5 圈母音
  function s5(step) {
    const row = tileRow(w);
    const targets = row.tiles.filter((t) => t.box.vowel);
    const rules = () => {
      const out = [];
      w.syls.forEach((syl) => syl.forEach((b) => { if (b.vowel) out.push(syl.some((x) => x.magic) && b.g.length === 1 ? rule('g:' + b.g + '-e') : ruleForBox(b)); }));
      return [...new Set(out.filter(Boolean))];
    };
    const f = frame(step, rules, row, h('p', { class: 'hint' }, 'a e i o u 和它們的好朋友（ai、ee、ar…）都是母音。'));
    let left = targets.length;
    row.tiles.forEach((t) => t.onclick = () => {
      if (t.classList.contains('marked')) return;
      if (!t.box.vowel) { miss(5); t.classList.add('shake'); setTimeout(() => t.classList.remove('shake'), 400); return; }
      t.classList.add('marked', 'mark-v'); sfx('tap');
      if (t.box.ph) play(soundItem(t.box.ph));
      if (--left === 0) { row.classList.add('show-v'); f.ready(); }
    });
  }

  // 6 標子音
  function s6(step) {
    const row = tileRow(w);
    row.tiles.forEach((t) => { if (t.box.vowel) t.classList.add('marked', 'mark-v'); });
    const targets = new Set();
    for (let si = 0; si < w.syls.length - 1; si++) {
      const a = row.tiles.filter((t) => t.si === si); const b = row.tiles.filter((t) => t.si === si + 1);
      for (let k = a.length - 1; k >= 0 && !a[k].box.vowel; k--) targets.add(a[k]);
      for (let k = 0; k < b.length && !b[k].box.vowel; k++) targets.add(b[k]);
    }
    const f = frame(step, () => [rule('div:digraph'), rule('div:count')], row, h('p', { class: 'hint' }, '抱在一起的好朋友（sh、ck…）算一個子音。'));
    let left = targets.size;
    if (!left) { f.ready(); return; }
    row.tiles.forEach((t) => t.onclick = () => {
      if (t.classList.contains('marked')) return;
      if (!targets.has(t)) { miss(6); t.classList.add('shake'); setTimeout(() => t.classList.remove('shake'), 400); return; }
      t.classList.add('marked', 'mark-c'); sfx('tap');
      if (--left === 0) f.ready();
    });
  }

  // 7 切音節（先開門再關門）
  function s7(step) {
    const row = tileRow(w, { gaps: true });
    row.tiles.forEach((t) => { if (t.box.vowel) t.classList.add('mark-v'); });
    const keys = w.division || [];
    const f = frame(step, () => keys.map(rule), h('div', { class: 'tunnel' }, row), h('div', { class: 'pattern', hidden: true }));
    const gaps = [...row.querySelectorAll('.gap')];
    let left = gaps.filter((g) => g.after.boundary).length; let cut = 0;
    gaps.forEach((g) => g.onclick = () => {
      if (g.classList.contains('cut')) return;
      if (!g.after.boundary) {
        miss(7); g.classList.add('nope'); setTimeout(() => g.classList.remove('nope'), 500);
        const k = keys[0];
        if (k === 'div:VCV-closed') toast('門打開讀讀看，是你認識的字嗎？不是的話，把門關上，往後挖一格！', 3000);
        else if (k === 'div:VCV-open') toast('一個子音的時候，先把門打開試試看！', 2600);
        else if (k === 'div:digraph' || /sh|ch|th|ck|ng/.test(w.word)) toast('抱在一起的好朋友不能分開喔！', 2400);
        else toast(rule(k) ? rule(k).mnemonic : '再試試看！', 2600);
        return;
      }
      g.classList.add('cut'); sfx('stamp'); cut++;
      if (--left === 0) {
        row.classList.add('split');
        const r = rule(keys[0]);
        const p = main.querySelector('.pattern'); p.hidden = false;
        p.replaceChildren(h('strong', {}, r ? r.title : ''), ' ', r ? r.mnemonic : '');
        play(w.sylText.map((_, i) => syllableItem(w, i)));
        f.ready();
      }
    });
  }

  // 8 判斷類型
  function s8(step) {
    const doors = h('div', { class: 'rooms' });
    const f = frame(step, () => [...new Set(w.types)].map((t) => rule(TYPES[t].rule)), doors);
    let si = 0;
    const draw = () => {
      doors.replaceChildren(...w.syls.map((syl, i) => h('div', { class: 'room' + (i === si ? ' focus' : '') + (i < si ? ' solved' : ''), style: i < si ? { borderColor: TYPES[w.types[i]].color } : null },
        h('div', { class: 'room-letters' }, w.sylText[i]),
        i < si ? h('div', { class: 'room-type', style: { background: TYPES[w.types[i]].color } }, TYPES[w.types[i]].name) : null)));
      if (si >= w.syls.length) { f.ready(); return; }
      const correct = w.types[si];
      const other = shuffle(['C', 'O', 'E', 'T', 'R', 'D'].filter((x) => x !== correct))[0];
      doors.append(h('div', { class: 'choices' }, ...shuffle([correct, other]).map((t) => h('button', { class: 'choice door-' + t, onClick: (e) => {
        if (t !== correct) { miss(8); e.currentTarget.classList.add('shake'); toast(rule(TYPES[correct].rule) ? '提示：' + rule(TYPES[correct].rule).mnemonic : '再看看！', 2400); return; }
        sfx('ok'); play(syllableItem(w, si)); si++; draw();
      } }, h('span', { class: 'door-ico' }), TYPES[t].name))));
    };
    draw();
  }

  // 9 拼讀（音格＋重音石頭）
  function s9(step) {
    const rooms = h('div', { class: 'elkonin' });
    let order = []; let pos = 0;
    w.syls.forEach((syl, si) => {
      const seats = h('div', { class: 'seats' });
      syl.forEach((b) => {
        const parts = [];
        if (b.silentBefore) parts.push(h('span', { class: 'silent' }, b.silentBefore));
        parts.push(h('span', { class: 'g' }, b.g));
        if (b.silentAfter) parts.push(h('span', { class: 'silent' }, b.silentAfter));
        const seat = h('button', { class: 'seat' + (b.vowel ? ' v' : '') }, h('span', { class: 'letters' }, ...parts), h('span', { class: 'ph' }, '/' + b.ph + '/'));
        seat.box = b; seat.si = si; order.push(seat); seats.append(seat);
        if (b.magic) seats.append(h('span', { class: 'magic-tag', title: 'magic e：不佔格' }, 'e'));
      });
      rooms.append(h('div', { class: 'room-col' },
        h('div', { class: 'type-pill', style: { background: TYPES[w.types[si]].color } }, TYPES[w.types[si]].name),
        seats,
        h('span', { class: 'stone' + (si + 1 === w.stress ? ' big' : ''), 'aria-label': si + 1 === w.stress ? '重音' : '輕音' }),
        h('button', { class: 'syl-btn', onClick: () => play(syllableItem(w, si)) }, w.sylText[si])));
    });
    const tools = h('div', { class: 'tools', hidden: true },
      h('button', { class: 'btn', onClick: () => play([wordItem(w, { rate: 0.7, ttsRate: 0.55 }), { pause: 300 }, wordItem(w)]) }, '慢慢再聽'),
      navigator.mediaDevices && window.MediaRecorder ? h('button', { class: 'btn', onClick: async (e) => { try { const s = await recordToggle(); e.currentTarget.textContent = s === 'recording' ? '停止錄音' : '錄音跟讀'; } catch (er) { toast('沒辦法使用麥克風'); } } }, '錄音跟讀') : null,
      navigator.mediaDevices && window.MediaRecorder ? h('button', { class: 'btn', onClick: () => playRecording() }, '聽我的錄音') : null);
    const f = frame(step, () => [rule('step:blend'), rule('step:stress'), rule('step:final')], rooms,
      h('button', { class: 'word-big small', onClick: () => play(wordItem(w)) }, w.word), tools);
    const lightUpTo = (k) => {
      while (pos <= k && pos < order.length) {
        const seat = order[pos]; seat.classList.add('lit'); play(soundItem(seat.box.ph)); pos++;
        const sylDone = pos === order.length || order[pos].si !== seat.si;
        if (sylDone) setTimeout(() => play(syllableItem(w, seat.si)), 650);
        if (pos === order.length) setTimeout(async () => { await play([wordItem(w, { rate: 0.75, ttsRate: 0.6 }), { pause: 250 }, wordItem(w)]); tools.hidden = false; f.ready(); }, 1400);
      }
    };
    order.forEach((seat, k) => { seat.onclick = () => { if (k === pos) lightUpTo(k); else if (k > pos) toast('從第一格開始，一格一格滑！'); else play(soundItem(seat.box.ph)); }; });
    // 手指滑過去
    rooms.addEventListener('pointermove', (e) => {
      if (!(e.buttons || e.pointerType === 'touch')) return;
      const t = document.elementFromPoint(e.clientX, e.clientY); const seat = t && t.closest && t.closest('.seat');
      if (seat) { const k = order.indexOf(seat); if (k === pos) lightUpTo(k); }
    });
  }

  function finish() {
    stop();
    const m = Object.values(misses).reduce((a, b) => a + b, 0);
    const got = m === 0 ? 3 : m <= 2 ? 2 : 1;
    S.finishWord(w, got, misses); S.setResume(null);
    if (firstTime) S.guideSeen();
    sfx('win'); confetti();
    const praise = Object.keys(misses).length === 0 ? `每一步都一次答對！${w.word} 你完全會了！` : misses[7] ? `你把 ${w.word} 分成 ${w.sylText.join(' | ')} 了！` : `你把 ${w.word} 一格一格讀出來了！`;
    main.replaceChildren(h('div', { class: 'reward' },
      mascot(130), h('h2', {}, '好厲害！'), stamps(got, 3, 54),
      h('p', { class: 'praise', onClick: () => say(praise) }, praise),
      h('div', { class: 'sticker' }, wordPicture(w, 70), h('div', {}, w.word), h('small', {}, '探險手冊新收集！')),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: () => onDone && onDone(got) }, '繼續'), h('button', { class: 'btn', onClick: () => playWord(root, w, { quick, onDone, onExit }) }, '再玩一次'))));
    say(praise);
  }

  show();
}

// 我來拼：聽到字，把字母卡放進音格
export function spellWord(root, w, { onDone, onExit }) {
  const boxes = w.boxes;
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const pool = shuffle([...boxes.map((b) => b.g), ...shuffle(letters.split('').filter((c) => !w.word.includes(c))).slice(0, 2)]);
  let k = 0; let errors = 0;
  const slots = boxes.map((b) => h('div', { class: 'slot' + (b.vowel ? ' v' : '') }));
  const cards = pool.map((g) => h('button', { class: 'tile', onClick: (e) => {
    const b = boxes[k];
    if (g !== b.g) { errors++; sfx('bad'); e.currentTarget.classList.add('shake'); setTimeout(() => e.currentTarget.classList.remove('shake'), 400); play(soundItem(b.ph)); return; }
    slots[k].textContent = (b.silentBefore || '') + g + (b.silentAfter || '') + (b.magic ? 'e' : ''); slots[k].classList.add('filled');
    e.currentTarget.disabled = true; play(soundItem(b.ph)); k++;
    if (k === boxes.length) { sfx('win'); confetti(); setTimeout(() => { play(wordItem(w)); done(); }, 500); }
  } }, g));
  const done = () => { const got = errors === 0 ? 3 : errors <= 2 ? 2 : 1; S.finishWord(w, got, {}); actions.replaceChildren(stamps(got, 3, 40), h('button', { class: 'btn primary', onClick: onDone }, '繼續')); };
  const actions = h('div', { class: 'actions' });
  root.replaceChildren(h('div', { class: 'screen word-screen' },
    h('header', { class: 'top' }, h('button', { class: 'icon-btn', 'aria-label': '離開', onClick: onExit }, '×'), h('strong', {}, '我來拼')),
    h('main', { class: 'step-main' }, title('聽一聽，把字母放進格子裡！'),
      h('div', { class: 'listen-row' }, h('div', { class: 'pic-card' }, wordPicture(w, 80)), h('button', { class: 'big-round', onClick: () => play(wordItem(w)) }, '聽一聽')),
      h('div', { class: 'slots' }, ...slots), h('div', { class: 'cards' }, ...cards),
      h('p', { class: 'hint' }, '一格放一個音；sh、ee 這種好朋友放在同一格。'), actions)));
  play(wordItem(w));
}
