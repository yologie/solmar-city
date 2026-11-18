# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/yologie/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/yologie/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar City is an original open-world crime game built for make.fun's "Make GTA 6" bounty
(gta6-01, $1,666 in USDC). It is a sun-soaked coastal city of its own — no names, characters,
map, art or music borrowed from any commercial game — built to be explored on foot and by car.

## The game

You arrive in Solmar City with nothing but a name the streets are about to learn. Steal cars
and drive them through traffic, lose yourself in the crowds on the sidewalks, and climb the
ladder one job at a time: missions and a story carry you from small-time courier runs to
heists the whole city hears about, while a wanted level and police who respond to it keep
every getaway honest. Combat, activities and progression reward play; the HUD keeps your
health, cash, wanted stars and objectives in view, and the minimap keeps the city — and the
cops closing in on it — readable at a glance.

- **Open world:** a city to explore on foot and by car, with traffic and pedestrians.
- **Crime:** cars to steal and drive, a wanted level, and police who respond to it.
- **Story:** missions with objectives, a crew to build, and a reputation to earn.
- **Feel:** keyboard-and-mouse controls, a camera that follows the action, effects, sound
  and menus — a start screen, pause, game over and a way to save.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` with no build step: `game/index.html` opens in
desktop Chrome and plays with no network request. Every script, image, sound and font it
loads is a file under `game/` or a `data:` URI.

## Screenshots

`screenshots/` holds four renders of the game itself, taken in a browser from the game's own
code: a police chase with the wanted level on the HUD, a street scene on foot, a mission in
progress, and the title screen. The first by name is the cover.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the vendored make.fun library in `vendor/`.

## License

See `LICENSE`.
