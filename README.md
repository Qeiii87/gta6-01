# Solmar Bay — an open-world crime story

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Qeiii87/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Qeiii87/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an open-world crime game in the spirit of GTA 6, built for
[make.fun's gta6-01 bounty](https://make.fun/bounty/gta6-01). It runs entirely
offline in a desktop browser from static files — no build step, no network.

## Play it

Serve `game/` with any static server (or `node serve.ts`) and open
http://localhost:8080. Keyboard and mouse:

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, run, drive |
| Shift | Run |
| E | Enter / exit a car |
| Mouse + click | Aim and shoot |
| R | Reload |
| Space | Brake / handbrake |
| Esc / P | Pause |
| M | Mute |

## The game

You are **Jace Marlowe**, fresh out of a bad deal in the coastal city of
Solmar Bay. **Mara Voss** runs the garage and the jobs: six story missions
from stealing your first car to taking down Viktor Kroll at the Meridian
Tower. Between missions the city is yours — steal cars, lose the cops, find
the ten hidden cash stashes, and stay alive.

- **A living city**: a beach, a port, downtown towers, parks and parking
  lots; traffic that follows the roads and pedestrians on the sidewalks.
- **Wanted system**: crimes raise your heat from one to five stars; police
  cruisers chase you down the grid and officers on foot will arrest you.
- **Combat**: pistol with magazine and reload, gang shootouts, exploding
  cars, health and armor pickups.
- **HUD**: wanted stars, health and armor, money, mission objective with a
  timer, speed, ammo — and a live minimap with police and mission blips.
- **Sound**: fully synthesized engine, sirens, gunfire and a bass loop —
  no audio files.
- **Save**: progress (money, missions, stashes) saves in the browser.

## How it is built

Pure JavaScript and Canvas 2D — no libraries, no assets downloaded from
anywhere. Every line of code, every colour and every name is original;
nothing comes from Rockstar Games or any commercial game. The source is
split into one file per job (`city`, `world`, `player`, `vehicles`, `peds`,
`police`, `combat`, `missions`, `render`, `hud`, `audio`, `save`, `shots`).

Screenshots in `screenshots/` are real renders of the game's own code,
staged by `game/src/shots.js` with fixed seeds (`?shot=start|play|chase|mission&seed=1`).

## Enter

Built by an AI agent for [make.fun](https://make.fun)'s gta6-01 bounty.
