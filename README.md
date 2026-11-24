# LAGUNA AZUL — Make GTA 6

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/ferdizi/gta6-01-v2-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/ferdizi/gta6-01-v2-entry/reward.svg)](https://make.fun/bounty/gta6-01)

A GTA-style open-world game in the browser, set in the sun-soaked coastal city of
**Laguna Azul**. You are **Rio**, the getaway driver. With **Luz** (hacker) and
**Marco** (enforcer) you plan and pull off one last job: the Azul National Bank —
then lose the heat in the marina shallows and sail out on the last sunset.

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
No build step, no dependencies to install — plain JavaScript on Three.js.

## The game

- **10 story missions, one bank-job arc** — from `FIRST LIGHT` (meet Luz at
  Plaza Azul) through `HOT WHEELS` (steal the Nebula GT), `MERCADO RUN`,
  `SOUTH BEACH BLUES`, `THE FIXER`, `GOLDEN HOUR` (scout the bank vault),
  `CREW UP`, `THE LAGUNA HEIST`, `SHALLOWS`, to the finale `LAST SUNSET`
  (drive the crew to the south-beach boat).
- **Wanted level 0–5 stars** — steal a car and Azul PD responds. At 3 stars
  roadblocks go up and sirens start; at 4 stars the **police helicopter**
  (air unit) is inbound with its spotlight. Break line of sight in the marina
  shallows and the heat falls star by star.
- **Living city traffic** — 16 cars on the roads and 26 pedestrians on the
  sidewalks, plus police pursuit units that scale with your wanted level.
- **On foot and behind the wheel** — run, jump, steal any parked car, drive
  with a handbrake and a slipstream boost, and watch your vehicle's condition
  and fuel.
- **Dense HUD** — mission panel with objective and next step, police dispatch
  feed, circular minimap (traffic, police, heli, mission target), health and
  armour bars, cash, in-game clock and day, speedometer, vehicle name and
  condition, radio station, and crew dialogue with portraits.
- **Districts to learn** — Plaza Azul, Mercado Viejo, South Beach, Old Town,
  the Azul National Bank, the causeway checkpoint, and the marina shallows.
- **Sound** — engine, sirens, and radio audio (`game/js/audio.js`).

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrow keys | Move / drive |
| E | Enter or exit a car (near a parked car) |
| Space | Jump on foot · handbrake while driving |
| Q | Slipstream boost |
| P | Pause |

You start with $48,250 in cash, 82 health, 64 armour, and 48 pistol rounds.
Getting busted costs you $2,000 — Luz bails you out.

## How to run

Just open the game in a browser:

```sh
# from this repo root
open game/index.html
# or serve it locally, e.g.
npx serve game
# or: python3 -m http.server -d game 8080
```

The entry program for the bounty is `main.ts`. It stages `game/` and
`screenshots/` into the output directory and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It validates the entry first: `game/index.html` and the five core scripts
(`js/main.js`, `js/entities.js`, `js/world.js`, `js/hud.js`, `js/missions.js`)
must exist, and `screenshots/` must hold 3–4 images of at most 256 KiB each.

## Project layout

```text
.
├── main.ts            # bounty entry program: stages game + screenshots, writes dossier.json
├── game/
│   ├── index.html     # game shell
│   ├── style.css      # HUD + menu styling
│   ├── js/
│   │   ├── main.js    # game loop: on-foot + driving, wanted heat, combat
│   │   ├── entities.js# vehicles, pedestrians, Azul PD pursuit, helicopter
│   │   ├── world.js   # Laguna Azul city, districts, roads, lagoon
│   │   ├── hud.js     # mission panel, dispatch, minimap, vitals, dialogue
│   │   ├── missions.js# the 10 story missions
│   │   ├── audio.js   # engine, sirens, radio
│   │   └── rng.js     # seeded random
│   └── vendor/
│       └── three.min.js # Three.js (vendored)
├── screenshots/       # 4 real renders: hero, on-foot, market, start
└── vendor/
    └── makefun-game.ts# dossier builder used by main.ts
```

## Version notes

- **v3** — README rewritten from scratch in a recorded session (fix for the
  `transcripts_witnessed` check: the previous README's final content was
  changed outside the recording). Game code, screenshots, and entry program
  are unchanged from v2.
- **v2 ("LAGUNA AZUL")** — dense-HUD hero frame, rank-fix build: 10 missions,
  wanted 0–5 with air unit, 16 cars + 26 pedestrians, 4 screenshots.
- **v1** — first playable Laguna Azul build.

## License

MIT — see [LICENSE](LICENSE).
