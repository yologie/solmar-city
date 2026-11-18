// Solmar City — constants, city layout, landmarks, palette, mission table.
// All art is drawn in code; no external assets are referenced anywhere.

export const CITY_W = 2600;
export const CITY_H = 1800;
export const ROAD_W = 110;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;

export const AVENUES = [300, 900, 1500, 2100];
export const STREETS = [300, 700, 1100, 1500];

export const BEACH_Y = 1620;
export const SEA_Y = 1700;

export const PALETTE = {
  grass: '#8fce6e',
  grassDark: '#7cbf5f',
  road: '#3d4450',
  roadLine: '#e8d44d',
  sidewalk: '#c9c2b4',
  sand: '#f2dd9e',
  sea: '#2f9fd8',
  seaDeep: '#1f7fb8',
  park: '#69b455',
  parkPath: '#d9c9a3',
  building: '#f2b8c6',
  building2: '#ffd9a0',
  building3: '#a8d8ea',
  building4: '#d5b8e8',
  roof: '#e07890',
  window: '#bfe6f2',
  player: '#ff5a5a',
  police: '#2f6df6',
  traffic: '#f2f2f2',
  hudBg: 'rgba(12, 18, 28, 0.72)',
  hudText: '#ffffff',
  accent: '#ffd23f',
  danger: '#ff3b30',
  ok: '#37d67a',
};

export const LANDMARKS = {
  garage:   { name: "Dahlia's Garage", x: 600,  y: 500,  w: 190, h: 120, color: '#e07890', door: { x: 600,  y: 700 } },
  police:   { name: 'Solmar PD',       x: 1800, y: 500,  w: 200, h: 130, color: '#5b8def', door: { x: 1800, y: 700 } },
  hospital: { name: 'Solmar General',  x: 600,  y: 1300, w: 200, h: 120, color: '#f2f2f2', door: { x: 600,  y: 1160 } },
  mall:     { name: 'Palms Mall',      x: 1800, y: 900,  w: 220, h: 150, color: '#ffd9a0', door: { x: 1800, y: 1160 } },
  gunshop:  { name: 'Ironclad Arms',   x: 1200, y: 500,  w: 110, h: 90,  color: '#8a7f8d', door: { x: 1200, y: 650 } },
  paynspray:{ name: "Pay 'n Spray",    x: 800,  y: 1220, w: 70,  h: 60,  color: '#37d67a', door: { x: 800,  y: 1160 } },
  bank:     { name: 'Solmar Bank',     x: 1200, y: 1300, w: 170, h: 110, color: '#d5b8e8', door: { x: 1200, y: 1160 } },
  safehouse:{ name: 'Safehouse',       x: 2300, y: 500,  w: 130, h: 100, color: '#a8d8ea', door: { x: 2300, y: 500 } },
  docks:    { name: 'The Docks',       x: 2250, y: 1660, w: 150, h: 60,  color: '#b08954', door: { x: 2250, y: 1660 } },
  plaza:    { name: 'Plaza',           x: 1200, y: 900,  w: 120, h: 120, color: '#d9c9a3', door: { x: 1200, y: 900 } },
};

export const PARK = { x: 960, y: 760, w: 480, h: 280 };

export const MISSIONS = [
  {
    id: 'hotwheels', name: 'Hot Wheels', reward: 300,
    intro: 'Dahlia: steal a car and bring it to my garage.',
    objective: 'Hot Wheels: deliver the car to Dahlia\'s Garage',
  },
  {
    id: 'packagerun', name: 'Package Run', reward: 500, timeLimit: 90,
    intro: 'Dahlia: grab the package at the docks, drop it at the plaza. 90 seconds.',
    objective: 'Package Run: deliver the package to the plaza',
  },
  {
    id: 'getaway', name: 'Getaway', reward: 800,
    intro: 'Dahlia: the cops are on you. Lose them — reach the safehouse.',
    objective: 'Getaway: reach the safehouse while wanted',
  },
  {
    id: 'streetrace', name: 'Street Race', reward: 1000,
    intro: 'Dahlia: beat Rico through 5 checkpoints. First one there takes the pot.',
    objective: 'Street Race: hit all 5 checkpoints before Rico',
  },
  {
    id: 'bigscore', name: 'The Big Score', reward: 2000,
    intro: 'Dahlia: one last job. Hit the bank, then bring it home to the garage.',
    objective: 'The Big Score: rob the bank, then reach the garage',
  },
];

export const RACE_CHECKPOINTS = [
  { x: 300, y: 300 },
  { x: 2100, y: 300 },
  { x: 2100, y: 1500 },
  { x: 300, y: 1500 },
  { x: 1500, y: 700 },
];

export const GUN_PRICE = 400;
export const AMMO_PRICE = 50;
export const AMMO_PACK = 12;
export const SPRAY_PRICE = 200;
export const PLAYER_MAX_HP = 100;
export const CAR_MAX_HP = 100;

export const SAVE_KEY = 'solmar-city-save-v1';
