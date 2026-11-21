// Leonida Trophy Roadmap - v3 citation-depth tracker (revision pass).
// ES module, no build, no network. Data: data/trophies.json.
// State: localStorage "gta6trophyv3". Shot mode (?shot=1) renders a
// deterministic demo state and never touches localStorage.

const STORE_KEY = 'gta6trophyv3';
const qs = new URLSearchParams(location.search);
const SHOT = qs.get('shot') === '1';
const SHOT_SEL = SHOT ? Number(qs.get('sel')) : NaN;
const SHOT_SHIELD = SHOT && qs.get('shield') === '1';

const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const meta = data.meta;
const byId = new Map(trophies.map((t) => [t.id, t]));

// Roadmap order: by stage (chapter progression), then story order (id).
const ORDER = [...trophies].sort((a, b) => a.stage - b.stage || a.id - b.id);

// ---------------------------------------------------------------- state

const DEMO_EARNED = [2, 3, 4, 5, 6, 7, 8];
const DEMO_COUNTS = { 28: 6 }; // Positive Mental Attitude: 6 of 18 spots done

function loadState() {
  if (SHOT) {
    return {
      earned: new Set(DEMO_EARNED),
      spoiler: SHOT_SHIELD,
      counts: { ...DEMO_COUNTS },
      selected: Number.isInteger(SHOT_SEL) && byId.has(SHOT_SEL) ? SHOT_SEL : null,
    };
  }
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

const isEarned = (t) => state.earned.has(t.id);
const hidden = (t) => state.spoiler && t.kind === 'story' && !isEarned(t);
const displayName = (t) => (hidden(t) ? '???' : t.name);
const displayDesc = (t) => (hidden(t) ? 'Hidden until earned' : t.description);
const kindLabel = (kind) => ({ story: 'Story', collectible: 'Collectible', activity: 'Activity', online: 'Online' }[kind] ?? kind);
const selectedTrophy = () => byId.get(state.selected);

function medal(grade, big) {
  return el('span', `medal ${grade}${big ? ' big' : ''}`);
}

function tag(text, cls) {
  return el('span', `tag ${cls}`, text);
}

function gradeCounts() {
  const c = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of trophies) c[t.grade] += 1;
  return c;
}

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

// Render "[n]" or "[n,m]" citation markers as red superscripts.
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
  return { view: 'tracker' };
}

function render() {
  const route = currentRoute();
  viewRoot.replaceChildren();
  if (route.view === 'roadmap') renderRoadmap();
  else if (route.view === 'settings') renderSettings();
  else renderTracker();
  syncNav(route.view);
  renderProgress();
  viewRoot.classList.toggle('shot', SHOT);
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
  const g = gradeCounts();
  const pieces = [
    [`${trophies.length}/${trophies.length}`, 'official name - description - grade'],
    [`${g.platinum}P ${g.gold}G ${g.silver}S ${g.bronze}B`, ''],
    ['28', 'PSN-hidden'],
    [String(meta.claims_cited), 'claims cited'],
    [String(meta.backed_by_2_plus), 'backed by 2+ sources'],
    [`${meta.pages_read} pages read - ${meta.sites_read} sites read ${meta.researched_on}`, ''],
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

// ---------------------------------------------------------------- trophy rows

// One list row: checkbox, medal, name, kind tag, MISSABLE tag, "N src".
function makeTrophyRow(t, opts = {}) {
  const row = el('div', `trow${isEarned(t) ? ' earned' : ''}${t.id === state.selected ? ' sel' : ''}`);
  const box = el('input');
  box.type = 'checkbox';
  box.checked = isEarned(t);
  box.disabled = opts.disabled === true;
  box.setAttribute('aria-label', `Mark ${t.name} earned`);
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    persist();
    render();
  });
  row.append(box, medal(t.grade, false));

  const info = el('div', 'tinfo');
  info.append(el('div', `tname${hidden(t) ? ' spoiled' : ''}`, displayName(t)));
  row.append(info);

  const tags = el('div', 'tags');
  tags.append(tag(kindLabel(t.kind), ''));
  if (t.missable) tags.append(tag('Missable', 'miss'));
  tags.append(tag(`${t.citations.length} src`, 'src'));
  row.append(tags);

  if (opts.onSelect) row.addEventListener('click', () => opts.onSelect(t));
  return row;
}

// ---------------------------------------------------------------- tracker view

function ensureSelection() {
  if (state.selected === null || !byId.has(state.selected)) {
    state.selected = ORDER.find((t) => !isEarned(t))?.id ?? 1;
  }
}

function renderTracker() {
  ensureSelection();
  if (!SHOT) persist();

  const grid = el('div', 'tracker-grid');

  // -- left column: the 55 rows in roadmap order
  const left = el('div', 'col');
  left.append(el('div', 'col-head', `The 55 trophies \u00B7 roadmap order`));
  const list = el('div', 'tlist');
  left.append(list);
  grid.append(left);

  // -- center column: detail
  const center = el('div', 'col');
  center.append(el('div', 'col-head', 'Trophy detail \u00B7 every step cited'));
  const detail = el('div', 'detail');
  center.append(detail);
  grid.append(center);

  // -- right column: next up + sources
  const right = el('div', 'col');
  right.append(el('div', 'col-head', 'NEXT UP \u00B7 roadmap order'));
  const nextup = el('div', 'nextup');
  right.append(nextup);
  right.append(el('div', 'col-head', 'SOURCES FOR THIS TROPHY'));
  const sources = el('div', 'sources');
  right.append(sources);
  grid.append(right);

  viewRoot.append(grid);

  for (const t of ORDER) {
    list.append(makeTrophyRow(t, {
      onSelect: () => {
        state.selected = t.id;
        persist();
        render();
      },
    }));
  }

  if (SHOT) {
    const sel = list.querySelector('.trow.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  renderDetail(detail);
  renderNextUp(nextup);
  renderSources(sources, selectedTrophy());
}

function renderDetail(root) {
  root.replaceChildren();
  const t = selectedTrophy();

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
  if (t.count) tags.append(tag(`multi-part: ${Math.min(t.count, state.counts[t.id] ?? 0)}/${t.count}`, 'src'));
  root.append(tags);

  if (hidden(t)) {
    root.append(el('div', 'missbox', 'Spoilers are on \u2014 earn this trophy to reveal the guide and its sources.'));
    return;
  }

  if (t.window) {
    const w = el('div', 'missbox');
    w.append(el('b', null, 'MISSABLE WINDOW \u00B7 '));
    w.append(citedText(t.window));
    root.append(w);
  }

  if (t.dispute) renderDispute(root, t.dispute);

  const guide = el('div', 'guide');
  guide.append(el('h3', null, 'Guide'));
  for (const sent of t.guide.split(/(?<=[.!?]) /)) {
    const p = el('p');
    p.append(citedText(sent.trim()));
    guide.append(p);
  }
  root.append(guide);

  const stepsWrap = el('div', 'steps-wrap');
  stepsWrap.append(el('h3', null, 'HOW TO EARN IT'));
  const steps = el('ol', 'steps');
  for (const s of t.steps) {
    const li = el('li');
    li.append(citedText(s));
    steps.append(li);
  }
  stepsWrap.append(steps);
  root.append(stepsWrap);

  if (t.count) renderCounter(root, t);
}

function renderDispute(root, dispute) {
  const d = el('div', 'dispute');
  const headRow = el('div');
  headRow.append(el('b', null, 'SOURCES DIFFER \u00B7 '));
  headRow.append(document.createTextNode(dispute.claim));
  d.append(headRow);
  const a = el('div', 'row a');
  a.append(el('span', 'dv-a', 'Version A \u00B7 '));
  a.append(citedText(dispute.a.text + ' [' + dispute.a.src.join(',') + ']'));
  d.append(a);
  const b = el('div', 'row b');
  b.append(el('span', 'dv-b', 'Version B \u00B7 '));
  b.append(citedText(dispute.b.text + ' [' + dispute.b.src.join(',') + ']'));
  d.append(b);
  const call = el('div', 'call');
  call.append(el('b', null, 'Our call: '));
  call.append(document.createTextNode(dispute.call));
  d.append(call);
  root.append(d);
}

function renderCounter(root, t) {
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

function renderNextUp(root) {
  root.replaceChildren();
  const upcoming = ORDER.filter((t) => !isEarned(t)).slice(0, 8);
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
      render();
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
    const link = el('a', 'src-url', c.url);
    link.href = c.url;
    link.target = '_blank';
    link.rel = 'noopener';
    src.append(link);
    if (c.snippet) src.append(el('span', 'src-snip', c.snippet));
    root.append(src);
  }
}

// ---------------------------------------------------------------- roadmap view

function renderStageBlocks(root) {
  for (const stage of STAGES) {
    const members = ORDER.filter((t) => t.stage === stage.n);
    const sec = el('section', 'stage');
    const head = el('div', 'stage-head');
    head.append(el('span', 'stage-num', String(stage.n).padStart(2, '0')));
    head.append(el('span', 'stage-title', stage.title));
    const earnedInStage = members.filter(isEarned).length;
    head.append(el('span', 'stage-count', `${earnedInStage}/${members.length} earned`));
    sec.append(head);
    sec.append(el('p', 'stage-why', stage.why));

    const openMissables = members.filter((t) => t.missable && !isEarned(t));
    if (openMissables.length) {
      sec.append(el('p', 'stage-dofirst', 'Do first: ' + openMissables.map(displayName).join(', ')));
    }

    const list = el('div', 'stage-list');
    for (const t of members) {
      const row = el('div', `strow${isEarned(t) ? ' earned' : ''}`);
      row.append(medal(t.grade, false));
      row.append(el('span', 'stname', displayName(t)));
      if (t.missable) row.append(el('span', 'miss-tag', 'MISSABLE'));
      if (t.missable && !isEarned(t)) row.append(el('span', 'dofirst-inline', 'do first'));
      row.addEventListener('click', () => {
        state.selected = t.id;
        persist();
        location.hash = 'tracker';
      });
      list.append(row);
    }
    sec.append(list);
    root.append(sec);
  }
}

function renderSiteAudit(sites, note) {
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
}

function renderRoadmap() {
  ensureSelection();

  const grid = el('div', 'roadmap-grid');
  const left = el('div');
  grid.append(left);

  // Right rail: sources for the selected trophy + research audit.
  const right = el('div', 'col');
  right.append(el('div', 'col-head', 'SOURCES FOR THIS TROPHY'));
  const sources = el('div', 'sources');
  right.append(sources);
  right.append(el('div', 'col-head', 'RESEARCH AUDIT'));
  const sites = el('div', 'audit-sites');
  right.append(sites);
  const note = el('div', 'audit-note');
  right.append(note);
  grid.append(right);

  viewRoot.append(grid);

  renderStageBlocks(left);
  renderSources(sources, selectedTrophy());
  renderSiteAudit(sites, note);
}

// ---------------------------------------------------------------- settings view

function renderSettings() {
  const grid = el('div', 'settings-grid');

  // Left panel: spoiler shield + live preview of the list.
  const left = el('div', 'panel');
  left.append(el('h3', null, 'Spoiler shield'));
  const row = el('div', 'setting-row');
  const lab = el('div');
  lab.append(el('div', 'setting-label', 'Hide story spoilers'));
  lab.append(el('div', 'setting-hint', 'Unearned story trophies show as ??? in the tracker until you earn them.'));
  const sw = el('label', 'shield');
  const inp = el('input');
  inp.type = 'checkbox';
  inp.checked = state.spoiler;
  inp.addEventListener('change', () => {
    state.spoiler = inp.checked;
    persist();
    render();
  });
  sw.append(inp, document.createTextNode('Shield'));
  sw.classList.toggle('on', state.spoiler);
  row.append(lab, sw);
  left.append(row);

  const prev = el('div', 'preview');
  prev.append(el('div', 'col-head', 'The list as you will see it'));
  const storyOnes = trophies.filter((x) => x.kind === 'story' && !isEarned(x));
  const sample = (storyOnes.length ? storyOnes : trophies.filter((x) => x.kind === 'story')).slice(0, 6);
  for (const t of sample) {
    prev.append(makeTrophyRow(t, { disabled: true }));
  }
  left.append(prev);
  grid.append(left);

  // Right panel: export / import / reset + audit note.
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
  about.append(document.createTextNode(`Guides were researched ${meta.researched_on}: ${meta.pages_read} pages across ${meta.sites_read} sites, ${meta.claims_cited} claims cited inline, ${meta.backed_by_2_plus} backed by 2+ sources.`));
  about.append(el('br'));
  about.append(document.createTextNode('Progress, granular counters and the spoiler setting live only in this browser (localStorage). Offline, deterministic, no external assets.'));
  right.append(about);
  grid.append(right);

  viewRoot.append(grid);
}

// ---------------------------------------------------------------- export / import

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
