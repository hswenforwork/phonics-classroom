// 字梯：每一階只換一個音（cat → cap → map → mop …）
// 第一階挖空母音，孩子選字卡填進去；之後每一階聽新字，選出正確字卡並拖到「變了的那一格」
import { DB } from './data.js';
import { play, stop, wordItem, hasAsset, say, sfx } from './audio.js';
import { h, toast, confetti, mascot, stamps, shuffle } from './ui.js';

// 聲音相近、容易混淆的拼法（錯誤字卡從這裡挑；同音的拼法如 c／k／ck 不會互當錯誤選項）
const NEAR = {
  p: ['b', 't'], b: ['p', 'd'], t: ['d', 'p'], d: ['t', 'b'], c: ['g', 't'], k: ['g', 't'], g: ['c', 'd'], m: ['n', 'b'], n: ['m', 'ng'],
  f: ['v', 'th'], v: ['f', 'b'], s: ['z', 'sh'], z: ['s', 'j'], h: ['f', 'w'], l: ['r', 'n'], r: ['l', 'w'], w: ['r', 'v'], j: ['ch', 'g'], y: ['j', 'w'], x: ['s', 'z'],
  sh: ['s', 'ch'], ch: ['sh', 'j'], th: ['f', 's'], ck: ['g', 't'], tch: ['sh', 'j'], ng: ['n', 'm'],
  a: ['e', 'u'], e: ['a', 'i'], i: ['e', 'a'], o: ['u', 'a'], u: ['o', 'a'],
  ai: ['ee', 'oa'], ay: ['ee', 'oa'], ee: ['ai', 'i'], ea: ['ai', 'i'], oa: ['ai', 'oo'], ow: ['oo', 'ai'], oo: ['oa', 'u'], ar: ['or', 'er'], or: ['ar', 'ur'], er: ['ar', 'or'], ir: ['ar', 'or'], ur: ['or', 'ar'],
};
const VOWEL = /[aeiou]/;
const wordOf = (units) => units.join('');
export const ladderReady = (l) => l.steps.every((u) => hasAsset('audio/words/' + wordOf(u) + '.mp3'));

// 這一站可以玩的字梯：第 1～5 站用自己的，第 6～8 站混合前面幾站
export function laddersFor(no) {
  const ready = DB.ladders.filter(ladderReady);
  const own = ready.filter((l) => l.stage === no);
  return own.length ? own : ready.filter((l) => l.stage < Math.min(no, 6));
}

function options(correct, extraAvoid) {
  const near = (NEAR[correct] || []).filter((x) => x !== correct && x !== extraAvoid);
  const pool = near.length >= 2 ? near : [...near, ...shuffle(['b', 'd', 'p', 't', 'm', 'n', 's', 'a', 'e', 'i', 'o', 'u'].filter((x) => x !== correct && !near.includes(x)))];
  return shuffle([correct, ...pool.slice(0, 2)]);
}

/**
 * 玩一條字梯
 * opts.maxSteps：最多幾階；opts.onDone(firstTryCount, steps)：爬完
 */
export function playLadder(root, ladder, opts = {}) {
  const steps = ladder.steps.slice(0, opts.maxSteps || ladder.steps.length);
  let k = 0; let firstTry = 0;
  let cur = steps[0].slice();
  const rungs = h('div', { class: 'ld-rungs' });
  const tilesBox = h('div', { class: 'ld-tiles' });
  const cards = h('div', { class: 'ld-cards' });
  const hint = h('p', { class: 'hint' });
  const listen = () => play(wordItem(wordOf(steps[k])));
  root.replaceChildren(h('div', { class: 'ladder' },
    h('div', { class: 'ld-side' }, rungs),
    h('div', { class: 'ld-main' },
      h('div', { class: 'ld-top' }, h('button', { class: 'big-round', onClick: listen }, '再聽一次'), h('div', { class: 'ld-progress' })),
      tilesBox, hint, cards)));
  let selected = null; let first = true; let target = 0; let blank = false;

  function drawRungs() {
    rungs.replaceChildren(...steps.map((s, i) => h('div', { class: 'ld-rung' + (i < k ? ' done' : i === k ? ' now' : '') },
      i < k ? wordOf(s) : i === k ? h('span', { class: 'ld-climber' }, mascot(34)) : '')).reverse());
    root.querySelector('.ld-progress').textContent = `第 ${k + 1} / ${steps.length} 階`;
  }
  function drawTiles(okAt = -1) {
    tilesBox.replaceChildren(...cur.map((u, i) => {
      const empty = blank && i === target;
      const t = h('button', { class: 'ld-tile' + (empty ? ' empty' : '') + (i === okAt ? ' ok' : '') + (VOWEL.test(u) ? ' v' : ''), 'data-i': i,
        onClick: () => { if (selected) tryPlace(selected, i); } }, empty ? ' ' : u);
      return t;
    }));
  }
  function setup() {
    first = true; selected = null;
    const want = steps[k];
    if (k === 0) {
      target = cur.findIndex((u) => VOWEL.test(u)); if (target < 0) target = 0;
      blank = true; hint.textContent = '聽一聽，空格裡是哪一個音？把字卡拖進去！';
    } else {
      target = want.findIndex((u, i) => u !== cur[i]); blank = false;
      hint.textContent = '聽新的字！哪一個音變了？把字卡拖到那一格蓋上去！';
    }
    const correct = want[target];
    drawRungs(); drawTiles();
    cards.replaceChildren(...options(correct, k === 0 ? null : cur[target]).map((u) => {
      const c = h('button', { class: 'ld-card', 'data-u': u }, u);
      c.addEventListener('pointerdown', (e) => startDrag(c, u, e));
      return c;
    }));
    listen();
  }
  function startDrag(card, u, e) {
    e.preventDefault(); card.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY }; let moved = false;
    const ghost = h('div', { class: 'ld-card ghost' }, u);
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) { moved = true; document.body.append(ghost); }
      if (moved) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
    };
    const up = (ev) => {
      card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up);
      ghost.remove();
      if (!moved) { // 只點一下：選起來，再點要放的格子
        selected = selected === u ? null : u;
        cards.querySelectorAll('.ld-card').forEach((x) => x.classList.toggle('sel', x.dataset.u === selected));
        if (selected && blank) tryPlace(u, target);
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const tile = el && el.closest('.ld-tile');
      if (tile) tryPlace(u, +tile.dataset.i);
    };
    card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
  }
  function tryPlace(u, i) {
    const want = steps[k];
    const card = cards.querySelector(`.ld-card[data-u="${u}"]`);
    if (u !== want[target]) {
      first = false; sfx('bad'); if (card) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 400); }
      toast('再聽一次！'); listen(); return;
    }
    if (i !== target) {
      first = false; sfx('bad'); const t = tilesBox.children[i]; if (t) { t.classList.add('shake'); setTimeout(() => t.classList.remove('shake'), 400); }
      toast('再聽一次，是哪個音變了？'); listen(); return;
    }
    if (first) firstTry++;
    sfx('ok'); cur = want.slice(); blank = false; drawTiles(target);
    cards.replaceChildren(); hint.textContent = '';
    play(wordItem(wordOf(want)));
    k++;
    setTimeout(() => (k < steps.length ? setup() : finish()), 1100);
  }
  async function finish() {
    drawRungs();
    root.querySelector('.ld-progress').textContent = '爬到頂了！';
    tilesBox.classList.add('top'); hint.textContent = '';
    confetti(); sfx('win');
    say('爬到梯子頂端了！我們一起從頭念一遍！');
    setTimeout(() => play(steps.flatMap((s, i) => [wordItem(wordOf(s), { onstart: () => highlight(i) }), { pause: 250 }])), 2200);
    if (opts.onDone) opts.onDone(firstTry, steps.length);
  }
  function highlight(i) { rungs.querySelectorAll('.ld-rung').forEach((r) => r.classList.remove('read')); const r = rungs.children[steps.length - 1 - i]; if (r) r.classList.add('read'); }
  setup();
  return { stop };
}
