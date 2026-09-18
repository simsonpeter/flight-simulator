# SKY STRIKE

Arcade 3D fighter-jet combat in the browser. Fly the **VX-9 RAPTOR**, switch cockpit and chase cameras, lock targets, and fight through five missions.

## Run locally

This project uses ES modules, so it needs a local web server:

```bash
cd sky-strike
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Pitch / roll | W S / A D | Left joystick |
| Yaw | Q E | — |
| Throttle | Shift / Ctrl or mouse wheel | Vertical THR slider |
| Air brake | Space | BRAKE |
| Afterburner | R | AB |
| Gun | Left mouse | FIRE |
| Missile (requires lock) | Right mouse | MISSILE |
| Next target | Tab | Auto-nearest / cycle on lock |
| Camera | V | CAMERA |
| Free look | F or middle mouse | LOOK (hold) |
| Pause | Esc | II |

## Missions

1. **First Flight** — take off and fly checkpoint rings  
2. **Air Patrol** — destroy three hostiles  
3. **Intercept** — stop inbound fighters  
4. **Dogfight** — survive waves  
5. **Boss** — bring down VX-OMEGA  

Progress, XP, unlocked aircraft, and settings are stored in `localStorage`.

## Deploy on Vercel

This repo is set up for Vercel. Leave **Framework Preset** on Other / no framework, and do **not** change the Root Directory (keep it the repository root).

The build copies `sky-strike/` into `public/`, so the game is served at `/`.

- **VX-9 RAPTOR** — balanced (starting jet)
- **VX-11 VIPER** — unlock at 1000 XP
- **VX-14 TITAN** — unlock at 2500 XP
