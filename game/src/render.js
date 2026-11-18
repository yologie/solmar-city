// Solmar City — all drawing: the city, cars, people, HUD, minimap and menus.
// Flat vector art drawn in code; the camera follows the player across the
// 2600x1800 city and the view is a fixed 1280x720 window into it.

import {
  AVENUES, BEACH_Y, CAR_MAX_HP, CITY_H, CITY_W, LANDMARKS, MISSIONS, PALETTE,
  PARK, PLAYER_MAX_HP, RACE_CHECKPOINTS, ROAD_W, SEA_Y, STREETS,
} from './config.js';
import { missionObjective, missionTarget } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_VICTORY = 'victory';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function text(value, x, y, size, color, align, bold) {
    ctx.font = (bold ? '700 ' : '') + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCity(world) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, CITY_W, CITY_H);
    // Beach and sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_Y, CITY_W, SEA_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, SEA_Y, CITY_W, CITY_H - SEA_Y);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 40; x < CITY_W; x += 260) {
      ctx.fillRect(x, SEA_Y + 30 + ((x * 7) % 40), 120, 6);
    }
    // Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(PARK.x - PARK.w / 2, PARK.y - PARK.h / 2, PARK.w, PARK.h);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(PARK.x - 14, PARK.y - PARK.h / 2, 28, PARK.h);
    ctx.fillRect(PARK.x - PARK.w / 2, PARK.y - 14, PARK.w, 28);
    for (const t of world.trees) {
      circle(t.x, t.y, 16, '#3e8f3a');
      circle(t.x - 4, t.y - 4, 10, '#57a854');
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const x of AVENUES) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
    for (const y of STREETS) ctx.fillRect(0, y - ROAD_W / 2, CITY_W, ROAD_W);
    // Sidewalk edges.
    ctx.strokeStyle = PALETTE.sidewalk;
    ctx.lineWidth = 6;
    for (const x of AVENUES) {
      ctx.beginPath(); ctx.moveTo(x - ROAD_W / 2, 0); ctx.lineTo(x - ROAD_W / 2, BEACH_Y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + ROAD_W / 2, 0); ctx.lineTo(x + ROAD_W / 2, BEACH_Y); ctx.stroke();
    }
    for (const y of STREETS) {
      ctx.beginPath(); ctx.moveTo(0, y - ROAD_W / 2); ctx.lineTo(CITY_W, y - ROAD_W / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y + ROAD_W / 2); ctx.lineTo(CITY_W, y + ROAD_W / 2); ctx.stroke();
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const x of AVENUES) {
      for (let y = 20; y < BEACH_Y; y += 60) ctx.fillRect(x - 3, y, 6, 30);
    }
    for (const y of STREETS) {
      for (let x = 20; x < CITY_W; x += 60) ctx.fillRect(x, y - 3, 30, 6);
    }
    // Palms on the beach.
    for (const pl of world.palms) {
      ctx.strokeStyle = '#8a6b3f';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pl.x, pl.y + 14); ctx.lineTo(pl.x, pl.y - 12); ctx.stroke();
      circle(pl.x, pl.y - 16, 14, '#3e8f3a');
    }
    // Buildings.
    for (const b of world.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 42));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x - b.w / 2 + 14 + i * 46, b.y - b.h / 2 + 12 + j * 42, 22, 18);
        }
      }
      if (b.name) {
        text(b.name, b.x, b.y - b.h / 2 - 8, 15, '#22303f', 'center', true);
      }
    }
    // Docks pier and plaza fountain.
    ctx.fillStyle = '#8a6b3f';
    ctx.fillRect(LANDMARKS.docks.x - 70, LANDMARKS.docks.y - 20, 140, 40);
    text(LANDMARKS.docks.name, LANDMARKS.docks.x, LANDMARKS.docks.y - 30, 15, '#22303f', 'center', true);
    circle(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 26, '#7fc4e8');
    circle(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 14, '#bfe6f2');
    text(LANDMARKS.plaza.name, LANDMARKS.plaza.x, LANDMARKS.plaza.y - 34, 15, '#22303f', 'center', true);
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = 44;
    const h = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 7);
    ctx.fill();
    ctx.fillStyle = '#22303f';
    ctx.fillRect(-6, -h / 2 + 3, 14, h - 6);
    ctx.fillStyle = '#bfe6f2';
    ctx.fillRect(8, -h / 2 + 4, 8, h - 8);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
    ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-14, -h / 2 - 2, 8, 4);
      ctx.fillStyle = '#2f6df6';
      ctx.fillRect(-4, -h / 2 - 2, 8, 4);
      text('PD', 0, 4, 11, '#ffffff', 'center', true);
    }
    if (car.kind === 'rival') {
      text('RICO', 0, 4, 10, '#ffffff', 'center', true);
    }
    ctx.restore();
    if (car.smoke) {
      circle(car.x - 18, car.y - 10, 8, 'rgba(120,120,120,0.6)');
      circle(car.x - 26, car.y - 16, 11, 'rgba(120,120,120,0.45)');
    }
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPerson(x, y, angle, color, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    circle(0, 0, radius, color);
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWorld(world) {
    drawCity(world);
    // Cash pickups.
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(world.tick / 20 + pk.x) * 2;
      circle(pk.x, pk.y + bob, 10, '#ffd23f');
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.stroke();
      text('$', pk.x, pk.y + bob + 4, 12, '#7a5b00', 'center', true);
    }
    // Mission marker ring.
    const target = missionTarget(world);
    if (target) {
      const pulse = 26 + Math.sin(world.tick / 12) * 6;
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.accent;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - pulse - 18);
      ctx.lineTo(target.x - 9, target.y - pulse - 4);
      ctx.lineTo(target.x + 9, target.y - pulse - 4);
      ctx.closePath();
      ctx.fill();
    }
    // Race checkpoints.
    if (world.mission && world.mission.index === 3) {
      RACE_CHECKPOINTS.forEach((cp, i) => {
        if (i < world.mission.cpIndex) return;
        ctx.strokeStyle = i === world.mission.cpIndex ? PALETTE.accent : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = i === world.mission.cpIndex ? 4 : 2;
        ctx.beginPath(); ctx.arc(cp.x, cp.y, 30, 0, Math.PI * 2); ctx.stroke();
        text(String(i + 1), cp.x, cp.y + 6, 18, i === world.mission.cpIndex ? PALETTE.accent : '#ffffff', 'center', true);
      });
    }
    // People.
    for (const ped of world.peds) {
      if (ped.downTimer > 0) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(1.2);
        circle(0, 0, 11, ped.color);
        ctx.restore();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.color, 11);
    }
    for (const cop of world.cops) {
      if (cop.downTimer > 0) {
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(1.2);
        circle(0, 0, 12, '#2f6df6');
        ctx.restore();
        continue;
      }
      drawPerson(cop.x, cop.y, cop.angle, '#2f6df6', 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cop.x - 8, cop.y - 16, 16, 5);
    }
    // Cars (player car last so it sits on top).
    const playerCar = world.player.inCar;
    for (const car of world.cars) {
      if (car === playerCar) continue;
      drawCar(car, false);
    }
    if (playerCar) drawCar(playerCar, true);
    // Player on foot.
    if (!playerCar) {
      const p = world.player;
      const blink = p.hurtCd > 0 && Math.floor(p.hurtCd * 12) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.angle, PALETTE.player, 13);
      if (p.hasPistol) {
        ctx.strokeStyle = '#22303f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
        ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
        ctx.stroke();
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffe14d';
    for (const b of world.bullets) circle(b.x, b.y, 4, '#ffe14d');
  }

  function drawMinimap(world) {
    const mw = 208;
    const mh = 144;
    const mx = 1280 - mw - 16;
    const my = 16;
    const sx = mw / CITY_W;
    const sy = mh / CITY_H;
    ctx.fillStyle = 'rgba(12, 18, 28, 0.75)';
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#8fce6e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f9fd8';
    ctx.fillRect(mx, my + SEA_Y * sy, mw, mh - SEA_Y * sy);
    ctx.fillStyle = '#3d4450';
    for (const x of AVENUES) ctx.fillRect(mx + (x - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
    for (const y of STREETS) ctx.fillRect(mx, my + (y - ROAD_W / 2) * sy, mw, ROAD_W * sy);
    ctx.fillStyle = '#ffd23f';
    for (const key of ['garage', 'police', 'hospital', 'mall', 'gunshop', 'paynspray', 'bank', 'safehouse']) {
      const lm = LANDMARKS[key];
      ctx.fillRect(mx + lm.x * sx - 2, my + lm.y * sy - 2, 4, 4);
    }
    const target = missionTarget(world);
    if (target) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#2f6df6';
    for (const car of world.cars) {
      if (car.kind === 'police') ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
    text('N', mx + mw - 8, my + 14, 11, '#ffffff', 'right', true);
  }

  function drawHud(world) {
    const p = world.player;
    // Top-left panel: cash, health, wanted stars, objective.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(16, 16, 420, 108);
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(16, 16, 6, 108);
    text('$' + p.cash, 36, 48, 28, PALETTE.hudText, 'left', true);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(36, 58, 180, 12);
    ctx.fillStyle = p.hp > 50 ? '#37d67a' : p.hp > 25 ? '#ffd23f' : '#ff3b30';
    ctx.fillRect(36, 58, 180 * (p.hp / PLAYER_MAX_HP), 12);
    text('HP', 224, 70, 14, PALETTE.hudText, 'left', true);
    // Wanted stars.
    for (let i = 0; i < 5; i++) {
      text(i < world.wanted ? '★' : '☆', 36 + i * 26, 98, 22, i < world.wanted ? '#ffd23f' : 'rgba(255,255,255,0.5)', 'left', true);
    }
    if (p.hasPistol) text('Pistol  •  Ammo ' + p.ammo, 180, 98, 15, PALETTE.hudText, 'left');
    // Objective.
    const obj = missionObjective(world);
    if (obj) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, 134, 560, 34);
      text('◆ ' + obj, 28, 157, 17, PALETTE.accent, 'left', true);
    }
    // Mission timer.
    if (world.mission && world.mission.index === 1) {
      const t = Math.max(0, Math.ceil(world.mission.timer));
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, 176, 150, 40);
      text('⏱ ' + t + 's', 30, 205, 24, t <= 15 ? '#ff3b30' : PALETTE.hudText, 'left', true);
    }
    // Big Score grab progress.
    if (world.mission && world.mission.index === 4 && world.mission.stage === 'grab') {
      const prog = world.mission.grabProgress / 5;
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, 176, 300, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(28, 188, 200, 14);
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(28, 188, 200 * prog, 14);
      text('Cracking the vault…', 238, 202, 15, PALETTE.hudText, 'left', true);
    }
    // Speedometer (when driving): car health as a percentage of max.
    if (p.inCar) {
      const car = p.inCar;
      const mph = Math.round(Math.abs(car.speed) * 0.55);
      const hpPct = Math.round((car.hp / CAR_MAX_HP) * 100);
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(1280 - 226, 720 - 92, 210, 76);
      text(mph + ' mph', 1280 - 36, 720 - 56, 30, PALETTE.hudText, 'right', true);
      text('Car ' + hpPct + '%', 1280 - 36, 720 - 30, 16, hpPct > 50 ? '#37d67a' : hpPct > 25 ? '#ffd23f' : '#ff3b30', 'right', true);
    }
    // Message toast.
    if (world.messageTimer > 0 && world.message) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(340, 720 - 64, 600, 36);
      text(world.message, 640, 720 - 39, 17, PALETTE.hudText, 'center');
    }
    // Context prompt.
    if (world.prompt) {
      text(world.prompt, 640, 720 - 84, 16, PALETTE.accent, 'center', true);
    }
    drawMinimap(world);
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.62)';
    ctx.fillRect(0, 0, 1280, 720);
    const w = 680;
    const h = 150 + lines.length * 34 + 70;
    const x = (1280 - w) / 2;
    const y = (720 - h) / 2;
    ctx.fillStyle = '#141c2b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || PALETTE.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, 640, y + 72, 46, accent || PALETTE.accent, 'center', true);
    lines.forEach((line, i) => {
      text(line, 640, y + 122 + i * 34, 19, '#dfe6ef', 'center');
    });
    text(prompt, 640, y + h - 28, 20, PALETTE.accent, 'center', true);
  }

  function drawTitle(world, save) {
    // Screen-space overlay only: the caller draws the world (inside the
    // camera transform) before this, so every coordinate here is in
    // 1280x720 screen space.
    ctx.fillStyle = 'rgba(8, 12, 20, 0.45)';
    ctx.fillRect(0, 0, 1280, 720);
    text('SOLMAR CITY', 640, 190, 84, '#ffd23f', 'center', true);
    text('a sun-soaked open-world crime story', 640, 232, 24, '#ffffff', 'center');
    text('Milo Reyes • Dahlia • five jobs • one big score', 640, 266, 18, '#dfe6ef', 'center');
    const lines = [
      'WASD move • Shift run • Space punch • F / click shoot',
      'E enter a car, talk to a shop • P pause • M mute',
      'Steal cars, dodge the cops, climb the wanted stars.',
    ];
    lines.forEach((line, i) => text(line, 640, 330 + i * 30, 18, '#ffffff', 'center'));
    if (save && save.missionIndex > 0) {
      text('Best cash $' + save.bestCash + '  •  Missions done: ' + save.missionIndex + ' / 5', 640, 448, 18, '#37d67a', 'center', true);
      text('Press ENTER to Continue, or SPACE for a new game', 640, 520, 22, '#ffd23f', 'center', true);
    } else {
      if (save && save.bestCash > 0) text('Best cash $' + save.bestCash, 640, 448, 18, '#37d67a', 'center', true);
      text('Press SPACE or click to start', 640, 520, 22, '#ffd23f', 'center', true);
    }
    text('Original game. No real city, no real gangsters.', 640, 690, 14, 'rgba(255,255,255,0.6)', 'center');
  }

  function draw(world, screen, save) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / 1280, canvas.height / 720);
    const ox = (canvas.width - 1280 * scale) / 2;
    const oy = (canvas.height - 720 * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (screen === SCREEN_TITLE) {
      // Title looks at the city centre, not the spawn corner.
      const keep = { x: world.camera.x, y: world.camera.y };
      world.camera.x = 1200;
      world.camera.y = 900;
      // The living city behind the title is world-space: draw it inside the
      // camera transform, then restore and draw the title text in screen
      // space (drawing the text inside the translate pushed it off-screen).
      ctx.save();
      ctx.translate(640 - world.camera.x, 360 - world.camera.y);
      drawWorld(world);
      ctx.restore();
      drawTitle(world, save);
      world.camera.x = keep.x;
      world.camera.y = keep.y;
      return;
    }
    ctx.save();
    ctx.translate(640 - world.camera.x, 360 - world.camera.y);
    drawWorld(world);
    ctx.restore();
    if (screen === SCREEN_PLAY) {
      drawHud(world);
      return;
    }
    drawHud(world);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for no one. Except now.', 'Missions done: ' + (world.mission ? world.mission.index : 0) + ' / 5'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar PD finally caught Milo Reyes.', 'Cash kept: $' + world.player.cash], 'Press SPACE to try again', '#2f6df6');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Milo Reyes went down in Solmar City.', 'Cash kept: $' + world.player.cash], 'Press SPACE to try again', '#ff3b30');
    } else if (screen === SCREEN_VICTORY) {
      const total = MISSIONS.reduce((s, m) => s + m.reward, 0);
      drawPanel('THE BIG SCORE', [
        'Milo pulled it off. Dahlia is already counting the money.',
        'All 5 missions complete — total job pay $' + total + '.',
        'Final cash: $' + world.player.cash,
      ], 'Press SPACE to play again', '#37d67a');
    }
  }

  return { draw };
}
