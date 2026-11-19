// Solmar Bay — configuration and static game data.
// Every name, place, vehicle and person here is invented for this game.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 64;
export const SIDEWALK = 14;

// Vertical and horizontal road centre lines across the city grid.
export const ROADS_V = [360, 860, 1360, 1860, 2360, 2860];
export const ROADS_H = [320, 760, 1200, 1640, 2040];

export const DEFAULT_SEED = 20261119;

// Districts, defined as rectangles. districtAt() in city.js resolves a point.
export const DISTRICTS = [
  { name: 'Downtown', x: 900, y: 80, w: 1400, h: 700, tint: '#3a4a63', ground: '#5d6b52' },
  { name: 'Old Town', x: 80, y: 80, w: 760, h: 700, tint: '#6b5136', ground: '#6f6a55' },
  { name: 'The Marina', x: 2400, y: 80, w: 520, h: 700, tint: '#2e5f6e', ground: '#5e7a6a' },
  { name: 'Palm Beach', x: 2400, y: 1500, w: 520, h: 520, tint: '#a8845a', ground: '#c2a878' },
  { name: 'Harbor Docks', x: 80, y: 1500, w: 760, h: 520, tint: '#4d4a42', ground: '#6d6a5c' },
  { name: 'Cedar Hills', x: 900, y: 1500, w: 1400, h: 520, tint: '#3f5a3a', ground: '#59704a' },
  { name: 'Sunset Park', x: 900, y: 820, w: 1400, h: 640, tint: '#46603f', ground: '#5c7a4e' },
];

// Eight original car models. No real-world makes or models.
export const CAR_MODELS = [
  { id: 'coral', name: 'Coral Coupe', color: '#e2543e', top: 340, accel: 260, grip: 3.4, len: 52, wid: 26 },
  { id: 'marlin', name: 'Marlin Sedan', color: '#3e7de2', top: 300, accel: 220, grip: 3.1, len: 56, wid: 27 },
  { id: 'runner', name: 'Bay Runner', color: '#e8b73a', top: 315, accel: 235, grip: 3.2, len: 54, wid: 27 },
  { id: 'tide', name: 'Tide Van', color: '#7a8894', top: 250, accel: 170, grip: 2.6, len: 64, wid: 30 },
  { id: 'palm', name: 'Palm GT', color: '#c93a86', top: 380, accel: 300, grip: 3.8, len: 50, wid: 25 },
  { id: 'hauler', name: 'Harbor Hauler', color: '#4a7a4f', top: 230, accel: 150, grip: 2.4, len: 78, wid: 32 },
  { id: 'taxi', name: 'Sunset Taxi', color: '#f2c230', top: 290, accel: 210, grip: 3.0, len: 56, wid: 27 },
  { id: 'dune', name: 'Dune Buggy', color: '#d97b2e', top: 320, accel: 250, grip: 2.9, len: 48, wid: 28 },
];

export const POLICE_CAR = { id: 'pd', name: 'Solmar PD Interceptor', color: '#20242c', top: 355, accel: 290, grip: 3.6, len: 56, wid: 27 };

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 250,
  punchDamage: 34,
  punchRange: 34,
  punchArc: 1.1,
  pistolDamage: 45,
  pistolRange: 420,
  pistolAmmo: 12,
  maxHealth: 100,
};

export const WANTED = {
  // heat thresholds that raise the star level
  thresholds: [12, 30, 55, 80, 105],
  decayPerSec: 1.6, // heat lost while unseen and crime-free
  decayDelaySec: 6, // seconds after the last crime before decay starts
  crimeHeat: { steal: 14, punch: 8, shoot: 18, kill: 26, speed: 0.4, crash: 3 },
  maxCops: [0, 1, 2, 3, 4, 5],
};

export const DAY_LENGTH_SEC = 360; // one full in-game day

export const SAVE_KEY = 'solmar-bay-save-v1';

export const MISSION_DEFS = [
  {
    id: 'homecoming', title: 'Homecoming', giver: 'Rico Ferrante',
    brief: 'Rico left a Coral Coupe by the Marina. Drive it to the meet at Sunset Park.',
    reward: 400, kind: 'drive', target: { x: 1600, y: 1140 }, radius: 90,
    carModel: 'coral',
  },
  {
    id: 'docks-job', title: 'The Docks Job', giver: 'Rico Ferrante',
    brief: 'The Harlow crew parks a Harbor Hauler at the docks. Steal it and bring it to the Cedar Hills garage.',
    reward: 800, kind: 'deliver', target: { x: 1500, y: 1780 }, radius: 100,
    carModel: 'hauler',
  },
  {
    id: 'shakedown', title: 'Shakedown', giver: 'Rico Ferrante',
    brief: 'Three Harlow lookouts are leaning on Old Town shops. Put all three down — fists or pistol.',
    reward: 650, kind: 'beat', target: { x: 500, y: 500 }, radius: 220, count: 3,
  },
  {
    id: 'hot-pursuit', title: 'Hot Pursuit', giver: 'Nia Solano',
    brief: 'The Harlows tipped off the PD. Lose a three-star wanted level — break line of sight and stay clean.',
    reward: 900, kind: 'escape', target: { x: 2100, y: 500 }, radius: 120, stars: 3,
  },
  {
    id: 'getaway', title: 'The Getaway', giver: 'Rico Ferrante',
    brief: 'Pick Rico up at the Marina, then drive him to the Cedar Hills safehouse while the PD is on you.',
    reward: 1200, kind: 'escort', target: { x: 1500, y: 1780 }, radius: 110,
    pickup: { x: 2650, y: 480 }, stars: 2,
  },
  {
    id: 'king-tide', title: 'King Tide', giver: 'Nia Solano',
    brief: 'End it at the Harbor Docks: drop five Harlow enforcers, then escape to Palm Beach.',
    reward: 2500, kind: 'finale', target: { x: 2700, y: 1800 }, radius: 140,
    spawn: { x: 420, y: 1780 }, count: 5,
  },
];
