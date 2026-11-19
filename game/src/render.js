// Canvas rendering for Solmar Bay: the city, cars, people, weather, lighting and
// the minimap. All drawing is 2D canvas — no images, no external assets.
import { WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H } from './config.js';
import { districtAt, SEA_X, BEACH_X, SOUTH_BEACH_Y, SOUTH_SEA_Y } from './city.js';
import { clockHours, isNight, isDusk } from './world.js';
import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function viewSize() {
  return { w: VIEW_W, h: VIEW_H };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, world, cam) {
  const { w, h } = viewSize();
  const camX = clamp(cam.x - w / 2, 0, WORLD_W - w);
  const camY = clamp(cam.y - h / 2, 0, WORLD_H - h);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(-camX, -camY);

  drawGround(ctx, world, camX, camY, w, h);
  drawRoads(ctx, camX, camY, w, h);
  drawParks(ctx, world, camX, camY, w, h);
  drawBuildings(ctx, world, camX, camY, w, h);
  drawPalms(ctx, world, camX, camY, w, h);
  drawWaypoint(ctx, world);
  for (const ped of world.peds) drawPed(ctx, ped, camX, camY, w, h);
  for (const t of world.thugs) if (!t.down) drawThug(ctx, t, camX, camY, w, h);
  for (const car of world.cars) drawCar(ctx, car, camX, camY, w, h);
  drawPlayer(ctx, world, camX, camY, w, h);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  drawRain(ctx, world, camX, camY, w, h);
  drawLighting(ctx, world, camX, camY, w, h);
  ctx.restore();
  drawVignette(ctx, world);
}

function inView(x, y, camX, camY, w, h, pad = 120) {
  return x > camX - pad && x < camX + w + pad && y > camY - pad && y < camY + h + pad;
}

function drawGround(ctx, world, camX, camY, w, h) {
  // Base grass/concrete, then district tints in big blocks.
  ctx.fillStyle = '#5d6b4a';
  ctx.fillRect(camX, camY, w, h);
  for (const d of world.city.landmarks) { /* landmarks drawn with their district */ }
  // District ground blocks.
  for (const d of [
    { x: 80, y: 80, w: 760, h: 700, c: '#6f6a55' },
    { x: 900, y: 80, w: 1400, h: 700, c: '#5d6b52' },
    { x: 2400, y: 80, w: 520, h: 700, c: '#5e7a6a' },
    { x: 2400, y: 1500, w: 520, h: 520, c: '#c2a878' },
    { x: 80, y: 1500, w: 760, h: 520, c: '#6d6a5c' },
    { x: 900, y: 1500, w: 1400, h: 520, c: '#59704a' },
    { x: 900, y: 820, w: 1400, h: 640, c: '#5c7a4e' },
  ]) {
    if (!inView(d.x + d.w / 2, d.y + d.h / 2, camX, camY, w, h, 400)) continue;
    ctx.fillStyle = d.c;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Sea (east) and south water, with a couple of wave lines.
  ctx.fillStyle = '#2a6d8a';
  ctx.fillRect(SEA_X, camY, WORLD_W - SEA_X, h);
  ctx.fillRect(camX, SOUTH_SEA_Y, w, WORLD_H - SOUTH_SEA_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(camY / 46) * 46; y < camY + h; y += 46) {
    ctx.beginPath();
    ctx.moveTo(SEA_X + 8, y);
    ctx.lineTo(SEA_X + 60, y + 8);
    ctx.stroke();
  }
  // Sand.
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(BEACH_X, camY, SEA_X - BEACH_X, h);
  ctx.fillRect(camX, SOUTH_BEACH_Y, w, SOUTH_SEA_Y - SOUTH_BEACH_Y);
}

function drawRoads(ctx, camX, camY, w, h) {
  ctx.fillStyle = '#33363d';
  for (const rx of ROADS_V) {
    if (rx < camX - 80 || rx > camX + w + 80) continue;
    ctx.fillRect(rx - ROAD_W / 2, camY, ROAD_W, h);
  }
  for (const ry of ROADS_H) {
    if (ry < camY - 80 || ry > camY + h + 80) continue;
    ctx.fillRect(camX, ry - ROAD_W / 2, w, ROAD_W);
  }
  // Centre dashes.
  ctx.strokeStyle = '#e8d44f';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of ROADS_V) {
    if (rx < camX - 80 || rx > camX + w + 80) continue;
    ctx.beginPath();
    ctx.moveTo(rx, camY);
    ctx.lineTo(rx, camY + h);
    ctx.stroke();
  }
  for (const ry of ROADS_H) {
    if (ry < camY - 80 || ry > camY + h + 80) continue;
    ctx.beginPath();
    ctx.moveTo(camX, ry);
    ctx.lineTo(camX + w, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(220,220,210,0.5)';
  ctx.lineWidth = 4;
  for (const rx of ROADS_V) {
    if (rx < camX - 80 || rx > camX + w + 80) continue;
    ctx.beginPath();
    ctx.moveTo(rx - ROAD_W / 2 - 7, camY);
    ctx.lineTo(rx - ROAD_W / 2 - 7, camY + h);
    ctx.moveTo(rx + ROAD_W / 2 + 7, camY);
    ctx.lineTo(rx + ROAD_W / 2 + 7, camY + h);
    ctx.stroke();
  }
  for (const ry of ROADS_H) {
    if (ry < camY - 80 || ry > camY + h + 80) continue;
    ctx.beginPath();
    ctx.moveTo(camX, ry - ROAD_W / 2 - 7);
    ctx.lineTo(camX + w, ry - ROAD_W / 2 - 7);
    ctx.moveTo(camX, ry + ROAD_W / 2 + 7);
    ctx.lineTo(camX + w, ry + ROAD_W / 2 + 7);
    ctx.stroke();
  }
}

function drawParks(ctx, world, camX, camY, w, h) {
  for (const park of world.city.parks) {
    if (!inView(park.x + park.w / 2, park.y + park.h / 2, camX, camY, w, h, 100)) continue;
    ctx.fillStyle = '#4d7a3f';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#3c6332';
    for (let i = 0; i < park.trees; i++) {
      const tx = park.x + ((i * 53 + 31) % Math.max(40, park.w - 20));
      const ty = park.y + ((i * 97 + 17) % Math.max(40, park.h - 20));
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // A pond in the big park.
    if (park.w > 200 && park.h > 150) {
      ctx.fillStyle = '#3a7d9e';
      ctx.beginPath();
      ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, 42, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, world, camX, camY, w, h) {
  for (const b of world.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, camX, camY, w, h, 80)) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255, 240, 180, 0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.seed) % 5 === 0) continue;
        ctx.fillRect(b.x + 12 + i * 34, b.y + 11 + j * 30, 12, 9);
      }
    }
    if (b.tall) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    }
  }
}

function drawPalms(ctx, world, camX, camY, w, h) {
  for (const palm of world.city.palms) {
    if (!inView(palm.x, palm.y, camX, camY, w, h, 40)) continue;
    ctx.strokeStyle = '#7a5c33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y + 8);
    ctx.lineTo(palm.x, palm.y - 8);
    ctx.stroke();
    ctx.fillStyle = '#3f8a3f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      ctx.beginPath();
      ctx.ellipse(palm.x + Math.cos(a) * 10, palm.y - 8 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWaypoint(ctx, world) {
  const m = world.mission;
  if (!m) return;
  const t = m.target;
  ctx.save();
  ctx.translate(t.x, t.y);
  const pulse = 1 + Math.sin(world.time * 4) * 0.12;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd23e';
  ctx.strokeStyle = '#7a5c00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(18, 6);
  ctx.lineTo(-18, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,62,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 34, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCar(ctx, car, camX, camY, w, h) {
  if (!inView(car.x, car.y, camX, camY, w, h, 80)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
  ctx.fill();
  // Damage: scorch marks grow with damage.
  if (car.damage > 25) {
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    rr(ctx, -car.len / 2, -car.wid / 2, car.len * (car.damage / 130), car.wid, 8);
    ctx.fill();
  }
  if (car.damage > 70) {
    ctx.fillStyle = 'rgba(255,120,40,0.8)';
    ctx.beginPath();
    ctx.arc(-car.len / 4, 0, 4 + Math.sin(Date.now() / 90) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Windshield + roof.
  ctx.fillStyle = '#bfe3ee';
  ctx.fillRect(-car.len / 2 + 10, -car.wid / 2 + 3, 12, car.wid - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-4, -car.wid / 2 + 3, car.len / 2 - 10, car.wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 8, 3, 5);
  // Police livery and light bar.
  if (car.police) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2, car.len - 8, 5);
    ctx.fillRect(-car.len / 2 + 4, car.wid / 2 - 5, car.len - 8, 5);
    const blink = Math.floor(Date.now() / 220) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-6, -car.wid / 2 - 2, 6, 5);
    ctx.fillStyle = blink ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(0, -car.wid / 2 - 2, 6, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, world, camX, camY, w, h) {
  const p = world.player;
  if (p.dead || !inView(p.x, p.y, camX, camY, w, h, 60)) return;
  if (!p.onFoot) return; // the car drawing shows the player when driving
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nia: teal jacket, dark hair.
  ctx.fillStyle = '#0f8a8a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(-3, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand.
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2, 9, 4);
  ctx.restore();
  // Health ring when hurt.
  if (world.health < 55) {
    ctx.strokeStyle = 'rgba(255,60,60,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPed(ctx, ped, camX, camY, w, h) {
  if (!inView(ped.x, ped.y, camX, camY, w, h, 40)) return;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.panic > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -14);
  }
  ctx.restore();
}

function drawThug(ctx, t, camX, camY, w, h) {
  if (!inView(t.x, t.y, camX, camY, w, h, 40)) return;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.fillStyle = '#8a2f2f';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(-2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(7, -2, 10, 4);
  ctx.restore();
  // Health bar.
  ctx.fillStyle = '#111';
  ctx.fillRect(t.x - 14, t.y - 22, 28, 5);
  ctx.fillStyle = '#e33';
  ctx.fillRect(t.x - 14, t.y - 22, 28 * (t.health / 100), 5);
}

function drawBullets(ctx, world) {
  ctx.fillStyle = '#ffe66d';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawRain(ctx, world, camX, camY, w, h) {
  if (world.rain < 0.05) return;
  ctx.strokeStyle = `rgba(180,200,220,${0.35 * world.rain})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const n = Math.floor(70 * world.rain);
  for (let i = 0; i < n; i++) {
    const x = camX + ((i * 173 + 41) % w);
    const y = camY + ((i * 311 + 97) % h);
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 14);
  }
  ctx.stroke();
}

function drawLighting(ctx, world, camX, camY, w, h) {
  const hour = clockHours(world);
  if (isNight(world)) {
    ctx.fillStyle = 'rgba(8,12,40,0.42)';
    ctx.fillRect(camX, camY, w, h);
  } else if (isDusk(world)) {
    const duskiness = hour >= 17 ? (hour - 17) / 2 : (7.5 - hour) / 1.5;
    ctx.fillStyle = `rgba(255,120,40,${0.14 * Math.min(1, duskiness)})`;
    ctx.fillRect(camX, camY, w, h);
  }
  if (world.rain > 0.1) {
    ctx.fillStyle = `rgba(60,80,110,${0.10 * world.rain})`;
    ctx.fillRect(camX, camY, w, h);
  }
}

function drawVignette(ctx, world) {
  const { w, h } = viewSize();
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// --- minimap ---------------------------------------------------------------

export function drawMinimap(ctx, world, x, y, mw, mh) {
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.fillRect(0, 0, mw, mh);
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
  // Sea.
  ctx.fillStyle = '#2a6d8a';
  ctx.fillRect(SEA_X * sx, 0, mw - SEA_X * sx, mh);
  // Roads.
  ctx.fillStyle = '#9a9a92';
  for (const rx of ROADS_V) ctx.fillRect(rx * sx - 1, 0, 2, mh);
  for (const ry of ROADS_H) ctx.fillRect(0, ry * sy - 1, mw, 2);
  // Mission marker.
  if (world.mission) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(world.mission.target.x * sx, world.mission.target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#3a7bff';
  for (const cop of world.cops) {
    ctx.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(p.x * sx, p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// --- sky tint helper for HUD text ------------------------------------------

export function timeLabel(world) {
  const hour = Math.floor(clockHours(world));
  const min = Math.floor((clockHours(world) - hour) * 60);
  const hh = String(hour).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  const daypart = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 19 ? 'Sunset' : 'Night';
  return `${hh}:${mm} · Day ${world.day} · ${daypart}`;
}
