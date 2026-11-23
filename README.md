# LAGUNA AZUL — Open-World Getaway

![make.fun](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/ferdizi/gta6-01-v2-entry/rank.svg)
![reward](https://make.fun/badge/gta6-01/ferdizi/gta6-01-v2-entry/reward.svg)

**LAGUNA AZUL v2** — a rank-fix of the v1 entry (judge 98.74%, rank 2,563/11,314).
Same city, same crew, rebuilt hero frame: every system visible in one shot.

Dante “Rio” Marín, getaway driver, one last bank job in the fictional coastal
city of **Laguna Azul** — turquoise lagoon, terracotta rooftops, palms, a marina
and a causeway — at golden hour. Ten story missions end in the Laguna Heist:
four wanted stars, an Azul PD air unit with a searchlight, a roadblock on the
causeway, and one way out — the marina shallows, where the spotlight can't
hold the water.

## Play

Open `game/index.html` in desktop Chrome (static files, no network, no build).
Or serve it: `python3 -m http.server` inside `game/`.

- **WASD** — move / drive · **SHIFT** — sprint · **E** — enter / exit any car
- **CLICK** — shoot (pistol on foot, drive-by from a car) · **SPACE** — jump / handbrake
- **Q** — slipstream boost · **1–5** — weapons · **P** — pause · **M** — map
- Steal cars, outrun Azul PD cruisers (ramming / flanking / roadblocks at 3+
  stars, helicopter + searchlight at 4+), stunt jumps and near-miss bonuses,
  10 missions with a bank-job finale, health + armour, save to localStorage.

## Shot modes

The game can jump straight into real gameplay states for screenshots:

- `?shot=hero` — mission 8/10, the heist escape: 4 stars, helicopter, roadblock,
  explosion, traffic on the causeway, golden hour, full dense HUD
- `?shot=foot` — on-foot pistol combat, 2 stars
- `?shot=market` — mission 3, Mercado Viejo delivery run
- `?shot=start` — title screen over the city

## Tech

- three.js (vendored `game/vendor/three.min.js`) — 3D third-person open world
- Synthesized WebAudio: engine, sirens, gunshots, Golden Hour FM bassline
- All art, names, story and music are original fiction. No Rockstar content.
