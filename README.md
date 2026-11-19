# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yzrzlrizal-blip/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yzrzlrizal-blip/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an original open-world crime game in the spirit of GTA 6: getaway driver Nia Solano runs six story jobs across a seaside city, stealing cars, fighting the Harlow crew and losing the Solmar PD. It plays offline in a desktop browser from static files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wdbz3sg5&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## The game

**Solmar Bay** is a top-down open-world crime game set in a sun-soaked fictional
seaside city. Every name, place, person, vehicle, story, piece of art and sound
is invented for this game — nothing is taken from Rockstar or any commercial game.

You play **Nia Solano**, a getaway driver back in her hometown after five years
away. Her old friend **Rico Ferrante** pulls her into one last run of jobs
against the **Harlow crew**, who run the docks.

### The city

Solmar Bay has seven districts — Downtown, Old Town, the Marina, Palm Beach,
the Harbor Docks, Cedar Hills and Sunset Park — on a full road grid with
buildings, parks, a beach and the sea along the east shore. A day/night clock
drives golden-hour sunsets and dark streets, and rain rolls in from time to
time, making the roads slick.

### What you can do

- **On foot:** walk, sprint, punch, and shoot a pistol (aim with the mouse).
- **By car:** steal any of 8 original car models — the Coral Coupe, Marlin Sedan,
  Bay Runner, Tide Van, Palm GT, Harbor Hauler, Sunset Taxi and Dune Buggy —
  and drive with steering, skids, crashes and car damage.
- **A living city:** traffic cars drive the road grid and brake for obstacles;
  pedestrians walk the sidewalks and flee from gunfire.
- **Wanted system:** crimes raise your heat and your stars; Solmar PD
  interceptors chase, ram and try to bust you. Break line of sight and stay
  clean to cool off.
- **Six story missions:** Homecoming, The Docks Job, Shakedown, Hot Pursuit,
  The Getaway and the finale, King Tide — with objectives, a waypoint marker
  and cash rewards.
- **Save / load:** progress autosaves after every job, and you can save from
  the HUD or continue from the title screen.
- **HUD and minimap:** cash, health, wanted stars, clock, district name,
  mission objective, speed and ammo, plus a live minimap with the waypoint
  and police positions.
- **Sound:** fully synthesised with the Web Audio API — engine hum, police
  sirens, gunshots, punches and mission jingles. No audio files, no network.

### Controls

WASD move · Shift sprint · E enter / steal car · F punch · Click / Space shoot ·
R reload · M start next job · P pause · U mute

### How it is built

Plain static files — `game/index.html` plus ES modules under `game/src/`
(`config`, `random`, `city`, `world`, `traffic`, `police`, `missions`,
`render`, `input`, `audio`, `shots`, `main`). No libraries, no engine, no
network requests. `main.ts` (Node 22) copies `game/` and `screenshots/` to
the output directory and writes `dossier.json` for the make.fun grader.
