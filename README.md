# Solmar Bay — an open-world crime story

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **Make GTA 6** bounty (gta6-01). Every name, place, person, vehicle,
story, piece of art and sound is invented for this game — nothing is taken
from Rockstar Games or any other commercial game.

## The game

You are **Nia Solano**, a getaway driver back in her hometown after five
years away. Her old friend **Rico Ferrante** pulls her into one last run of
jobs against the **Harlow crew**, who run the docks. The city is **Solmar
Bay**: Downtown, Old Town, the Marina, Palm Beach, the Harbor Docks, Cedar
Hills and Sunset Park — 3,600 × 2,700 units of roads, buildings, parks,
beach and sea, with a day/night clock and occasional rain.

- **On foot and by car** — walk, sprint, punch, shoot the pistol; steal any
  of 8 original car models (Comet Runabout, Bayliner Coupe, Nightshade GT,
  Solmar Taxi…) and drive with steering, skids, crashes and car damage.
- **Traffic and pedestrians** — cars drive the road grid and brake for each
  other; pedestrians stroll the sidewalks, flee gunfire, and flag taxis.
- **Wanted level and police** — 0–5 stars. Stealing, shooting and running
  people over raise the heat; Solmar PD cars chase and ram, foot officers
  chase and bust you. Stay unseen and the heat fades.
- **Missions and a story** — six story jobs (First Light, Hot Wheels,
  Payback at the Docks, Fare Play, Three Keys, The Solmar Job), each with
  staged objectives, a gold marker and a waypoint on the minimap, plus
  taxi fares, 20 hidden sun-coins and health/armor/ammo pickups.
- **Combat** — punching, pistol fire with tracers, Harlow enforcers and
  police who shoot back, an armored van to stop in the finale.
- **HUD with minimap** — cash, health, armor, ammo, wanted stars, clock,
  radio station, mission objective, speedometer, and a live minimap with
  the mission marker, police blips and district name.
- **Start and save** — title screen, pause, help, Wasted/Busted screens,
  and saving/loading to the browser (localStorage). Best cash is remembered.
- **Sound and music** — everything is synthesized with WebAudio: an
  original synthwave bassline on three radio stations, engine hum, sirens,
  gunshots, horns and pickups. No audio files. M mutes, R changes station.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive (Shift = sprint) |
| E | Get in / out of a car (steal it) |
| Q | Punch |
| X | Shoot the pistol |
| H | Horn (in a car) |
| R | Next radio station |
| M | Mute |
| P / Esc | Pause · H help · S save (while paused) · L load save |

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — it plays fully offline, with no network requests:

```sh
python3 -m http.server --directory game 8123
# open http://localhost:8123/
```

Screenshots were staged with `?shot=chase|foot|drive|title&seed=7`, which
plays the real game forward with a scripted autopilot and paints the frame
(see `game/src/shots.js` and `shots.json`).

## Layout

```
main.ts                  entry program: copies game/ + screenshots/ to
                         /output (or $MAKEFUN_OUTPUT_DIR) and writes
                         /output/dossier.json with vendor/makefun-game.ts
game/index.html          the game page (loads only ./src/main.js)
game/src/config.js       tuning, palette, car models, districts
game/src/city.js         the city: roads, buildings, landmarks, collisions
game/src/random.js       seeded random + geometry helpers
game/src/input.js        keyboard / mouse input
game/src/audio.js        synthesized sound + radio music (WebAudio)
game/src/missions.js     story, six missions, objectives
game/src/traffic.js      traffic cars + pedestrians
game/src/police.js       wanted level, police cars + officers
game/src/world.js        simulation: player, cars, combat, missions, save
game/src/render.js       canvas rendering, HUD, minimap, menus
game/src/shots.js        staged screenshot scenes (?shot=…)
game/src/main.js         boot + fixed-step loop + screens
screenshots/             4 real renders of the game in Chromium
vendor/makefun-game.ts   kit library, unchanged
LICENSE                  MIT
```

## Building the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` needs Node 22+ (standard library only, no installs).

## License

MIT — see `LICENSE`.
