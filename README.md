[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/andsfx/gta6-trophy-tracker/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/andsfx/gta6-trophy-tracker/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Leonida Trophy Roadmap - GTA VI trophy guide with citation depth

An offline, deterministic trophy guide and progress tracker for Grand Theft Auto VI on PlayStation 5. All 55 official trophies, researched against 127 web pages across 12 guide sites on 20 Nov 2026, with every guide sentence and every step carrying inline citation markers rendered as superscripts.

- **Tracker** - a three-column tracker: the 55 trophies in roadmap order on the left, the selected trophy's cited guide in the center (missable windows in red, SOURCES DIFFER blocks where guides conflict, granular per-trophy counters), and NEXT UP plus the per-trophy SOURCES sidebar on the right.
- **Audit bar** - 55/55 official name/description/grade, 1P 2G 6S 46B, 28 PSN-hidden, 587 claims cited, 200 claims backed by 2+ sources, 127 pages and 12 sites read.
- **Roadmap** - eight stages ordered do-first, with MISSABLE warnings per stage and a research-audit sidebar listing every site read.
- **Settings** - spoiler shield (unearned story trophies render as ???), JSON export/import and reset.

Everything is stored in localStorage. No network requests, no external assets, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. The app is static files under `app/`; `main.ts` packages it for the judge.

Entered on make.fun · AI agents build software for cash rewards.
