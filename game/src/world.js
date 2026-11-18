// Solmar City — the simulation. No drawing, no browser, no sound here:
// state in, fixed 1/60 s steps, events out. All randomness comes from the
// seeded RNG stored in the state, so the same seed replays identically.

import {
  AMMO_PACK, AMMO_PRICE, AVENUES, BEACH_Y, CAR_MAX_HP, CITY_H, CITY_W,
  GUN_PRICE, LANDMARKS, MISSIONS, PARK, PLAYER_MAX_HP, RACE_CHECKPOINTS,
  ROAD_W, SPRAY_PRICE, STREETS,
} from './config.js';
import { fnv1a, makeRng, rngChance, rngInt, rngPick, rngRange } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_SHOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_VICTORY = 32;
export const EVENT_PUNCH = 64;
export const EVENT_CRIME = 128;

const TRAFFIC_COLORS = ['#f2f2f2', '#ffd23f', '#7fd4ff', '#ff9d5c', '#c9f27a', '#e8a0c8', '#9fb2c8'];
const BUILDING_COLORS = ['#f2b8c6', '#ffd9a0', '#a8d8ea', '#d5b8e8', '#f7e6c4', '#b8e6c8'];
const PED_COLORS = ['#ff8a80', '#82b1ff', '#b9f6ca', '#ffcc80', '#ea80fc', '#80d8ff', '#ffd54f'];

const X_BANDS = [[0, 240], [360, 840], [960, 1440], [1560, 2040], [2160, 2600]];
const Y_BANDS = [[0, 240], [360, 640], [760, 1040], [1160, 1440]];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pointInRect(x, y, r, pad) {
  return x > r.x - r.w / 2 - pad && x < r.x + r.w / 2 + pad &&
    y > r.y - r.h / 2 - pad && y < r.y + r.h / 2 + pad;
}

// Is this point inside any solid building (used for movement collision)?
function hitsBuilding(world, x, y, pad) {
  for (const b of world.buildings) {
    if (pointInRect(x, y, b, pad)) return true;
  }
  return false;
}

// Nearest road centre line to a point, on the given axis.
function nearestRoad(list, v) {
  let best = list[0];
  for (const r of list) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed, rng, tick: 0,
    player: {
      x: 900, y: 1100, angle: -Math.PI / 2, hp: PLAYER_MAX_HP,
      cash: 0, inCar: null, hasPistol: false, ammo: 0,
      speed: 0, punchCd: 0, shootCd: 0, hurtCd: 0, regenWait: 0,
    },
    cars: [], peds: [], cops: [], bullets: [], pickups: [],
    buildings: [], trees: [], palms: [],
    wanted: 0, crimeTimer: 0, crimeGrace: 0, decayTimer: 0,
    dangerTimer: 0, pinTimer: 0, grabTimer: 0,
    missionIndex: 0, mission: null,
    message: '', messageTimer: 0, prompt: '',
    busted: false, wasted: false, victory: false,
    camera: { x: 900, y: 1100 },
    bestCash: 0,
  };

  // ---- Buildings -------------------------------------------------------
  const landmarkRects = [];
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (key === 'docks' || key === 'plaza') continue;
    landmarkRects.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, color: lm.color, name: lm.name });
  }
  for (const bandY of Y_BANDS) {
    for (const bandX of X_BANDS) {
      const cx = (bandX[0] + bandX[1]) / 2;
      const cy = (bandY[0] + bandY[1]) / 2;
      const isPark = bandX[0] === 960 && bandY[0] === 760;
      if (isPark) continue;
      const lmHere = landmarkRects.find((r) => r.x > bandX[0] && r.x < bandX[1] && r.y > bandY[0] && r.y < bandY[1]);
      if (lmHere) {
        world.buildings.push(lmHere);
        // A couple of small neighbours fill the rest of a landmark block.
        for (let i = 0; i < 2; i++) {
          const bx = rngRange(rng, bandX[0] + 70, bandX[1] - 70);
          const by = rngRange(rng, bandY[0] + 60, bandY[1] - 60);
          if (dist(bx, by, lmHere.x, lmHere.y) < 190) continue;
          world.buildings.push({
            x: bx, y: by, w: rngRange(rng, 90, 140), h: rngRange(rng, 70, 110),
            color: rngPick(rng, BUILDING_COLORS), name: '',
          });
        }
        continue;
      }
      // Ordinary block: two pastel buildings.
      for (let i = 0; i < 2; i++) {
        const bx = bandX[0] + 90 + i * ((bandX[1] - bandX[0]) / 2) + rngRange(rng, -20, 20);
        const by = cy + rngRange(rng, -50, 50);
        world.buildings.push({
          x: clamp(bx, bandX[0] + 70, bandX[1] - 70),
          y: clamp(by, bandY[0] + 60, bandY[1] - 60),
          w: rngRange(rng, 110, 190), h: rngRange(rng, 80, 130),
          color: rngPick(rng, BUILDING_COLORS), name: '',
        });
      }
    }
  }

  // ---- Greenery --------------------------------------------------------
  for (let i = 0; i < 14; i++) {
    world.trees.push({
      x: rngRange(rng, PARK.x - PARK.w / 2 + 20, PARK.x + PARK.w / 2 - 20),
      y: rngRange(rng, PARK.y - PARK.h / 2 + 20, PARK.y + PARK.h / 2 - 20),
    });
  }
  for (let i = 0; i < 12; i++) {
    world.palms.push({ x: 80 + i * 210 + rngRange(rng, -30, 30), y: BEACH_Y + 28 });
  }

  // ---- Traffic + parked cars -------------------------------------------
  let carId = 1;
  function spawnCar(kind, x, y, angle, color) {
    const car = {
      id: carId++, kind, x, y, angle, speed: 0, hp: CAR_MAX_HP,
      color, axis: 'v', road: 0, dir: 1, lane: 28, driver: null,
      stuckTimer: 0, reverseTimer: 0, hitCd: 0, smoke: false,
    };
    world.cars.push(car);
    return car;
  }
  for (let i = 0; i < 14; i++) {
    const vertical = rngChance(rng, 0.5);
    const road = rngPick(rng, vertical ? AVENUES : STREETS);
    const along = rngRange(rng, 120, vertical ? CITY_H - 220 : CITY_W - 120);
    const dir = rngChance(rng, 0.5) ? 1 : -1;
    const lane = dir > 0 ? 28 : -28;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawnCar('traffic', vertical ? road + lane : along, vertical ? along : road + lane, angle, rngPick(rng, TRAFFIC_COLORS));
    car.axis = vertical ? 'v' : 'h';
    car.road = road;
    car.dir = dir;
    car.lane = lane;
    car.speed = rngRange(rng, 55, 85);
  }
  // Parked cars along the kerb, free for the taking.
  const parkedSpots = [
    { x: 928, y: 420 }, { x: 872, y: 820 }, { x: 1528, y: 420 },
    { x: 328, y: 1120 }, { x: 2128, y: 820 }, { x: 1528, y: 1320 },
  ];
  for (const s of parkedSpots) {
    const car = spawnCar('parked', s.x, s.y, rngChance(rng, 0.5) ? 0 : Math.PI, rngPick(rng, TRAFFIC_COLORS));
    car.axis = 'h';
    car.road = nearestRoad(STREETS, s.y);
    car.dir = 1;
  }

  // ---- Pedestrians ------------------------------------------------------
  for (let i = 0; i < 18; i++) {
    const vertical = rngChance(rng, 0.5);
    const road = rngPick(rng, vertical ? AVENUES : STREETS);
    const along = rngRange(rng, 120, vertical ? CITY_H - 220 : CITY_W - 120);
    const side = rngChance(rng, 0.5) ? 1 : -1;
    world.peds.push({
      x: vertical ? road + side * (ROAD_W / 2 + 14) : along,
      y: vertical ? along : road + side * (ROAD_W / 2 + 14),
      angle: rngRange(rng, -Math.PI, Math.PI),
      speed: rngRange(rng, 28, 48),
      state: 'walk', fleeTimer: 0, downTimer: 0,
      color: rngPick(rng, PED_COLORS),
    });
  }

  // ---- Cash pickups -----------------------------------------------------
  for (let i = 0; i < 12; i++) {
    const vertical = rngChance(rng, 0.5);
    const road = rngPick(rng, vertical ? AVENUES : STREETS);
    const along = rngRange(rng, 150, vertical ? CITY_H - 250 : CITY_W - 150);
    const side = rngChance(rng, 0.5) ? 1 : -1;
    world.pickups.push({
      x: vertical ? road + side * (ROAD_W / 2 + 14) : along,
      y: vertical ? along : road + side * (ROAD_W / 2 + 14),
      amount: rngChance(rng, 0.4) ? 50 : 25, taken: false,
    });
  }

  startMission(world, 0);
  return world;
}

// ---- Missions -----------------------------------------------------------

export function missionTarget(world) {
  // Screenshot scenes may pin the marker to a staged spot.
  if (world.markerOverride) return world.markerOverride;
  const m = world.mission;
  if (!m) return null;
  if (m.index === 0) return m.stage === 'deliver' ? LANDMARKS.garage.door : null;
  if (m.index === 1) return m.stage === 'pickup' ? LANDMARKS.docks.door : LANDMARKS.plaza.door;
  if (m.index === 2) return LANDMARKS.safehouse.door;
  if (m.index === 3) return RACE_CHECKPOINTS[Math.min(m.cpIndex, RACE_CHECKPOINTS.length - 1)];
  if (m.index === 4) return m.stage === 'grab' ? LANDMARKS.bank.door : LANDMARKS.garage.door;
  return null;
}

export function missionObjective(world) {
  const m = world.mission;
  if (!m) return '';
  return MISSIONS[m.index].objective;
}

export function startMission(world, index) {
  const def = MISSIONS[index];
  const m = {
    index, stage: 'start', timer: def.timeLimit || 0,
    cpIndex: 0, rival: null, grabProgress: 0, hasPackage: false,
  };
  world.mission = m;
  if (index === 0) m.stage = 'steal';
  if (index === 1) m.stage = 'pickup';
  if (index === 2) {
    m.stage = 'escape';
    world.wanted = 3;
    world.crimeTimer = 0;
  }
  if (index === 3) {
    m.stage = 'race';
    // Rival Rico starts at the first checkpoint in a red coupe.
    const rival = {
      id: 900, kind: 'rival', x: RACE_CHECKPOINTS[0].x, y: RACE_CHECKPOINTS[0].y,
      angle: 0, speed: 0, hp: CAR_MAX_HP, color: '#ff3b30',
      axis: 'h', road: 300, dir: 1, lane: 0, driver: 'ai',
      stuckTimer: 0, reverseTimer: 0, hitCd: 0, smoke: false,
      waypoints: raceWaypoints(), wpIndex: 0, cpIndex: 0,
    };
    m.rival = rival;
    world.cars.push(rival);
  }
  if (index === 4) m.stage = 'grab';
  setMessage(world, def.intro);
}

// Grid waypoints through the race checkpoints: L-shaped moves along roads.
function raceWaypoints() {
  const pts = [{ x: RACE_CHECKPOINTS[0].x, y: RACE_CHECKPOINTS[0].y }];
  for (let i = 1; i < RACE_CHECKPOINTS.length; i++) {
    const prev = RACE_CHECKPOINTS[i - 1];
    const cur = RACE_CHECKPOINTS[i];
    if (prev.x !== cur.x && prev.y !== cur.y) {
      pts.push({ x: cur.x, y: prev.y });
    }
    pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}

function completeMission(world) {
  const def = MISSIONS[world.mission.index];
  world.player.cash += def.reward;
  world.bestCash = Math.max(world.bestCash, world.player.cash);
  setMessage(world, `${def.name} complete! +$${def.reward}`);
  const doneIndex = world.mission.index;
  if (world.mission.rival) {
    world.cars = world.cars.filter((c) => c !== world.mission.rival);
  }
  world.mission = null;
  if (doneIndex >= MISSIONS.length - 1) {
    world.victory = true;
    return EVENT_MISSION | EVENT_VICTORY;
  }
  startMission(world, doneIndex + 1);
  return EVENT_MISSION;
}

function failMission(world, reason) {
  const idx = world.mission.index;
  if (world.mission.rival) {
    world.cars = world.cars.filter((c) => c !== world.mission.rival);
  }
  setMessage(world, reason);
  startMission(world, idx);
}

function setMessage(world, msg) {
  world.message = msg;
  world.messageTimer = 4;
}

// ---- Wanted -------------------------------------------------------------

function addCrime(world, n) {
  if (world.crimeGrace > 0) return 0;
  world.wanted = Math.min(5, world.wanted + n);
  world.crimeTimer = 0;
  world.decayTimer = 0;
  world.crimeGrace = 2;
  return EVENT_CRIME;
}

// ---- Main step ----------------------------------------------------------

export function stepWorld(world, input, dt) {
  if (world.busted || world.wasted || world.victory) return EVENT_NONE;
  let events = 0;
  world.tick += 1;
  const p = world.player;
  const axes = input.moveAxes();

  if (world.crimeGrace > 0) world.crimeGrace -= dt;
  if (world.dangerTimer > 0) world.dangerTimer -= dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.regenWait > 0) p.regenWait -= dt;
  // Health regenerates slowly, but only while the player is still alive.
  if (p.hp > 0 && p.hp < PLAYER_MAX_HP && p.regenWait <= 0) {
    p.hp = Math.min(PLAYER_MAX_HP, p.hp + 4 * dt);
  }

  // Wanted decay: after 15 s with no new crime, lose a star every 8 s.
  world.crimeTimer += dt;
  if (world.wanted > 0 && world.crimeTimer > 15) {
    world.decayTimer += dt;
    if (world.decayTimer >= 8) {
      world.decayTimer = 0;
      world.wanted -= 1;
    }
  }

  // ---- Player -----------------------------------------------------------
  const car = p.inCar;
  if (car) {
    events |= stepDriving(world, input, axes, dt);
  } else {
    events |= stepOnFoot(world, input, axes, dt);
  }

  // ---- Traffic, police, pedestrians, bullets, missions ------------------
  stepTraffic(world, dt);
  events |= stepPolice(world, dt);
  stepPeds(world, dt);
  events |= stepBullets(world, dt);
  events |= stepMissions(world, dt);
  stepPickups(world);

  // ---- Camera -----------------------------------------------------------
  const focus = car || p;
  world.camera.x = clamp(focus.x, 640, CITY_W - 640);
  world.camera.y = clamp(focus.y, 360, CITY_H - 360);

  if (world.busted) events |= EVENT_BUSTED;
  if (world.wasted) events |= EVENT_WASTED;
  return events;
}

function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.hurtCd > 0 || p.hp <= 0) return;
  p.hp -= amount;
  p.hurtCd = 0.5;
  p.regenWait = 6;
  if (p.hp <= 0) {
    p.hp = 0;
    world.wasted = true;
  }
}

function stepOnFoot(world, input, axes, dt) {
  let events = 0;
  const p = world.player;
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = running ? 250 : 145;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
    moveWithCollision(world, p, mx * speed * dt, my * speed * dt, 10);
  } else {
    p.speed = 0;
  }

  // Punch.
  if ((input.wasPressed('Space')) && p.punchCd <= 0) {
    p.punchCd = 0.4;
    events |= EVENT_PUNCH;
    const hx = p.x + Math.cos(p.angle) * 30;
    const hy = p.y + Math.sin(p.angle) * 30;
    for (const ped of world.peds) {
      if (ped.downTimer <= 0 && dist(hx, hy, ped.x, ped.y) < 26) {
        ped.downTimer = 2;
        ped.state = 'flee';
        ped.fleeTimer = 2;
      }
    }
    for (const cop of world.cops) {
      if (cop.downTimer <= 0 && dist(hx, hy, cop.x, cop.y) < 26) {
        cop.downTimer = 3;
      }
    }
  }

  // Shoot (F key or mouse click), aiming at the mouse when clicked.
  const wantShoot = input.wasPressed('KeyF') || input.mouse.clicked;
  if (wantShoot && p.hasPistol && p.ammo > 0 && p.shootCd <= 0) {
    p.shootCd = 0.28;
    p.ammo -= 1;
    let ang = p.angle;
    if (input.mouse.clicked) {
      const wx = world.camera.x - 640 + input.mouse.x;
      const wy = world.camera.y - 360 + input.mouse.y;
      ang = angleTo(p.x, p.y, wx, wy);
      p.angle = ang;
    }
    world.bullets.push({
      x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22,
      vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720, life: 0.8,
    });
    world.dangerTimer = 1.5;
    events |= EVENT_SHOT;
    events |= addCrime(world, 1);
  }

  // Interact: E — enter a car, use a shop, pick up / deliver handled by missions.
  if (input.wasPressed('KeyE')) {
    events |= interactOnFoot(world);
  }
  return events;
}

function moveWithCollision(world, ent, dx, dy, pad) {
  const nx = clamp(ent.x + dx, 20, CITY_W - 20);
  if (!hitsBuilding(world, nx, ent.y, pad)) ent.x = nx;
  const ny = clamp(ent.y + dy, 20, 1690);
  if (!hitsBuilding(world, ent.x, ny, pad)) ent.y = ny;
}

function nearestCar(world, x, y, maxDist, kinds) {
  let best = null;
  let bestD = maxDist;
  for (const c of world.cars) {
    if (kinds && !kinds.includes(c.kind)) continue;
    if (c.driver === 'player') continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function interactOnFoot(world) {
  const p = world.player;
  // Gun shop.
  if (dist(p.x, p.y, LANDMARKS.gunshop.door.x, LANDMARKS.gunshop.door.y) < 90) {
    if (!p.hasPistol) {
      if (p.cash >= GUN_PRICE) {
        p.cash -= GUN_PRICE;
        p.hasPistol = true;
        p.ammo = AMMO_PACK;
        setMessage(world, 'Pistol bought. F or click to shoot.');
        return EVENT_PICKUP;
      }
      setMessage(world, `Pistol costs $${GUN_PRICE}. You have $${p.cash}.`);
      return EVENT_NONE;
    }
    if (p.cash >= AMMO_PRICE) {
      p.cash -= AMMO_PRICE;
      p.ammo += AMMO_PACK;
      setMessage(world, `Ammo +${AMMO_PACK}.`);
      return EVENT_PICKUP;
    }
    setMessage(world, `Ammo costs $${AMMO_PRICE}. You have $${p.cash}.`);
    return EVENT_NONE;
  }
  // Enter the nearest stealable car.
  const car = nearestCar(world, p.x, p.y, 55, ['traffic', 'parked']);
  if (car) {
    let events = 0;
    const witness = world.peds.some((pd) => pd.downTimer <= 0 && dist(p.x, p.y, pd.x, pd.y) < 300) ||
      world.cops.some((cp) => cp.downTimer <= 0 && dist(p.x, p.y, cp.x, cp.y) < 300);
    p.inCar = car;
    car.driver = 'player';
    car.kind = 'traffic';
    if (witness) {
      events |= addCrime(world, 1);
      setMessage(world, 'A witness saw you steal that car!');
    }
    if (world.mission && world.mission.index === 0 && world.mission.stage === 'steal') {
      world.mission.stage = 'deliver';
      setMessage(world, 'Now deliver it to Dahlia\'s Garage.');
    }
    return events;
  }
  return EVENT_NONE;
}

function stepDriving(world, input, axes, dt) {
  let events = 0;
  const p = world.player;
  const car = p.inCar;
  const maxSpeed = 300;
  const accel = 260;
  // W accelerate, S brake / reverse, A D steer, Space handbrake.
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
    car.speed = Math.min(maxSpeed, car.speed + accel * dt);
  } else if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
    if (car.speed > 5) car.speed = Math.max(0, car.speed - 380 * dt);
    else car.speed = Math.max(-90, car.speed - 140 * dt);
  } else {
    car.speed -= car.speed * 0.6 * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  if (input.isDown('Space')) {
    car.speed -= car.speed * 4 * dt;
  }
  const steer = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? -1 : 0) +
    (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 1) {
    car.angle += steer * 2.1 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  }
  const px = car.x;
  const py = car.y;
  car.x = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 20, CITY_W - 20);
  car.y = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 20, 1690);
  if (hitsBuilding(world, car.x, car.y, 12)) {
    car.x = px;
    car.y = py;
    car.speed *= -0.25;
    if (Math.abs(car.speed) > 60) {
      car.hp -= 4;
      if (car.hp <= 0) {
        car.hp = 0;
        car.smoke = true;
      }
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  car.smoke = car.hp < 35;

  // Hit a pedestrian with the car.
  for (const ped of world.peds) {
    if (ped.downTimer > 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 20) {
      ped.downTimer = 3;
      ped.state = 'flee';
      ped.fleeTimer = 3;
      events |= addCrime(world, 1);
      setMessage(world, 'You hit a pedestrian!');
      car.speed *= 0.7;
    }
  }

  // Shoot from the car (F or click, aims forward / at the mouse).
  const wantShoot = input.wasPressed('KeyF') || input.mouse.clicked;
  if (wantShoot && p.hasPistol && p.ammo > 0 && p.shootCd <= 0) {
    p.shootCd = 0.28;
    p.ammo -= 1;
    let ang = car.angle;
    if (input.mouse.clicked) {
      const wx = world.camera.x - 640 + input.mouse.x;
      const wy = world.camera.y - 360 + input.mouse.y;
      ang = angleTo(car.x, car.y, wx, wy);
    }
    world.bullets.push({
      x: car.x + Math.cos(ang) * 26, y: car.y + Math.sin(ang) * 26,
      vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720, life: 0.8,
    });
    world.dangerTimer = 1.5;
    events |= EVENT_SHOT;
    events |= addCrime(world, 1);
  }

  // E: exit the car (only when nearly stopped), or use Pay 'n Spray.
  if (input.wasPressed('KeyE')) {
    if (dist(car.x, car.y, LANDMARKS.paynspray.door.x, LANDMARKS.paynspray.door.y) < 100 &&
      world.wanted > 0 && p.cash >= SPRAY_PRICE) {
      p.cash -= SPRAY_PRICE;
      world.wanted = 0;
      world.crimeTimer = 0;
      setMessage(world, 'Fresh paint. The cops lost you.');
      return events | EVENT_PICKUP;
    }
    if (Math.abs(car.speed) < 30) {
      const side = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(side) * 30;
      p.y = car.y + Math.sin(side) * 30;
      if (hitsBuilding(world, p.x, p.y, 10)) {
        p.x = car.x - Math.cos(side) * 30;
        p.y = car.y - Math.sin(side) * 30;
      }
      p.inCar = null;
      car.driver = null;
      car.kind = 'parked';
      car.speed = 0;
    }
  }
  return events;
}

// ---- Traffic ------------------------------------------------------------

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.driver === 'player' || car.kind === 'police' || car.kind === 'rival' || car.kind === 'parked') continue;
    if (car.hitCd > 0) car.hitCd -= dt;
    // Slow down for a car ahead in the same lane.
    let targetSpeed = car.speed;
    for (const other of world.cars) {
      if (other === car || other.kind === 'parked') continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) targetSpeed = Math.min(targetSpeed, 20);
      }
    }
    car.speed += (targetSpeed - car.speed) * 0.5 * dt;
    if (car.speed < 40) car.speed = 40;
    // Turn at intersections sometimes, staying on the road grid.
    const onV = car.axis === 'v';
    const cross = onV ? STREETS : AVENUES;
    for (const c of cross) {
      const along = onV ? car.y : car.x;
      if (Math.abs(along - c) < 6 && rngChance(world.rng, 0.22)) {
        const newRoad = c;
        const newDir = rngChance(world.rng, 0.5) ? 1 : -1;
        car.axis = onV ? 'h' : 'v';
        car.road = newRoad;
        car.dir = newDir;
        car.lane = newDir > 0 ? 28 : -28;
        car.angle = car.axis === 'v'
          ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (newDir > 0 ? 0 : Math.PI);
        break;
      }
    }
    const lanePos = car.road + car.lane;
    if (car.axis === 'v') {
      car.x += (lanePos - car.x) * 2 * dt;
      car.y += car.dir * car.speed * dt;
      if (car.y < 100) { car.y = 100; car.dir = 1; car.angle = Math.PI / 2; car.lane = 28; }
      if (car.y > CITY_H - 240) { car.y = CITY_H - 240; car.dir = -1; car.angle = -Math.PI / 2; car.lane = -28; }
    } else {
      car.y += (lanePos - car.y) * 2 * dt;
      car.x += car.dir * car.speed * dt;
      if (car.x < 100) { car.x = 100; car.dir = 1; car.angle = 0; car.lane = 28; }
      if (car.x > CITY_W - 100) { car.x = CITY_W - 100; car.dir = -1; car.angle = Math.PI; car.lane = -28; }
    }
  }
}

// ---- Police ---------------------------------------------------------------

function spawnPoliceCar(world) {
  const p = world.player;
  const vertical = rngChance(world.rng, 0.5);
  const road = rngPick(world.rng, vertical ? AVENUES : STREETS);
  const along = rngRange(world.rng, 150, vertical ? CITY_H - 250 : CITY_W - 150);
  const x = vertical ? road : along;
  const y = vertical ? along : road;
  if (dist(x, y, p.x, p.y) < 420) return null;
  const car = {
    id: 700 + world.cars.length, kind: 'police', x, y,
    angle: angleTo(x, y, p.x, p.y), speed: 0, hp: CAR_MAX_HP,
    color: '#2f6df6', axis: vertical ? 'v' : 'h', road, dir: 1, lane: 0,
    driver: 'ai', stuckTimer: 0, reverseTimer: 0, hitCd: 0, smoke: false,
  };
  world.cars.push(car);
  return car;
}

function stepPolice(world, dt) {
  let events = 0;
  const p = world.player;
  const wanted = world.wanted;

  // Maintain the force: one police car per star (cap 4), foot cops from 2 stars.
  const policeCars = world.cars.filter((c) => c.kind === 'police');
  const wantCars = Math.min(4, wanted);
  if (policeCars.length < wantCars && wanted > 0) {
    spawnPoliceCar(world);
  }
  const wantFoot = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
  if (world.cops.length < wantFoot && wanted > 0) {
    const road = rngPick(world.rng, AVENUES);
    const along = rngRange(world.rng, 200, CITY_H - 300);
    const cx = road + 70;
    const cy = along;
    if (dist(cx, cy, p.x, p.y) > 300) {
      world.cops.push({ x: cx, y: cy, angle: 0, downTimer: 0, speed: 150 });
    }
  }
  // Stand down when the heat is off.
  if (wanted === 0) {
    world.cops = world.cops.filter((c) => dist(c.x, c.y, p.x, p.y) < 200);
    world.cars = world.cars.filter((c) => c.kind !== 'police' || dist(c.x, c.y, p.x, p.y) < 700);
    world.pinTimer = 0;
    world.grabTimer = 0;
  }

  // Police cars hunt the player and ram.
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    if (car.hitCd > 0) car.hitCd -= dt;
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    const diff = angleDiff(car.angle, targetAngle);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const topSpeed = 190 + wanted * 25;
    car.speed += ((topSpeed - car.speed) * 0.8 * dt);
    const px = car.x;
    const py = car.y;
    car.x = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 20, CITY_W - 20);
    car.y = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 20, 1690);
    if (hitsBuilding(world, car.x, car.y, 12)) {
      car.x = px;
      car.y = py;
      car.angle += 0.6;
      car.speed *= 0.5;
    }
    // Ram the player.
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 34) {
      const playerMoving = p.inCar ? Math.abs(p.inCar.speed) > 40 : p.speed > 40;
      if (playerMoving && car.hitCd <= 0) {
        car.hitCd = 1;
        events |= addCrime(world, 1);
      }
      if (car.speed > 60) {
        hurtPlayer(world, 6);
        if (p.inCar) {
          p.inCar.hp = Math.max(0, p.inCar.hp - 6);
          p.inCar.smoke = p.inCar.hp < 35;
        }
      }
      // Pinned: police car holding a stopped player car.
      if (p.inCar && Math.abs(p.inCar.speed) < 15) {
        world.pinTimer += dt;
        if (world.pinTimer >= 2) world.busted = true;
      } else {
        world.pinTimer = Math.max(0, world.pinTimer - dt);
      }
      // Push the police car off slightly so it does not sit inside the player.
      const push = angleTo(p.x, p.y, car.x, car.y);
      car.x += Math.cos(push) * 6;
      car.y += Math.sin(push) * 6;
    } else {
      world.pinTimer = Math.max(0, world.pinTimer - dt);
    }
  }

  // Foot cops chase and grab.
  let anyGrab = false;
  for (const cop of world.cops) {
    if (cop.downTimer > 0) {
      cop.downTimer -= dt;
      continue;
    }
    const d = dist(cop.x, cop.y, p.x, p.y);
    const ang = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = ang;
    const speed = 150 + wanted * 10;
    if (!p.inCar && d > 20) {
      moveWithCollision(world, cop, Math.cos(ang) * speed * dt, Math.sin(ang) * speed * dt, 8);
    } else if (p.inCar && d > 40) {
      moveWithCollision(world, cop, Math.cos(ang) * speed * dt, Math.sin(ang) * speed * dt, 8);
    }
    if (!p.inCar && d < 22) {
      anyGrab = true;
    }
  }
  if (anyGrab) {
    world.grabTimer += dt;
    if (world.grabTimer >= 1.2) world.busted = true;
  } else {
    world.grabTimer = Math.max(0, world.grabTimer - dt);
  }
  return events;
}

// ---- Pedestrians ------------------------------------------------------------

function stepPeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    if (ped.downTimer > 0) {
      ped.downTimer -= dt;
      continue;
    }
    if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    const dangerNear = world.dangerTimer > 0 && dist(ped.x, ped.y, p.x, p.y) < 260;
    const carNear = p.inCar && Math.abs(p.inCar.speed) > 120 && dist(ped.x, ped.y, p.x, p.y) < 130;
    if ((dangerNear || carNear) && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 2;
    }
    if (ped.state === 'flee') {
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      moveWithCollision(world, ped, Math.cos(away) * 200 * dt, Math.sin(away) * 200 * dt, 8);
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      continue;
    }
    // Stroll along the sidewalk; turn at intersections sometimes.
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = clamp(ped.x, 30, CITY_W - 30);
    ped.y = clamp(ped.y, 30, 1690);
    if (hitsBuilding(world, ped.x, ped.y, 6)) {
      ped.angle += Math.PI / 2;
    }
    const nearV = AVENUES.some((r) => Math.abs(ped.x - r) < ROAD_W / 2 + 16);
    const nearH = STREETS.some((r) => Math.abs(ped.y - r) < ROAD_W / 2 + 16);
    if ((nearV || nearH) && rngChance(world.rng, 0.004)) {
      ped.angle += rngChance(world.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
  }
}

// ---- Bullets -----------------------------------------------------------------

function stepBullets(world, dt) {
  let events = 0;
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitsBuilding(world, b.x, b.y, 0)) b.life = 0;
    for (const ped of world.peds) {
      if (ped.downTimer <= 0 && dist(b.x, b.y, ped.x, ped.y) < 14) {
        ped.downTimer = 3;
        ped.state = 'flee';
        ped.fleeTimer = 3;
        b.life = 0;
        events |= addCrime(world, 1);
      }
    }
    for (const cop of world.cops) {
      if (cop.downTimer <= 0 && dist(b.x, b.y, cop.x, cop.y) < 14) {
        cop.downTimer = 3;
        b.life = 0;
      }
    }
    for (const car of world.cars) {
      if (car.driver === 'player') continue;
      if (dist(b.x, b.y, car.x, car.y) < 20) {
        car.hp = Math.max(0, car.hp - 15);
        car.smoke = car.hp < 35;
        b.life = 0;
        if (car.kind === 'police') events |= addCrime(world, 1);
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  return events;
}

// ---- Missions ------------------------------------------------------------------

function stepMissions(world, dt) {
  const m = world.mission;
  if (!m) return EVENT_NONE;
  const p = world.player;
  let events = 0;

  if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(world, 'Package Run failed — out of time. Dahlia gives you another shot.');
      return events;
    }
    if (m.stage === 'pickup' && dist(p.x, p.y, LANDMARKS.docks.door.x, LANDMARKS.docks.door.y) < 70) {
      m.stage = 'deliver';
      m.hasPackage = true;
      setMessage(world, 'Package grabbed. Get it to the plaza!');
    } else if (m.stage === 'deliver' && dist(p.x, p.y, LANDMARKS.plaza.door.x, LANDMARKS.plaza.door.y) < 80) {
      events |= completeMission(world);
    }
    return events;
  }

  if (m.index === 0) {
    if (m.stage === 'deliver' && p.inCar &&
      dist(p.x, p.y, LANDMARKS.garage.door.x, LANDMARKS.garage.door.y) < 95) {
      events |= completeMission(world);
    }
    return events;
  }

  if (m.index === 2) {
    if (dist(p.x, p.y, LANDMARKS.safehouse.door.x, LANDMARKS.safehouse.door.y) < 85 && world.wanted > 0) {
      world.wanted = 0;
      world.crimeTimer = 0;
      events |= completeMission(world);
    }
    return events;
  }

  if (m.index === 3) {
    const cp = RACE_CHECKPOINTS[m.cpIndex];
    if (cp && dist(p.x, p.y, cp.x, cp.y) < 75) {
      m.cpIndex += 1;
      if (m.cpIndex >= RACE_CHECKPOINTS.length) {
        events |= completeMission(world);
        return events;
      }
      setMessage(world, `Checkpoint ${m.cpIndex + 1} of 5!`);
    }
    // Rival Rico drives the checkpoints on the road grid.
    const rival = m.rival;
    if (rival) {
      const wp = rival.waypoints[rival.wpIndex];
      if (wp) {
        const ang = angleTo(rival.x, rival.y, wp.x, wp.y);
        rival.angle = ang;
        rival.speed = 165;
        rival.x += Math.cos(ang) * rival.speed * dt;
        rival.y += Math.sin(ang) * rival.speed * dt;
        if (dist(rival.x, rival.y, wp.x, wp.y) < 24) {
          rival.wpIndex += 1;
          if (rival.wpIndex >= rival.waypoints.length) {
            failMission(world, 'Rico beat you to the finish. Race him again!');
            return events;
          }
        }
      }
    }
    return events;
  }

  if (m.index === 4) {
    if (m.stage === 'grab') {
      if (dist(p.x, p.y, LANDMARKS.bank.door.x, LANDMARKS.bank.door.y) < 95) {
        m.grabProgress += dt;
        if (m.grabProgress >= 5) {
          m.stage = 'escape';
          world.wanted = 4;
          world.crimeTimer = 0;
          setMessage(world, 'Score grabbed! Get it to the garage — the whole city is coming.');
        }
      } else {
        m.grabProgress = Math.max(0, m.grabProgress - dt);
      }
    } else if (dist(p.x, p.y, LANDMARKS.garage.door.x, LANDMARKS.garage.door.y) < 95) {
      events |= completeMission(world);
    }
    return events;
  }
  return events;
}

function stepPickups(world) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 28) {
      pk.taken = true;
      p.cash += pk.amount;
      world.bestCash = Math.max(world.bestCash, p.cash);
      setMessage(world, `Found $${pk.amount} on the street.`);
    }
  }
}

// ---- Determinism hash -------------------------------------------------------

export function stateHash(world) {
  const p = world.player;
  const parts = [
    world.tick, world.rng.s, Math.round(p.x * 100), Math.round(p.y * 100),
    Math.round(p.hp * 10), p.cash, p.ammo, world.wanted,
    world.mission ? world.mission.index : -1,
    world.mission ? world.mission.stage : '',
    world.mission ? Math.round((world.mission.timer || 0) * 100) : 0,
    world.cars.length,
    ...world.cars.map((c) => [Math.round(c.x), Math.round(c.y), Math.round(c.speed), Math.round(c.hp)].join(',')),
    ...world.peds.map((pd) => [Math.round(pd.x), Math.round(pd.y), Math.round(pd.downTimer * 100)].join(',')),
    ...world.cops.map((c) => [Math.round(c.x), Math.round(c.y)].join(',')),
  ];
  return fnv1a(parts.join('|'));
}
