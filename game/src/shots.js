// Solmar City — deterministic screenshot scenes behind ?shot=chase|street|
// mission|title. Each scene is built from a fresh seeded world, so the same
// seed always gives the same frame. The chase scene is staged directly
// (cars placed in formation) so it always ends mid-pursuit, never pinned.
// The mission scene is driven there by the road-following autopilot below.

import { createWorld, missionTarget, stepWorld } from './world.js';
import { scriptedInput } from './input.js';
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// ---- Road-following autopilot -------------------------------------------
// Steers a player-driven car along grid waypoints: accelerates on straights,
// brakes for turns, and reverses out if it gets stuck. Never cuts across
// blocks — every leg runs along an avenue or a street.

export function makeAutopilot(waypoints) {
  return {
    waypoints, wpIndex: 0,
    stuckTimer: 0, reverseTimer: 0,
    lastX: 0, lastY: 0, progress: 0,
  };
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function autopilotInput(pilot, world, input) {
  const car = world.player.inCar;
  if (!car) return;
  const wp = pilot.waypoints[pilot.wpIndex];
  if (!wp) {
    input.down.clear();
    return;
  }
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) {
    pilot.wpIndex += 1;
    pilot.stuckTimer = 0;
    return;
  }
  // Stuck detection: barely moving while trying to drive.
  const moved = Math.hypot(car.x - pilot.lastX, car.y - pilot.lastY);
  pilot.progress += moved;
  pilot.lastX = car.x;
  pilot.lastY = car.y;
  if (pilot.reverseTimer > 0) {
    pilot.reverseTimer -= 1;
    input.down.clear();
    input.down.add('KeyS');
    const diff = angleDiff(car.angle, Math.atan2(dy, dx));
    input.down.add(diff > 0 ? 'KeyA' : 'KeyD');
    return;
  }
  if (moved < 0.15 && Math.abs(car.speed) < 25) {
    pilot.stuckTimer += 1;
    if (pilot.stuckTimer > 120) {
      pilot.stuckTimer = 0;
      pilot.reverseTimer = 60;
      return;
    }
  } else {
    pilot.stuckTimer = 0;
  }
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  input.down.clear();
  // Brake for a sharp turn while still moving fast.
  if (Math.abs(diff) > 0.9 && Math.abs(car.speed) > 90) {
    input.down.add('KeyS');
  } else {
    input.down.add('KeyW');
  }
  if (diff > 0.12) input.down.add('KeyD');
  else if (diff < -0.12) input.down.add('KeyA');
}

// ---- Scenes ---------------------------------------------------------------

function putPlayerInCar(world, x, y, angle, speed) {
  const car = world.cars.find((c) => c.kind === 'traffic' && !c.driver) || world.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.driver = 'player';
  car.kind = 'traffic';
  world.player.inCar = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

function stageChase(seed) {
  const world = createWorld(seed);
  world.wanted = 3;
  world.crimeTimer = 0;
  world.player.cash = 120;
  world.mission.stage = 'deliver';
  world.message = '';
  world.messageTimer = 0;
  // Player speeding north up avenue 1500, mid-pursuit.
  const car = putPlayerInCar(world, 1500, 1100, -Math.PI / 2, 260);
  car.hp = 100;
  car.color = '#ffd23f';
  // Three police cars in pursuit formation behind the player.
  const formation = [
    { x: 1472, y: 1190 },
    { x: 1500, y: 1240 },
    { x: 1528, y: 1190 },
  ];
  formation.forEach((spot) => {
    const pc = {
      id: 700 + world.cars.length, kind: 'police', x: spot.x, y: spot.y,
      angle: -Math.PI / 2, speed: 240, hp: 100, color: '#2f6df6',
      axis: 'v', road: 1500, dir: -1, lane: 0, driver: 'ai',
      stuckTimer: 0, reverseTimer: 0, hitCd: 0, smoke: false,
    };
    world.cars.push(pc);
  });
  world.camera.x = 1500;
  world.camera.y = 1100;
  return { world, screen: SCREEN_PLAY, save: { bestCash: 120, missionIndex: 0 } };
}

function stageStreet(seed) {
  const world = createWorld(seed);
  const p = world.player;
  p.x = 900;
  p.y = 700;
  p.angle = 0;
  // A car parked right beside Milo, ringed by the mission marker.
  const car = world.cars.find((c) => c.kind === 'parked');
  car.x = 948;
  car.y = 700;
  car.angle = 0;
  car.color = '#7fd4ff';
  world.markerOverride = { x: 948, y: 700 };
  world.message = "Dahlia: steal a car and bring it to my garage.";
  world.messageTimer = 4;
  world.camera.x = 900;
  world.camera.y = 700;
  return { world, screen: SCREEN_PLAY, save: { bestCash: 0, missionIndex: 0 } };
}

function stageMission(seed) {
  const world = createWorld(seed);
  // Package Run, mid-delivery: package in hand, 69 seconds left on the clock.
  world.mission = {
    index: 1, stage: 'deliver', timer: 75,
    cpIndex: 0, rival: null, grabProgress: 0, hasPackage: true,
  };
  world.player.cash = 300;
  world.message = 'Package grabbed. Get it to the plaza!';
  world.messageTimer = 4;
  // Start on street 1500 and let the autopilot drive the grid to the plaza.
  const car = putPlayerInCar(world, 1500, 1500, -Math.PI / 2, 0);
  car.color = '#ff9d5c';
  const pilot = makeAutopilot([
    { x: 1500, y: 1100 },
    { x: 1200, y: 1100 },
    { x: 1200, y: 1000 },
  ]);
  const input = scriptedInput();
  for (let i = 0; i < 360; i++) {
    autopilotInput(pilot, world, input);
    stepWorld(world, input, STEP);
    input.endTick();
  }
  world.message = 'Package grabbed. Get it to the plaza!';
  world.messageTimer = 4;
  return { world, screen: SCREEN_PLAY, save: { bestCash: 300, missionIndex: 1 } };
}

function stageTitle(seed) {
  const world = createWorld(seed);
  world.camera.x = 1200;
  world.camera.y = 900;
  return { world, screen: SCREEN_TITLE, save: { bestCash: 2450, missionIndex: 2 } };
}

// Keep the import used by missionTarget visible to bundlers and linters.
void missionTarget;

export function stageShot(name, seed) {
  if (name === 'chase') return stageChase(seed);
  if (name === 'street') return stageStreet(seed);
  if (name === 'mission') return stageMission(seed);
  return stageTitle(seed);
}
