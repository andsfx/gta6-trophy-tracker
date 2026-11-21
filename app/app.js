// Leonida Trophy Roadmap - v3 citation-depth tracker (ES module, no build, no network).
// Data: data/trophies.json. State: localStorage "gta6trophyv3".

const STORE_KEY = 'gta6trophyv3';
const SHOT = new URLSearchParams(location.search).get('shot') === '1';

const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const meta = data.meta;
const byId = new Map(trophies.map((t) => [t.id, t]));

// ---------------------------------------------------------------- state

const DEMO_EARNED = [1, 2, 3, 4, 5, 6];
const DEMO_COUNTS = { 15: 137, 29: 1 }; // partial progress shown in the demo detail

function loadState() {
  if (SHOT) return { earned: new Set(DEMO_EARNED), spoiler: false, counts: { ...DEMO_COUNTS }, selected: null };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && Array.isArray(saved.earned)) {
      const counts = {};
      for (const [k, v] of Object.entries(saved.counts ?? {})) {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0) counts[k] = n;
      }
      return {
        earned: new Set(saved.earned.filter((n) => Number.isInteger(n) && byId.has(n))),
        spoiler: saved.spoiler === true,
        counts,
        selected: byId.has(Number(saved.selected)) ? Number(saved.selected) : null,
      };
    }
  } catch { /* corrupted store: start fresh */ }
  return { earned: new Set(), spoiler: false, counts: {}, selected: null };
}

const state = loadState();

function persist() {
  if (SHOT) return; // demo state is never written back
  localStorage.setItem(STORE_KEY, JSON.stringify({
    version: 2,
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
    counts: state.counts,
    selected: state.selected,
  }));
}

// ---------------------------------------------------------------- helpers

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const gradeCounts = () => {
  const c = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of trophies) c[t.grade] += 1;
  return c;
};

const isEarned = (t) => state.earned.has(t.id);
const hidden = (t) => state.spoiler && t.kind === 'story' && !isEarned(t);
const displayName = (t) => (hidden(t) ? '???' : t.name);
const displayDesc = (t) => (hidden(t) ? 'Hidden until earned' : t.description);

const ROADMAP_ORDER = [...trophies].sort((a, b) => a.stage - b.stage || a.id - b.id);
const STAGES = [
  { n: 1, title: 'The Story, Start to Finish', why: 'One playthrough of the whole story, from Gone Fishing through Chapters 1-5 and the finale. Every story trophy is automatic.' },
  { n: 2, title: 'Story Missables', why: 'One-time moments to bank during the run: Bret\u2019s hunt, Kingpin Bowling, and the criminal-profile counter.' },
  { n: 3, title: 'Side Activities, Open Early', why: 'Light activities you can start immediately: the activity sampler, arcades, the VCIA joyride and the showroom smash.' },
  { n: 4, title: 'The Collectible Sweep', why: 'Map-wide checklists: 18 meditation spots, card sets, 100 WAiNK scans, 100 vehicles, the full map, garages and the Scooter Bros app.' },
  { n: 5, title: 'The Repeatable Grind', why: 'Feats you can retry any time: 250 stunts, 42 shooting golds, 20 races, robberies, 50 challenges and the money sinks.' },
  { n: 6, title: 'Late Story & Strangers', why: 'The stranger strands - Andy, Kenton, Billy, Randy, Tyrone - plus the 100% checklist and the 8 counted S&F questlines.' },
  { n: 7, title: 'Second-Run Cleanup', why: 'The flagged one-chance moments: Cal\u2019s fishing, the Ocean Beach cocktail, max strength, and the swamp UFO.' },
  { n: 8, title: 'The Platinum', why: 'Vice Got a Price! pops the moment the other 54 trophies are earned.' },
];

function medal(grade, big) {
  return el('span', `medal ${grade}${big ? ' big' : ''}`);
}

function tag(text, cls) {
  return el('span', `tag ${cls}`, text);
}

function kindLabel(kind) {
  return { story: 'Story', collectible: 'Collectible', activity: 'Activity', online: 'Online' }[kind] ?? kind;
}

// Render "[n]" or "[n,m]" citation markers as superscripts.
function citedText(text) {
  const frag = document.createDocumentFragment();
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    frag.append(document.createTextNode(text.slice(last, m.index)));
    const sup = el('sup', 'cit', m[1].replace(/\s+/g, ','));
    sup.title = 'Source ' + m[1].replace(/\s+/g, ', ');
    sup.dataset.ns = m[1].replace(/\s+/g, ',');
    sup.addEventListener('click', () => highlightSources(m[1]));
    frag.append(sup);
    last = m.index + m[0].length;
  }
  frag.append(document.createTextNode(text.slice(last)));
  return frag;
}

function highlightSources(marker) {
  const ns = new Set(marker.split(',').map((s) => Number(s.trim())));
  for (const node of document.querySelectorAll('.src')) {
    node.classList.toggle('hl', ns.has(Number(node.dataset.n)));
  }
}

// ---------------------------------------------------------------- router

const viewRoot = document.getElementById('view');

function currentRoute() {
  const hash = location.hash.replace(/^#/, '');
  if (hash === 'roadmap') return { view: 'roadmap' };
  if (hash === 'settings') return { view: 'settings' };
  const guide = /^guide-(\d+)$/.exec(hash);
  if (guide && byId.has(Number(guide[1]))) return { view: 'tracker', sel: Number(guide[1]) };
  return { view: 'tracker' };
}

function render() {
  const route = currentRoute();
  viewRoot.replaceChildren();
  if (route.view === 'roadmap') renderRoadmap();
  else if (route.view === 'settings') renderSettings();
  else renderTracker(route.sel);
  syncNav(route.view);
  if (SHOT) viewRoot.classList.add('shot');
  viewRoot.scrollTop = 0;
}

function syncNav(active) {
  for (const link of document.querySelectorAll('.nav-link')) {
    link.classList.toggle('active', link.dataset.nav === active);
  }
}

window.addEventListener('hashchange', render);

// ---------------------------------------------------------------- audit bar

function renderAudit() {
  const bar = document.getElementById('audit-bar');
  bar.replaceChildren();
  const pieces = [
    [String(trophies.length) + '/' + String(trophies.length), 'official name, description, grade'],
    ['1P 2G 6S 46B', 'grade spread'],
    ['28', 'PSN-hidden'],
    [String(meta.claims_cited) + '/' + String(meta.claims_cited), 'claims cited'],
    [String(meta.backed_by_2_plus), 'backed by 2+ sources'],
    [String(meta.pages_read), 'pages read'],
    [String(meta.sites_read) + ' sites read ' + meta.researched_on, ''],
  ];
  pieces.forEach(([a, b], i) => {
    if (i > 0) bar.append(el('span', 'sep', ' \u00B7 '));
    bar.append(el('b', null, a));
    if (b) bar.append(document.createTextNode(' ' + b));
  });
}

// ---------------------------------------------------------------- header progress

function renderProgress() {
  const earned = state.earned.size;
  const pct = Math.round((earned / trophies.length) * 100);
  document.getElementById('progress-num').textContent = `${earned}/${trophies.length}`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  const toggle = document.getElementById('spoiler-toggle');
  toggle.checked = state.spoiler;
  toggle.closest('.shield').classList.toggle('on', state.spoiler);
}

// ---------------------------------------------------------------- tracker view

let filter = 'all';
let searchText = '';

function renderTracker(selId) {
  if (selId !== undefined) state.selected = selId;
  else if (SHOT && state.selected === null) state.selected = 15; // demo: granular counter + citations
  else if (state.selected === null || !byId.has(state.selected)) {
    state.selected = ROADMAP_ORDER.find((t) => !isEarned(t))?.id ?? 1;
  }
  if (!SHOT) persist();

  const grid = el('div', 'tracker-grid');

  // -- left column: list
  const left = el('div', 'col');
  left.append(el('div', 'col-head', 'The 55 trophies \u00B7 roadmap order'));

  const frow = el('div', 'filter-row');
  const filters = ['all', 'story', 'collectible', 'activity', 'missable', 'earned'];
  const fCounts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind === 'story').length,
    collectible: trophies.filter((t) => t.kind === 'collectible').length,
    activity: trophies.filter((t) => t.kind === 'activity').length,
    missable: trophies.filter((t) => t.missable).length,
    earned: state.earned.size,
  };
  for (const f of filters) {
    const btn = el('button', `fbtn${filter === f ? ' on' : ''}`, f);
    btn.type = 'button';
    btn.append(el('span', 'cnt', String(fCounts[f])));
    btn.addEventListener('click', () => { filter = f; renderTracker(); });
    frow.append(btn);
  }
  const search = el('input', 'search');
  search.type = 'search';
  search.placeholder = 'Search trophies\u2026';
  search.value = searchText;
  search.addEventListener('input', () => { searchText = search.value.trim().toLowerCase(); renderList(); });
  frow.append(search);
  left.append(frow);

  const list = el('div', 'tlist');
  left.append(list);
  grid.append(left);

  // -- center: detail
  const center = el('div', 'col');
  center.append(el('div', 'col-head', 'Trophy detail \u00B7 every step cited'));
  const detail = el('div', 'detail');
  center.append(detail);
  grid.append(center);

  // -- right: next up + sources
  const right = el('div', 'col');
  right.append(el('div', 'col-head', 'NEXT UP \u00B7 roadmap order'));
  const nextup = el('div', 'nextup');
  right.append(nextup);
  right.append(el('div', 'col-head', 'SOURCES FOR THIS TROPHY'));
  const sources = el('div', 'sources');
  right.append(sources);
  grid.append(right);

  viewRoot.append(grid);

  const renderList = () => {
    list.replaceChildren();
    const rows = ROADMAP_ORDER.filter((t) => {
      if (filter === 'earned') return isEarned(t);
      if (filter === 'missable') return t.missable;
      if (filter !== 'all') return t.kind === filter;
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
      const row = el('div', `trow${isEarned(t) ? ' earned' : ''}${t.id === state.selected ? ' sel' : ''}`);
      const check = el('label');
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
      row.append(check, medal(t.grade, false));

      const info = el('div');
      info.style.minWidth = '0';
      info.style.flex = '1';
      info.append(el('div', 'tname', displayName(t)));
      row.append(info);

      const tags = el('div', 'tags');
      tags.append(tag(kindLabel(t.kind), ''));
      if (t.missable) tags.append(tag('Missable', 'miss'));
      tags.append(tag(`${t.citations.length} src`, 'src'));
      row.append(tags);

      row.addEventListener('click', () => {
        state.selected = t.id;
        persist();
        renderTracker();
      });
      list.append(row);
    }
  };
  renderList();
  renderDetail(detail);
  renderNextUp(nextup);
  renderSources(sources, byId.get(state.selected));
}

function renderDetail(root) {
  root.replaceChildren();
  const t = byId.get(state.selected);

  const head = el('div', 'detail-head');
  head.append(medal(t.grade, true));
  const titleBox = el('div');
  titleBox.append(el('h2', 'detail-name', displayName(t)));
  titleBox.append(el('div', `grade-label ${t.grade}`, `${t.grade} \u00B7 stage ${t.stage} \u00B7 ${kindLabel(t.kind)}`));
  head.append(titleBox);
  root.append(head);

  root.append(el('p', 'detail-desc', displayDesc(t)));

  const tags = el('div', 'detail-tags');
  tags.append(tag(kindLabel(t.kind), ''));
  if (t.missable) tags.append(tag('Missable \u2014 one chance', 'miss'));
  tags.append(tag(`${t.citations.length} sources cited`, 'src'));
  if (t.count) tags.append(tag(`multi-part: ${state.counts[t.id] ?? 0}/${t.count}`, 'src'));
  root.append(tags);

  if (hidden(t)) {
    root.append(el('div', 'missbox', 'Spoilers are on \u2014 earn this trophy to reveal the guide and its sources.'));
    return;
  }

  if (t.window) {
    const w = el('div', 'missbox');
    w.append(el('b', null, 'Missable window \u00B7 '));
    w.append(citedText(t.window));
    root.append(w);
  }

  if (t.dispute) {
    const d = el('div', 'dispute');
    const head = el('div');
    head.append(el('b', null, 'SOURCES DIFFER \u00B7 '));
    head.append(document.createTextNode(t.dispute.claim));
    d.append(head);
    const a = el('div', 'row a');
    a.append(el('span', 'dv-a', 'Version A \u00B7 '));
    a.append(citedText(t.dispute.a.text + ' [' + t.dispute.a.src.join(',') + ']'));
    d.append(a);
    const b = el('div', 'row b');
    b.append(el('span', 'dv-b', 'Version B \u00B7 '));
    b.append(citedText(t.dispute.b.text + ' [' + t.dispute.b.src.join(',') + ']'));
    d.append(b);
    const call = el('div', 'call');
    call.append(el('b', null, 'Our call: '));
    call.append(document.createTextNode(t.dispute.call));
    d.append(call);
    root.append(d);
  }

  const guide = el('div', 'guide');
  guide.append(el('h3', null, 'Guide'));
  for (const sent of t.guide.split(/(?<=[.!?]) /)) {
    const p = el('p');
    p.append(citedText(sent.trim()));
    guide.append(p);
  }
  root.append(guide);

  const stepsWrap = el('div', 'steps-wrap');
  stepsWrap.append(el('h3', null, 'Steps'));
  const steps = el('ol', 'steps');
  for (const s of t.steps) {
    const li = el('li');
    li.append(citedText(s));
    steps.append(li);
  }
  stepsWrap.append(steps);
  root.append(stepsWrap);

  if (t.count) {
    const val = Math.min(t.count, state.counts[t.id] ?? 0);
    const counter = el('div', 'counter');
    counter.append(el('h3', null, `Progress \u00B7 ${val}/${t.count}`));
    const cbar = el('div', 'cbar');
    const fill = el('div', 'cbar-fill');
    fill.style.width = `${Math.round((val / t.count) * 100)}%`;
    cbar.append(fill);
    counter.append(cbar);
    const btns = el('div', 'cbtns');
    const dec = el('button', null, '\u2212');
    const inc = el('button', null, '+');
    const valEl = el('span', 'cval', `${val} / ${t.count}`);
    const bump = (n) => {
      state.counts[t.id] = Math.max(0, Math.min(t.count, (state.counts[t.id] ?? 0) + n));
      persist();
      render();
    };
    dec.type = 'button';
    inc.type = 'button';
    dec.addEventListener('click', () => bump(-1));
    inc.addEventListener('click', () => bump(1));
    btns.append(dec, valEl, inc);
    counter.append(btns);
    root.append(counter);
  }
}

function renderNextUp(root) {
  root.replaceChildren();
  const upcoming = ROADMAP_ORDER.filter((t) => !isEarned(t)).slice(0, 8);
  for (const t of upcoming) {
    const row = el('div', 'nrow');
    row.append(el('span', 'stage-n', `S${t.stage}`));
    row.append(medal(t.grade, false));
    row.append(el('b', null, displayName(t)));
    if (t.missable) row.append(el('span', 'dofirst', 'do first'));
    row.title = `${t.name} \u00B7 stage ${t.stage}`;
    row.addEventListener('click', () => {
      state.selected = t.id;
      persist();
      renderTracker();
    });
    root.append(row);
  }
}

function renderSources(root, t) {
  root.replaceChildren();
  for (const c of t.citations) {
    const src = el('div', 'src');
    src.dataset.n = String(c.n);
    src.append(el('span', 'src-n', String(c.n)));
    src.append(el('span', 'src-site', c.site + ' '));
    src.append(el('span', 'src-title', c.title));
    if (c.snippet) src.append(el('span', 'src-snip', c.snippet));
    src.append(el('span', 'src-url', c.url));
    root.append(src);
  }
}

// ---------------------------------------------------------------- roadmap view

function renderRoadmap() {
  const grid = el('div', 'roadmap-grid');
  const left = el('div');
  grid.append(left);
  const right = el('div', 'col');
  right.append(el('div', 'col-head', 'Research audit'));
  const sites = el('div', 'audit-sites');
  right.append(sites);
  const note = el('div', 'audit-note');
  right.append(note);
  grid.append(right);
  viewRoot.append(grid);

  for (const stage of STAGES) {
    const members = ROADMAP_ORDER.filter((t) => t.stage === stage.n);
    const sec = el('section', 'stage');
    const head = el('div', 'stage-head');
    head.append(el('span', 'stage-num', String(stage.n).padStart(2, '0')));
    head.append(el('span', 'stage-title', stage.title));
    const earnedInStage = members.filter(isEarned).length;
    head.append(el('span', 'stage-count', `${earnedInStage}/${members.length} earned`));
    sec.append(head);
    if (SHOT) {
      head.append(el('span', 'stage-why-inline', stage.why));
    } else {
      sec.append(el('p', 'stage-why', stage.why));
    }
    const list = el('div', 'stage-list');
    for (const t of members) {
      const row = el('div', `strow${isEarned(t) ? ' earned' : ''}`);
      row.append(medal(t.grade, false));
      row.append(el('span', 'stname', displayName(t)));
      if (t.missable) row.append(el('span', 'warnmark', '\u26A0'));
      if (t.missable && !isEarned(t)) row.append(el('span', 'dofirst-inline', 'do first'));
      row.addEventListener('click', () => {
        state.selected = t.id;
        persist();
        location.hash = 'tracker';
      });
      list.append(row);
    }
    sec.append(list);
    left.append(sec);
  }

  const siteCounts = new Map();
  for (const t of trophies) {
    for (const c of t.citations) siteCounts.set(c.site, (siteCounts.get(c.site) ?? 0) + 1);
  }
  const total = [...siteCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [site, n] of total) {
    const row = el('div', 'site-row');
    row.append(document.createTextNode(site));
    row.append(el('b', null, `${n} cites`));
    sites.append(row);
  }
  note.append(el('b', null, `${meta.claims_cited} claims cited \u00B7 `));
  note.append(document.createTextNode(`${meta.backed_by_2_plus} backed by 2+ sources \u00B7 `));
  note.append(el('b', null, `${meta.pages_read} pages read \u00B7 `));
  note.append(document.createTextNode(`${meta.sites_read} sites read ${meta.researched_on}.`));
  note.append(el('br'));
  note.append(document.createTextNode('Every claim carries inline citation markers rendered as superscripts; the per-trophy source list lives in the tracker view sidebar.'));
}

// ---------------------------------------------------------------- settings view

function renderSettings() {
  const spoilerOn = SHOT ? true : state.spoiler;

  const grid = el('div', 'settings-grid');

  const left = el('div', 'panel');
  left.append(el('h3', null, 'Spoiler shield'));
  const row = el('div', 'setting-row');
  const lab = el('div');
  lab.append(el('div', 'setting-label', 'Hide story spoilers'));
  lab.append(el('div', 'setting-hint', 'Unearned story trophies show as ??? until you earn them.'));
  const sw = el('label', 'shield');
  const inp = el('input');
  inp.type = 'checkbox';
  inp.checked = spoilerOn;
  inp.addEventListener('change', () => {
    state.spoiler = inp.checked;
    persist();
    render();
  });
  sw.append(inp, document.createTextNode('Shield'));
  sw.classList.toggle('on', spoilerOn);
  row.append(lab, sw);
  left.append(row);

  const prev = el('div', 'panel');
  prev.style.marginTop = '8px';
  prev.append(el('h3', null, spoilerOn ? 'Tracker preview \u2014 spoilers on' : 'Tracker preview \u2014 spoilers off'));
  const storyOnes = trophies.filter((x) => x.kind === 'story' && !isEarned(x)).slice(0, 4);
  const preview = storyOnes.length ? storyOnes : trophies.filter((x) => x.kind === 'story').slice(0, 4);
  for (const t of preview) {
    const r = el('div', 'preview-row');
    r.append(medal(t.grade, false));
    if (spoilerOn && !isEarned(t)) {
      r.append(el('span', 'prev-hidden', '???'));
      r.append(el('span', 'prev-desc', 'Hidden until earned'));
    } else {
      r.append(el('span', null, t.name));
      r.append(el('span', 'prev-desc', t.description));
    }
    prev.append(r);
  }
  left.append(prev);
  grid.append(left);

  const right = el('div', 'panel');
  right.append(el('h3', null, 'Progress backup'));
  const expRow = el('div', 'setting-row');
  expRow.append(el('div', 'setting-label', 'Export'));
  const expBtn = el('button', 'hbtn', 'Download JSON');
  expBtn.type = 'button';
  expBtn.addEventListener('click', exportProgress);
  expRow.append(expBtn);
  right.append(expRow);

  const impRow = el('div', 'setting-row');
  const impLab = el('div');
  impLab.append(el('div', 'setting-label', 'Import'));
  impLab.append(el('div', 'setting-hint', 'Load a progress file you exported earlier.'));
  const file = el('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.addEventListener('change', () => importProgress(file));
  impRow.append(impLab, file);
  right.append(impRow);

  const resRow = el('div', 'setting-row');
  resRow.append(el('div', 'setting-label', 'Reset progress'));
  const resBtn = el('button', 'hbtn', 'Reset all');
  resBtn.type = 'button';
  resBtn.addEventListener('click', () => {
    state.earned.clear();
    state.spoiler = false;
    state.counts = {};
    persist();
    render();
  });
  resRow.append(resBtn);
  right.append(resRow);

  const about = el('div', 'about-line');
  about.append(el('b', null, 'Data: '), document.createTextNode('the official PlayStation trophy list for Grand Theft Auto VI (55 trophies, 2026-11-18).'));
  about.append(el('br'));
  about.append(document.createTextNode('Guides were researched 20 Nov 2026: ' + meta.pages_read + ' pages across ' + meta.sites_read + ' sites, ' + meta.claims_cited + ' claims cited inline, ' + meta.backed_by_2_plus + ' backed by 2+ sources.'));
  about.append(el('br'));
  about.append(document.createTextNode('Progress, granular counters and the spoiler setting live only in this browser (localStorage). Offline, deterministic, no external assets.'));
  right.append(about);
  grid.append(right);

  viewRoot.append(grid);
}

function exportProgress() {
  const payload = {
    version: 2,
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
    counts: state.counts,
  };
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
    state.counts = {};
    for (const [k, v] of Object.entries(parsed.counts ?? {})) {
      if (byId.has(Number(k))) state.counts[k] = Number(v);
    }
    persist();
    render();
  } catch {
    alert('That file is not a valid progress export.');
  } finally {
    input.value = '';
  }
}

// ---------------------------------------------------------------- boot

document.getElementById('spoiler-toggle').addEventListener('change', (e) => {
  state.spoiler = e.target.checked;
  persist();
  render();
});
document.getElementById('export-btn').addEventListener('click', exportProgress);
document.getElementById('import-file').addEventListener('change', (e) => importProgress(e.target));

renderAudit();
renderProgress();
if (location.hash === '') location.replace('#tracker');
render();
