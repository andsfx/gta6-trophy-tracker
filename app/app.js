// GTA VI Trophy Guide - single-page app (ES module, no build, no network requests).
// Data source: app/data/trophies.json. State lives in localStorage under "gta6tracker".

const STORE_KEY = 'gta6tracker';

// Shot mode (?shot=1) seeds a deterministic demo state for stable screenshots
// and never reads or writes localStorage.
const SHOT = new URLSearchParams(location.search).get('shot') === '1';

const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));

// ---------------------------------------------------------------- state

const DEMO_EARNED = [1, 2, 3, 4, 5, 6]; // first 6 trophies, deterministic

function loadState() {
  if (SHOT) return { earned: new Set(DEMO_EARNED), spoiler: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && Array.isArray(saved.earned)) {
      return { earned: new Set(saved.earned.filter((n) => Number.isInteger(n))), spoiler: saved.spoiler === true };
    }
  } catch { /* corrupted store: start fresh */ }
  return { earned: new Set(), spoiler: false };
}

const state = loadState();

function persist() {
  if (SHOT) return; // demo state is never written back
  localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, earned: [...state.earned].sort((a, b) => a - b), spoiler: state.spoiler }));
}

// ---------------------------------------------------------------- helpers

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const grades = ['platinum', 'gold', 'silver', 'bronze'];

const gradeCounts = () => {
  const c = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of trophies) c[t.grade] += 1;
  return c;
};

const isEarned = (t) => state.earned.has(t.id);

// Spoiler rule: with spoilers ON, unearned story trophies hide their name/description.
const hidden = (t) => state.spoiler && t.kind === 'story' && !isEarned(t);

const displayName = (t) => (hidden(t) ? '???' : t.name);
const displayDesc = (t) => (hidden(t) ? 'Hidden until earned' : t.description);

const kindLabel = { story: 'Story', missable: 'Missable', collectible: 'Collectible', activity: 'Activity', online: 'Online' };

function gradeDiamond(grade, big) {
  return el('span', `grade grade-${grade}${big ? ' big' : ''}`);
}

function chip(text, cls) {
  return el('span', `chip ${cls}`, text);
}

function trophyChips(t) {
  const wrap = el('span', 'tags');
  wrap.append(chip(kindLabel[t.kind], `chip-${t.kind}`));
  if (t.missable) wrap.append(chip('Missable', 'chip-miss'));
  wrap.append(chip(`${t.citations.length} SRC`, 'chip-src'));
  return wrap;
}

// ---------------------------------------------------------------- router

const viewRoot = document.getElementById('view');

function currentRoute() {
  const hash = location.hash.replace(/^#/, '');
  if (hash === 'roadmap') return { view: 'roadmap' };
  if (hash === 'settings') return { view: 'settings' };
  const guide = /^guide-(\d+)$/.exec(hash);
  if (guide && byId.has(Number(guide[1]))) return { view: 'guide', id: Number(guide[1]) };
  return { view: 'tracker' };
}

function render() {
  const route = currentRoute();
  viewRoot.replaceChildren();
  if (route.view === 'tracker') renderTracker();
  else if (route.view === 'roadmap') renderRoadmap();
  else if (route.view === 'settings') renderSettings();
  else renderGuide(route.id);
  syncNav(route.view === 'guide' ? 'tracker' : route.view);
  viewRoot.scrollTop = 0;
}

function syncNav(active) {
  for (const link of document.querySelectorAll('.nav-link')) {
    link.classList.toggle('active', link.dataset.nav === active);
  }
}

window.addEventListener('hashchange', render);

// ---------------------------------------------------------------- tracker view

function renderTracker() {
  // Hero: stats strip + progress
  const hero = el('div', 'hero');

  const counts = gradeCounts();
  const stats = el('div', 'stats-strip');
  const pieces = [
    [String(trophies.length), 'Trophies', ''],
    [String(counts.platinum), 'Platinum', 's-plat'],
    [String(counts.gold), 'Gold', 's-gold'],
    [String(counts.silver), 'Silver', 's-silv'],
    [String(counts.bronze), 'Bronze', 's-bron'],
  ];
  pieces.forEach(([n, label, cls], i) => {
    if (i > 0) stats.append(document.createTextNode(' \u00B7 '));
    const b = el('b', cls, n);
    stats.append(b, document.createTextNode(` ${label.toUpperCase()}`));
  });
  hero.append(stats);

  const wrap = el('div', 'progress-wrap');
  const meta = el('div', 'progress-meta');
  const earnedCount = state.earned.size;
  const pct = Math.round((earnedCount / trophies.length) * 100);
  meta.append(
    el('span', null, 'Platinum progress'),
    el('span', null, ''),
  );
  meta.lastChild.replaceWith(
    el('b', null, `${pct}%`),
    document.createTextNode(` ${earnedCount} of ${trophies.length} earned`),
  );
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${pct}%`;
  bar.append(fill);
  wrap.append(meta, bar);
  hero.append(wrap);
  viewRoot.append(hero);

  // Filter row
  const filters = ['all', 'story', 'missable', 'collectible', 'activity', 'online', 'earned', 'hidden'];
  const filterCounts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind === 'story').length,
    missable: trophies.filter((t) => t.missable).length,
    collectible: trophies.filter((t) => t.kind === 'collectible').length,
    activity: trophies.filter((t) => t.kind === 'activity').length,
    online: trophies.filter((t) => t.kind === 'online').length,
    earned: earnedCount,
    hidden: trophies.filter(hidden).length,
  };

  const bar2 = el('div', 'filterbar');
  const buttons = new Map();
  for (const f of filters) {
    const btn = el('button', `fbtn${filter === f ? ' on' : ''}`, null);
    btn.type = 'button';
    btn.append(document.createTextNode(f));
    btn.append(el('span', 'cnt', String(filterCounts[f])));
    btn.addEventListener('click', () => {
      filter = f;
      renderTracker();
    });
    buttons.set(f, btn);
    bar2.append(btn);
  }

  const search = el('input', 'search');
  search.type = 'search';
  search.placeholder = 'Search trophies\u2026';
  search.value = searchText;
  search.addEventListener('input', () => {
    searchText = search.value.trim().toLowerCase();
    renderList();
  });
  bar2.append(search);
  viewRoot.append(bar2);

  // List head + rows
  const head = el('div', 'list-head');
  for (const label of ['', '', 'Trophy', 'Tags', '']) head.append(el('span', null, label));
  viewRoot.append(head);

  const list = el('div', 'list');
  viewRoot.append(list);

  function renderList() {
    list.replaceChildren();
    const rows = trophies.filter((t) => {
      if (filter === 'earned') return isEarned(t);
      if (filter === 'hidden') return hidden(t);
      if (filter !== 'all' && filter !== 'earned' && filter !== 'hidden') {
        if (filter === 'missable') return t.missable;
        return t.kind === filter;
      }
      return true;
    }).filter((t) => {
      if (!searchText) return true;
      return t.name.toLowerCase().includes(searchText) || t.description.toLowerCase().includes(searchText);
    });

    if (rows.length === 0) {
      list.append(el('div', 'empty', 'Nothing matches this filter'));
      return;
    }

    for (const t of rows) {
      const row = el('div', `row${isEarned(t) ? ' earned' : ''}`);
      row.dataset.id = t.id;

      const check = el('label', 'check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = isEarned(t);
      box.setAttribute('aria-label', `Mark ${t.name} earned`);
      box.addEventListener('click', (e) => e.stopPropagation());
      box.addEventListener('change', () => {
        if (box.checked) state.earned.add(t.id);
        else state.earned.delete(t.id);
        persist();
        render();
      });
      check.append(box);
      row.append(check);

      row.append(gradeDiamond(t.grade, false));

      const info = el('div', 'row-info');
      info.append(el('div', 'row-name', displayName(t)));
      info.append(el('div', 'row-desc', displayDesc(t)));
      row.append(info);

      row.append(trophyChips(t));
      row.append(el('span', 'chev', '\u203A'));

      row.addEventListener('click', () => {
        location.hash = `guide-${t.id}`;
      });
      list.append(row);
    }
  }

  renderList();
}

let filter = 'all';
let searchText = '';

// ---------------------------------------------------------------- roadmap view

const STAGES = [
  { n: 1, title: 'The Story, Start to Finish', why: 'One playthrough of the whole story, from Gone Fishing through Chapters 1\u20134 and the final mission.' },
  { n: 2, title: 'Story Missables', why: 'One-time moments that only fire during the run: Bret\u2019s unique animal, the Kolt & Associates alley, and every story choice.' },
  { n: 3, title: 'Side Activities, Open Early', why: 'Light activities you can start immediately: the activity sampler, arcades, the VCIA joyride and the showroom smash.' },
  { n: 4, title: 'The Collectible Sweep', why: 'Map-wide checklists: 18 meditation spots, card sets, 100 WAiNK pins, 100 vehicles, 52 areas, garages and the Scooter Bros app.' },
  { n: 5, title: 'The Repeatable Grind', why: 'Feats you can retry any time: 250 stunts, the 42 shooting range golds, 20 races, robberies, 50 challenges and the money sinks.' },
  { n: 6, title: 'Late Story & Strangers', why: 'The stranger strands and their finales \u2014 Andy, Kenton, Billy, Randy, Tyrone \u2014 the 100% checklist, and the garage buys.' },
  { n: 7, title: 'Second-Run Cleanup', why: 'The missables most players fail: Cal\u2019s fishing challenge, the Ocean Beach cocktail, the partnership peak and the swamp lights.' },
  { n: 8, title: 'The Platinum', why: 'Vice Got a Price! pops the moment the other 54 trophies are earned.' },
];

function renderRoadmap() {
  const compact = SHOT; // screenshot mode renders all 8 stages in one frame
  viewRoot.append(el('h2', 'vh', 'Roadmap to the Platinum'));
  viewRoot.append(el('p', 'vh-sub', 'Eight stages \u00B7 ordered for a two-run platinum'));

  // Missable warnings summary
  const missables = trophies.filter((t) => t.missable);
  const byStage = new Map();
  for (const t of missables) byStage.set(t.stage, (byStage.get(t.stage) ?? 0) + 1);
  let riskiest = null;
  for (const [s, n] of byStage) if (riskiest === null || n > byStage.get(riskiest)) riskiest = s;
  const riskiestStage = STAGES.find((s) => s.n === riskiest);

  const warn = el('div', `warnbox${compact ? ' warnbox-c' : ''}`);
  warn.append(el('div', 'warn-count', String(missables.length)));
  const warnText = el('div', 'warn-text');
  warnText.append(el('b', null, `${missables.length} missable trophies`));
  warnText.append(document.createTextNode(' \u2014 miss one and it waits for a full replay.'));
  warnText.append(el('span', null, `Riskiest stage: Stage ${riskiestStage.n} \u00B7 ${riskiestStage.title} (${byStage.get(riskiest)} of them live there).`));
  warn.append(warnText);
  viewRoot.append(warn);

  for (const stage of STAGES) {
    const members = trophies.filter((t) => t.stage === stage.n);
    const sec = el('section', `stage${compact ? ' stage-c' : ''}`);
    const head = el('div', 'stage-head');
    head.append(el('div', 'stage-num', String(stage.n).padStart(2, '0')));
    head.append(el('div', 'stage-title', stage.title));
    const earnedInStage = members.filter(isEarned).length;
    head.append(el('div', 'stage-count', `${earnedInStage}/${members.length} earned`));
    sec.append(head);
    if (compact) {
      // Compact mode folds the explanation onto the header line so all 8 stages fit.
      head.append(el('span', 'stage-why-inline', stage.why));
    } else {
      sec.append(el('p', 'stage-why', stage.why));
    }

    const list = el('div', 'stage-list');
    for (const t of members) {
      const row = el('div', `trow${t.missable ? ' missable-t' : ''}`);
      row.append(el('span', `gdot gdot-${t.grade}`));
      const nm = el('span', `tname${isEarned(t) ? ' earned-t' : ''}`, displayName(t));
      row.append(nm);
      if (t.missable) row.append(el('span', 'warnmark', '\u26A0'));
      row.title = `${t.name} \u00B7 ${t.grade}`;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => { location.hash = `guide-${t.id}`; });
      list.append(row);
    }
    sec.append(list);
    viewRoot.append(sec);
  }
}

// ---------------------------------------------------------------- guide view

function renderGuide(id) {
  const t = byId.get(id);
  const idx = trophies.findIndex((x) => x.id === id);

  const top = el('div', 'guide-top');
  const titleRow = el('div', 'guide-title-row');
  titleRow.append(gradeDiamond(t.grade, true));
  const titleBlock = el('div');
  titleBlock.append(el('h1', 'guide-name', displayName(t)));
  titleBlock.append(el('div', 'grade-label ' + t.grade, t.grade.toUpperCase()));
  titleRow.append(titleBlock);
  top.append(titleRow);
  top.append(el('p', 'guide-desc', displayDesc(t)));

  const chips = el('div', 'guide-chips');
  chips.append(chip(kindLabel[t.kind], `chip-${t.kind}`));
  if (t.missable) chips.append(chip('Missable \u2014 one chance', 'chip-miss'));
  chips.append(chip(`Stage ${t.stage} \u00B7 ${STAGES[t.stage - 1].title}`, 'chip-src'));
  top.append(chips);
  viewRoot.append(top);

  // Nav row: back, mark earned, prev/next
  const nav = el('div', 'guide-nav-row');
  const back = el('button', 'gbtn', null);
  back.type = 'button';
  back.append(el('span', 'arr', '\u2190'), document.createTextNode(' Tracker'));
  back.addEventListener('click', () => { location.hash = 'tracker'; });
  nav.append(back);

  const mark = el('button', `gbtn ${isEarned(t) ? 'earned-on' : 'primary'}`);
  mark.type = 'button';
  mark.textContent = isEarned(t) ? '\u2713 Earned' : 'Mark earned';
  mark.addEventListener('click', () => {
    if (isEarned(t)) state.earned.delete(t.id);
    else state.earned.add(t.id);
    persist();
    render();
  });
  nav.append(mark);

  const prevBtn = el('button', 'gbtn', null);
  const nextBtn = el('button', 'gbtn', null);
  prevBtn.type = 'button';
  nextBtn.type = 'button';
  prevBtn.append(el('span', 'arr', '\u2190'), document.createTextNode(' Prev'));
  nextBtn.append(document.createTextNode('Next '), el('span', 'arr', '\u2192'));
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === trophies.length - 1;
  prevBtn.style.marginLeft = 'auto';
  prevBtn.addEventListener('click', () => { location.hash = `guide-${trophies[idx - 1].id}`; });
  nextBtn.addEventListener('click', () => { location.hash = `guide-${trophies[idx + 1].id}`; });
  nav.append(prevBtn, nextBtn);
  viewRoot.append(nav);

  // Body: steps + sources side by side
  const cols = el('div', 'guide-col');

  const howPanel = el('div', 'panel');
  howPanel.append(el('h3', null, 'How to earn it'));
  if (hidden(t)) {
    howPanel.append(el('div', 'locked-note', 'Spoilers are on \u2014 earn this trophy to reveal the guide'));
  } else {
    const steps = el('ol', 'steps');
    for (const s of t.steps) steps.append(el('li', null, s));
    howPanel.append(steps);
  }
  cols.append(howPanel);

  const srcPanel = el('div', 'panel');
  srcPanel.append(el('h3', null, 'Sources'));
  const srcs = el('ul', 'sources');
  if (hidden(t)) {
    srcs.append(el('li', null, 'Cited guides are revealed once the trophy is earned.'));
  } else {
    for (const c of t.citations) srcs.append(el('li', null, c));
  }
  srcPanel.append(srcs);
  cols.append(srcPanel);
  viewRoot.append(cols);
}

// ---------------------------------------------------------------- settings view

function renderSettings() {
  viewRoot.append(el('h2', 'vh', 'Settings'));
  viewRoot.append(el('p', 'vh-sub', 'Spoilers, progress backup and reset'));

  // In shot mode the settings shot stages the spoiler toggle ON.
  const spoilerOn = SHOT || state.spoiler;

  const grid = el('div', 'settings-grid');

  // Left column: spoiler toggle + preview
  const left = el('div', 'panel');
  left.append(el('h3', null, 'Spoiler setting'));

  const row = el('div', 'setting-row');
  const lab = el('div');
  lab.append(el('div', 'setting-label', 'Hide story spoilers'));
  lab.append(el('div', 'setting-hint', 'Unearned story trophies show as ??? until you earn them.'));
  const sw = el('label', 'switch');
  const inp = el('input');
  inp.type = 'checkbox';
  inp.checked = spoilerOn;
  inp.addEventListener('change', () => {
    state.spoiler = inp.checked;
    persist();
    render();
  });
  const sl = el('span', 'slider');
  sw.append(inp, sl);
  row.append(lab, sw);
  left.append(row);

  const prev = el('div', 'spoiler-preview panel');
  prev.append(el('h3', null, spoilerOn ? 'Tracker preview \u2014 spoilers on' : 'Tracker preview \u2014 spoilers off'));
  // Unearned story trophies first, so the "???" state is what the preview demonstrates.
  const storyOnes = trophies.filter((x) => x.kind === 'story' && !isEarned(x)).slice(0, 4);
  if (storyOnes.length === 0) storyOnes.push(...trophies.filter((x) => x.kind === 'story').slice(0, 4));
  for (const t of storyOnes) {
    const r = el('div', 'prev-row');
    r.append(el('span', `gdot gdot-${t.grade}`));
    if (spoilerOn && !isEarned(t)) {
      r.append(el('span', 'prev-name prev-hidden', '???'));
      r.append(el('span', 'prev-desc', 'Hidden until earned'));
    } else {
      r.append(el('span', 'prev-name', t.name));
      r.append(el('span', 'prev-desc', t.description));
    }
    prev.append(r);
  }
  left.append(prev);
  grid.append(left);

  // Right column: export / import / reset + about
  const right = el('div', 'panel');
  right.append(el('h3', null, 'Progress backup'));

  const expRow = el('div', 'setting-row');
  expRow.append(el('div', 'setting-label', 'Export'));
  const expBtn = el('button', 'gbtn primary', 'Download JSON');
  expBtn.type = 'button';
  expBtn.addEventListener('click', exportProgress);
  expRow.append(expBtn);
  right.append(expRow);

  const impRow = el('div', 'setting-row');
  const impLab = el('div');
  impLab.append(el('div', 'setting-label', 'Import'));
  impLab.append(el('div', 'setting-hint', 'Load a progress file you exported earlier.'));
  const file = el('input', 'file-input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.addEventListener('change', () => importProgress(file));
  impRow.append(impLab, file);
  right.append(impRow);

  const resRow = el('div', 'setting-row');
  resRow.append(el('div', 'setting-label', 'Reset progress'));
  const resBtn = el('button', 'gbtn', 'Reset all');
  resBtn.type = 'button';
  resBtn.addEventListener('click', () => {
    // Immediate reset: works in any browser, no blocking dialog.
    state.earned.clear();
    state.spoiler = false;
    persist();
    render();
  });
  resRow.append(resBtn);
  right.append(resRow);

  const about = el('div', 'about-line');
  about.append(el('b', null, 'Data: '), document.createTextNode('the official PlayStation trophy list for Grand Theft Auto VI (55 trophies, 2026-11-18).'));
  about.append(document.createElement('br'));
  about.append(document.createTextNode('Roadmap, stages and step-by-step guides were written for this app, with every trophy citing the public guides it was cross-checked against.'));
  about.append(document.createElement('br'));
  about.append(document.createTextNode('Progress and the spoiler setting are stored only in this browser (localStorage).'));
  right.append(about);
  grid.append(right);

  viewRoot.append(grid);
}

function exportProgress() {
  const payload = { version: 1, earned: [...state.earned].sort((a, b) => a - b), spoiler: state.spoiler };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.earned)) throw new Error('bad shape');
    state.earned = new Set(parsed.earned.filter((n) => byId.has(n)));
    state.spoiler = parsed.spoiler === true;
    persist();
    render();
  } catch {
    alert('That file is not a valid progress export.');
  } finally {
    input.value = '';
  }
}

// ---------------------------------------------------------------- boot

if (location.hash === '') location.replace('#tracker');
render();
