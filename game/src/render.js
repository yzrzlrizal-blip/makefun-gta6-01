// Drawing only: the city, cars, people, particles, weather and day/night,
// then the HUD (cash, health, armor, wanted stars, clock, mission banner,
// speed, radio) and the minimap. Flat vector art, drawn fresh every frame
// from the world's state — no image files at all.
import { CAR, PALETTE, ROAD, WORLD } from './config.js';
import { currentMission, currentStage, objectiveText } from './missions.js';
import { districtAt } from './config.js';
import { clamp, dist } from './random.js';
import { onRoad, roadXs, roadYs } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_HELP = 'help';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 1280, h: 720 };
  let camX = 690, camY = 760;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.w = canvas.width / ratio; view.h = canvas.height / ratio;
  }
  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  }
  function star(x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#f2c94c' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawGround(world) {
    const city = world.city;
    const x0 = Math.max(0, camX - view.w / 2 - 80), y0 = Math.max(0, camY - view.h / 2 - 80);
    const x1 = Math.min(WORLD.width, camX + view.w / 2 + 80), y1 = Math.min(WORLD.height, camY + view.h / 2 + 80);
    // Base grass.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Beach and sea along the south edge.
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(x0, Math.max(y0, city.beach.y), x1 - x0, Math.max(0, Math.min(y1, city.beach.y + city.beach.h) - Math.max(y0, city.beach.y)));
    ctx.fillStyle = PALETTE.water; ctx.fillRect(x0, Math.max(y0, city.sea.y), x1 - x0, Math.max(0, y1 - Math.max(y0, city.sea.y)));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 120; x < WORLD.width; x += 260) ctx.fillRect(x, city.sea.y + 30 + ((x / 260) % 2) * 18, 90, 3);
    // Piers at the marina.
    ctx.fillStyle = '#8a6f55';
    for (const pier of city.piers) ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    // Roads: asphalt bands with centre dashes.
    ctx.fillStyle = PALETTE.asphalt;
    for (const x of roadXs()) if (x > x0 - 80 && x < x1 + 80) ctx.fillRect(x - ROAD.width / 2, y0, ROAD.width, y1 - y0);
    for (const y of roadYs()) if (y > y0 - 80 && y < y1 + 80) ctx.fillRect(x0, y - ROAD.width / 2, x1 - x0, ROAD.width);
    ctx.fillStyle = PALETTE.lane;
    for (const x of roadXs()) {
      if (x < x0 - 80 || x > x1 + 80) continue;
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(x - 2, y, 4, 22);
    }
    for (const y of roadYs()) {
      if (y < y0 - 80 || y > y1 + 80) continue;
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, y - 2, 22, 4);
    }
    // Sidewalk edges.
    ctx.strokeStyle = PALETTE.sidewalk; ctx.lineWidth = 3;
    for (const x of roadXs()) {
      if (x < x0 - 80 || x > x1 + 80) continue;
      ctx.beginPath(); ctx.moveTo(x - ROAD.width / 2 - 7, y0); ctx.lineTo(x - ROAD.width / 2 - 7, y1);
      ctx.moveTo(x + ROAD.width / 2 + 7, y0); ctx.lineTo(x + ROAD.width / 2 + 7, y1); ctx.stroke();
    }
    // Buildings.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) for (let cy = 0; cy < rows; cy += 1) {
        if ((cx + cy) % 2 === 0) ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 10, 8);
      }
      if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(b.x + b.w / 2 - 3, b.y + 8, 6, 14); }
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#3d7a33'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5da84e'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Lamps.
    ctx.fillStyle = '#3a3f45';
    for (const l of city.lamps) if (l.x > x0 && l.x < x1 && l.y > y0 && l.y < y1) ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.beginPath(); ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,44,0.9)';
    ctx.fillRect(-6, -CAR.width / 2 + 4, 14, CAR.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(CAR.length / 2 - 8, -CAR.width / 2 + 4, 4, 6);
    ctx.fillRect(CAR.length / 2 - 8, CAR.width / 2 - 10, 4, 6);
    if (car.police) {
      ctx.fillStyle = '#f4f1e6'; ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2, 10, CAR.width);
      ctx.fillStyle = '#e5534b'; ctx.fillRect(-4, -CAR.width / 2 - 3, 8, 6);
      ctx.fillStyle = '#2f6fd0'; ctx.fillRect(4, -CAR.width / 2 - 3, 8, 6);
      if (Math.floor(car.sirenT * 3) % 2 === 0) { ctx.fillStyle = 'rgba(229,83,75,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(79,195,247,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); }
    }
    if (car.model && car.model.taxi) { ctx.fillStyle = '#222'; text('TAXI', 0, 4, 9, '#222', 'center', true); }
    if (isPlayer) { ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 10); ctx.stroke(); }
    ctx.restore();
    if (car.health < 60 && !car.dead) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(car.x - 10, car.y - 8, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, skin, walkPhase, isPlayer, label) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    const swing = Math.sin(walkPhase || 0) * 4;
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-4 + swing, 12); ctx.moveTo(4, 4); ctx.lineTo(4 - swing, 12); ctx.stroke();
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4 - 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2118'; ctx.beginPath(); ctx.arc(Math.cos(angle) * 5, Math.sin(angle) * 5 - 4, 4, 0, Math.PI * 2); ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#f2c94c'; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18); ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28); ctx.stroke();
    }
    ctx.restore();
    if (label) text(label, x, y - 24, 12, '#fff', 'center', true);
  }

  function drawWorld(world, state) {
    const p = state.player;
    const focus = p.inCar || { x: p.x, y: p.y, angle: p.angle };
    // Snap the camera when it is far from the focus (teleports, staged
    // screenshots, respawns); otherwise ease toward it.
    if (Math.hypot(focus.x - camX, focus.y - camY) > 500) { camX = focus.x; camY = focus.y; }
    else { camX += (focus.x - camX) * 0.12; camY += (focus.y - camY) * 0.12; }
    const zoom = p.inCar ? 0.82 : 1.0;
    const scale = view.scale * zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, view.w / 2 * view.scale - camX * scale + (state.shake ? (Math.random() - 0.5) * state.shake : 0), view.h / 2 * view.scale - camY * scale);
    // NOTE: view is in CSS pixels; canvas is device pixels. The transform above
    // is applied in device-pixel space via view.scale = devicePixelRatio.
    drawGround(world);
    // Mission marker + sun-coins + pickups.
    const ms = state.missions;
    const m = currentMission(ms);
    if (m) {
      const s = currentStage(ms);
      if (s) {
        const pulse = 26 + Math.sin(performance.now() / 300) * 6;
        ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath(); ctx.moveTo(s.x, s.y - pulse - 18); ctx.lineTo(s.x - 8, s.y - pulse - 2); ctx.lineTo(s.x + 8, s.y - pulse - 2); ctx.closePath(); ctx.fill();
      }
    }
    for (const coin of state.coins) {
      if (coin.taken) continue;
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(coin.x, coin.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; text('$', coin.x, coin.y + 4, 11, '#8a6d00', 'center', true);
    }
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      ctx.fillStyle = pk.kind === 'health' ? '#e5534b' : pk.kind === 'armor' ? '#4f7ec9' : '#7ed491';
      ctx.fillRect(pk.x - 12, pk.y - 12, 24, 24);
      ctx.fillStyle = '#fff'; text(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '•', pk.x, pk.y + 5, 14, '#fff', 'center', true);
    }
    // Cars (traffic, police, the van), then people.
    for (const car of state.cars) if (!car.dead) drawCarShape(car, car === p.inCar);
    if (state.van && !state.vanDead) drawCarShape(state.van, false);
    for (const ped of state.peds) {
      if (ped.dead) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.color, ped.fleeT > 0 ? performance.now() / 60 : 0, false, ped.waiting ? 'TAXI?' : null);
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#2f3a4a', '#e8b48a', performance.now() / 90, false, 'PD');
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      drawPerson(e.x, e.y, e.angle, '#7a2b2b', '#c9a186', performance.now() / 90, false, 'HARLOW');
      bar(e.x - 16, e.y - 30, 32, 5, e.health / 60, '#e5534b');
    }
    if (!p.inCar && !p.dead) {
      drawPerson(p.x, p.y, p.angle, '#e8b13c', '#e8b48a', p.walkPhase, true, 'NIA');
      if (p.punchT > 0.15) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 10, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Tracers and particles.
    ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 2;
    for (const t of state.tracers) { ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.t / pt.max, 0, 1);
      ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Day / night tint + rain.
    const hour = state.clock / 60;
    const night = hour < 6 || hour >= 19 ? 0.42 : hour < 7 || hour >= 18 ? 0.2 : 0;
    if (night > 0) { ctx.fillStyle = `rgba(10,16,48,${night})`; ctx.fillRect(camX - view.w, camY - view.h, view.w * 2, view.h * 2); }
    if (state.rain > 0) {
      ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i += 1) {
        const rx = camX + ((i * 173) % 1200) - 600, ry = camY + ((i * 97 + performance.now() / 8) % 800) - 400;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
      }
    }
    if (state.flash > 0) { ctx.fillStyle = `rgba(229,83,75,${state.flash})`; ctx.fillRect(camX - view.w, camY - view.h, view.w * 2, view.h * 2); }
  }

  function drawMinimap(world, state) {
    const mw = 210, mh = 158, mx = view.w - mw - 16, my = 16;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.fillStyle = 'rgba(10,14,20,0.85)'; ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2e5d3a'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1d6f8e'; ctx.fillRect(mx, my + mh - 12, mw, 12);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    for (const x of roadXs()) { ctx.beginPath(); ctx.moveTo(mx + x * sx, my); ctx.lineTo(mx + x * sx, my + mh); ctx.stroke(); }
    for (const y of roadYs()) { ctx.beginPath(); ctx.moveTo(mx, my + y * sy); ctx.lineTo(mx + mw, my + y * sy); ctx.stroke(); }
    const dot = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill(); };
    const ms = state.missions;
    const s = currentStage(ms);
    if (s && currentMission(ms)) dot(s.x, s.y, 5, '#f2c94c');
    for (const car of state.cars) if (car.police && !car.dead) dot(car.x, car.y, 3, '#4fc3f7');
    for (const cop of state.cops) if (!cop.dead) dot(cop.x, cop.y, 2, '#4fc3f7');
    const p = state.player;
    dot(p.x, p.y, 4, '#fff');
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 7, 0, Math.PI * 2); ctx.stroke();
    text('N', mx + 8, my + 14, 11, '#fff', 'left', true);
    const d = districtAt(p.x, p.y);
    text(d.name, mx, my + mh + 18, 12, '#f4f1e6', 'left', true);
  }

  function drawHud(world, state) {
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    const p = state.player;
    // Top-left: cash, health, armor, ammo.
    ctx.fillStyle = PALETTE.panel; ctx.fillRect(12, 12, 250, 108);
    text(`$${p.cash.toLocaleString('en-US')}`, 24, 40, 24, '#7ed491', 'left', true);
    text('HEALTH', 24, 64, 12, PALETTE.muted, 'left', true);
    bar(90, 52, 150, 12, p.health / 100, p.health > 30 ? '#7ed491' : '#e5534b');
    text('ARMOR', 24, 86, 12, PALETTE.muted, 'left', true);
    bar(90, 74, 150, 12, p.armor / 100, '#4f7ec9');
    text(p.inCar ? `CAR  ${p.inCar.model.name}` : `PISTOL  AMMO ${p.ammo}`, 24, 108, 13, PALETTE.text, 'left', true);
    // Wanted stars, top centre-left under the cash panel.
    for (let i = 0; i < 5; i += 1) star(36 + i * 34, 148, 13, i < state.police.stars);
    if (state.police.stars > 0) text('WANTED', 200, 154, 13, '#f2c94c', 'left', true);
    // Clock + radio.
    const hh = String(Math.floor(state.clock / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(state.clock) % 60).padStart(2, '0');
    text(`${hh}:${mm}`, view.w - 236, 196, 16, '#f4f1e6', 'right', true);
    // Mission objective, top centre.
    const obj = objectiveText(state.missions);
    ctx.fillStyle = PALETTE.panel;
    const ow = Math.min(640, 40 + obj.length * 7.2);
    ctx.fillRect((view.w - ow) / 2, 12, ow, 34);
    text(obj, view.w / 2, 35, 15, '#f4f1e6', 'center', true);
    // Toast.
    if (state.toastT > 0 && state.toast) {
      ctx.fillStyle = 'rgba(12,16,22,0.8)';
      ctx.fillRect((view.w - 520) / 2, view.h - 120, 520, 34);
      text(state.toast, view.w / 2, view.h - 97, 15, '#f2c94c', 'center', true);
    }
    // Speed + controls hint, bottom right / left.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.14);
      text(`${mph}`, view.w - 30, view.h - 66, 44, '#f4f1e6', 'right', true);
      text('MPH', view.w - 30, view.h - 40, 13, PALETTE.muted, 'right', true);
      bar(view.w - 190, view.h - 28, 160, 8, p.inCar.health / 100, p.inCar.health > 30 ? '#7ed491' : '#e5534b');
    }
    text('WASD move/drive · E enter car · Q punch · X shoot · Shift sprint · H horn · R radio · M mute · P pause', 16, view.h - 16, 12, 'rgba(244,241,230,0.75)', 'left');
    // Mission banner.
    if (state.missions.bannerT > 0 && state.missions.banner) {
      ctx.fillStyle = 'rgba(12,16,22,0.85)';
      ctx.fillRect((view.w - 560) / 2, view.h / 2 - 70, 560, 86);
      text(state.missions.banner, view.w / 2, view.h / 2 - 34, 26, '#f2c94c', 'center', true);
      const m = currentMission(state.missions);
      if (m) text(m.briefing, view.w / 2, view.h / 2, 14, '#f4f1e6', 'center');
    }
    drawMinimap(world, state);
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    const w = 680, h = 150 + lines.length * 30;
    const x = (view.w - w) / 2, y = (view.h - h) / 2;
    ctx.fillStyle = 'rgba(10,14,20,0.92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#f2c94c'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    text(title, view.w / 2, y + 58, 40, accent || '#f2c94c', 'center', true);
    lines.forEach((line, i) => text(line, view.w / 2, y + 102 + i * 30, 17, '#f4f1e6', 'center'));
    text(prompt, view.w / 2, y + h - 26, 15, PALETTE.muted, 'center');
  }

  function drawTitle(world, state, best) {
    drawWorld(world, state);
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.fillStyle = 'rgba(8,12,20,0.55)'; ctx.fillRect(0, 0, view.w, view.h);
    const lines = [
      'WASD — move / drive    E — steal & enter a car    Q — punch    X — shoot',
      'Steal cars, lose the cops, run six story jobs, find 20 sun-coins.',
      best > 0 ? `Best cash earned: $${best.toLocaleString('en-US')}` : 'No save yet — a new story starts at the Safehouse.',
    ];
    // The title screen's prompt offers "continue your saved game" only when a
    // save exists; world.hasSave() reads localStorage, while world.state
    // carries no hasSave flag, so ask the world object, not the state.
    drawPanel('SOLMAR BAY', lines, world.hasSave() ? 'Press Space to play — or L to continue your saved game' : 'Press Space or click to start', '#f2c94c');
  }

  function drawOver(world, state, best) {
    drawWorld(world, state);
    const wasted = state.over === 'wasted';
    drawPanel(
      wasted ? 'WASTED' : 'BUSTED',
      wasted
        ? [`Nia went down in ${districtAt(state.player.x, state.player.y).name}.`, `Cash earned this run: $${state.stats.earned.toLocaleString('en-US')}`]
        : ['The Solmar PD caught up with Nia.', 'They took $200 in fines. The jobs are still waiting.'],
      'Press Space to wake up at Solmar General Hospital',
      wasted ? '#e5534b' : '#4f7ec9',
    );
  }

  function draw(state, screen, best, world) {
    resize();
    view.scale = window.devicePixelRatio || 1;
    if (screen === SCREEN_TITLE) { drawTitle(world, state, best); return; }
    drawWorld(world, state);
    drawHud(world, state);
    if (screen === SCREEN_PAUSED) {
      ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, view.w, view.h);
      drawPanel('PAUSED', [
        `Cash $${state.player.cash.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone}/6 · Sun-coins ${state.collected}/20`,
        `Cars stolen ${state.stats.carsStolen} · Distance ${Math.round(state.stats.distance / 100) / 10} km`,
        'S — save game    L — load save    H — how to play',
      ], 'Press P to resume · Space to resume', '#4fc3f7');
    } else if (screen === SCREEN_OVER) drawOver(world, state, best);
    else if (screen === SCREEN_HELP) {
      drawPanel('HOW TO PLAY', [
        'WASD / arrows — walk or drive. Shift — sprint. E — get in / out of a car.',
        'Q — punch. X — shoot the pistol (aims where Nia faces).',
        'Steal any car, but the police notice. Wanted stars fade when no cop sees you.',
        'Follow the gold marker: six story jobs, from the Marina to the Solmar Job.',
        'Taxi fares, sun-coins, health / armor / ammo pickups pay off all over the city.',
        'S — save. Your game is saved in this browser only.',
      ], 'Press H or P to go back', '#7ed491');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
