// Solmar City — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, wasted, victory.
// ?seed=N fixes the city. ?shot=chase|street|mission|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { LANDMARKS, SAVE_KEY, STEP } from './config.js';
import {
  createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_MISSION, EVENT_PICKUP,
  EVENT_PUNCH, EVENT_SHOT, EVENT_VICTORY, EVENT_WASTED, startMission, stepWorld,
} from './world.js';
import { Input } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_VICTORY, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';
import { AudioSys } from './audio.js';
import { hashString } from './random.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
// A single seed may be derived once at startup; gameplay never re-seeds.
const seed = Number.isInteger(seedParam) ? seedParam : hashString('solmar-city') & 0xffff;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = new AudioSys();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { bestCash: 0, missionIndex: 0 };
    const save = JSON.parse(raw);
    return {
      bestCash: Number(save.bestCash) || 0,
      missionIndex: Number(save.missionIndex) || 0,
    };
  } catch {
    return { bestCash: 0, missionIndex: 0 };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function distTo(p, q) {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

function runShot(name) {
  const scene = stageShot(name, seed);
  const renderer = createRenderer(canvas);
  let painted = 0;
  function paint() {
    renderer.draw(scene.world, scene.screen, scene.save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = new Input();
  input.attach(canvas);
  const renderer = createRenderer(canvas);
  let world = createWorld(seed);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    world = createWorld(seed);
    if (continueSave && save.missionIndex > 0 && save.missionIndex < 5) {
      // Continue: keep the cash already earned and restart at the saved
      // mission. Earlier rewards are not paid again.
      world.player.cash = save.bestCash;
      world.bestCash = save.bestCash;
      startMission(world, save.missionIndex);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Solmar City.');
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    const done = world.mission ? world.mission.index : 0;
    const finished = world.victory ? 5 : done;
    if (world.player.cash > save.bestCash) save.bestCash = world.player.cash;
    if (finished > save.missionIndex) save.missionIndex = finished;
    writeSave(save);
    announce(message);
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.jingle(false);
    if (events & EVENT_VICTORY) audio.jingle(true);
    if (events & EVENT_BUSTED) audio.busted();
    if (events & EVENT_CRIME) audio.blip(180, 0.15, 'square', 0.08);
    if (events & EVENT_BUSTED) endRun(SCREEN_BUSTED, 'Busted. The Solmar PD caught Milo.');
    else if (events & EVENT_WASTED) endRun(SCREEN_WASTED, 'Wasted. Milo went down.');
    else if (events & EVENT_VICTORY) endRun(SCREEN_VICTORY, 'The Big Score! All five missions complete.');
  }

  function updatePrompt() {
    const p = world.player;
    world.prompt = '';
    if (p.inCar) {
      if (world.wanted > 0 && distTo(p, LANDMARKS.paynspray.door) < 100) {
        world.prompt = "E — Pay 'n Spray ($200, clears wanted)";
      } else if (Math.abs(p.inCar.speed) < 30) {
        world.prompt = 'E — exit car';
      }
      return;
    }
    if (distTo(p, LANDMARKS.gunshop.door) < 90) {
      world.prompt = p.hasPistol ? 'E — buy ammo ($50)' : 'E — buy pistol ($400)';
    }
  }

  // A no-op input for the title-screen backdrop simulation.
  const idleInput = {
    down: new Set(), pressed: new Set(),
    mouse: { x: 0, y: 0, clicked: false }, anyKey: false,
    isDown() { return false; },
    wasPressed() { return false; },
    moveAxes() { return { x: 0, y: 0 }; },
    endTick() { this.pressed.clear(); },
  };

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen shows the living city: simulate harmlessly.
      stepWorld(world, idleInput, STEP);
      return;
    }
    updatePrompt();
    const events = stepWorld(world, input, STEP);
    input.endTick();
    handleEvents(events);
    const speedNorm = world.player.inCar
      ? Math.abs(world.player.inCar.speed) / 300
      : Math.abs(world.player.speed) / 250;
    audio.update(speedNorm, world.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.muted);
    }
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.clicked) {
        audio.ensure();
        const cont = input.wasPressed('Enter') && save.missionIndex > 0;
        startGame(cont);
        input.endTick();
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_VICTORY) {
      if (input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.clicked) {
        startGame(false);
        input.endTick();
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, save);
    input.endTick();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
