/* Laguna Azul — dense HUD: mission panel, dispatch, minimap, vitals, dialogue, speedo. */
'use strict';
const HUD = {
  els: {},
  init() {
    const ids = ['mp-num', 'mp-name', 'mp-stage-fill', 'mp-stage-label', 'mp-objective', 'mp-next',
      'dp-rows', 'dp-count', 'cash-val', 'stars', 'clock', 'air-banner', 'sight-banner',
      'health-fill', 'health-num', 'armour-fill', 'armour-num', 'location', 'standing',
      'dlg-line', 'speed-val', 'vehicle-name', 'vehicle-cond', 'radio', 'toast', 'bonus-pop',
      'wanted-flash', 'crosshair', 'cd-rio', 'cd-luz', 'cd-marco', 'ammo-pistol'];
    for (const id of ids) this.els[id] = document.getElementById(id);
    this.mm = document.getElementById('minimap');
    this.mmCtx = this.mm.getContext('2d');
  },
  setMission(m) {
    this.els['mp-num'].textContent = 'MISSION ' + m.n + '/10';
    this.els['mp-name'].textContent = m.name;
    const stageN = parseInt(m.stage.split('/')[0].replace(/\D/g, ''), 10) || 1;
    this.els['mp-stage-fill'].style.width = (stageN / 4 * 100) + '%';
    this.els['mp-stage-label'].textContent = m.stage;
    this.els['mp-objective'].textContent = '▶ ' + m.objective;
    this.els['mp-next'].textContent = m.next;
    document.querySelector('.dlg-name').innerHTML = m.who + ' <span>— ' + m.role + '</span>';
    this.els['dlg-line'].textContent = m.line;
    const faces = { LUZ: '👩', MARCO: '🧔', RIO: '😎' };
    document.querySelector('.dlg-face').textContent = faces[m.who] || '👩';
  },
  setDispatch(units) {
    this.els['dp-count'].textContent = units.length + ' UNITS';
    let html = '';
    for (const u of units.slice(0, 6)) {
      html += '<div class="dp-row"><b>' + u.unit.name + '</b><span class="role">' + u.unit.role +
        '</span><span class="dist">' + Math.round(u.dist || 0) + 'm</span></div>';
    }
    this.els['dp-rows'].innerHTML = html || '<div class="dp-row"><b>NO UNITS</b><span class="role">CLEAR</span><span class="dist">—</span></div>';
  },
  setWanted(stars) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= stars ? '★' : '<span class="off">★</span>';
    this.els.stars.innerHTML = s;
    this.els['air-banner'].style.display = stars >= 4 ? 'inline-block' : 'none';
    this.els['sight-banner'].style.display = stars >= 3 ? 'inline-block' : 'none';
  },
  setCash(v) { this.els['cash-val'].textContent = v.toLocaleString('en-US'); },
  setClock(h, m, day) {
    this.els.clock.innerHTML = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' <span id="day">' + day + '</span>';
  },
  setVitals(health, armour, x, z) {
    this.els['health-fill'].style.width = health + '%';
    this.els['health-num'].textContent = Math.round(health);
    this.els['armour-fill'].style.width = armour + '%';
    this.els['armour-num'].textContent = Math.round(armour);
    this.els.location.innerHTML = '📍 ' + World.districts(x, z) + ' — <span id="standing">' + World.standingFor(x, z) + '</span>';
  },
  setSpeed(mph, vehicle, cond) {
    this.els['speed-val'].textContent = Math.round(mph);
    this.els['vehicle-name'].textContent = vehicle;
    this.els['vehicle-cond'].textContent = 'CONDITION ' + Math.round(cond) + '% · FUEL ⛽ 78%';
  },
  setAmmo(n) { this.els['ammo-pistol'].textContent = n; },
  toast(text, ms) {
    this.els.toast.textContent = text;
    setTimeout(() => { if (this.els.toast.textContent === text) this.els.toast.textContent = ''; }, ms || 2600);
  },
  bonus(text) {
    this.els['bonus-pop'].textContent = text;
    setTimeout(() => { this.els['bonus-pop'].textContent = ''; }, 1800);
  },
  flashWanted(text) {
    const el = this.els['wanted-flash'];
    el.textContent = text; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3200);
  },
  setCooldown(who, text, ready) {
    const el = this.els['cd-' + who];
    if (el) { el.textContent = text; el.style.color = ready ? '#4dff7a' : '#ffb84d'; }
  },
  drawMinimap(px, pz, heading, target, traffic, police, heli) {
    const c = this.mmCtx, S = 180, R = 260;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.clip();
    // water + land
    c.fillStyle = '#0e2a3a'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#274b2f'; c.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x - px) / R * (S / 2), S / 2 + (z - pz) / R * (S / 2)];
    // lagoon
    const [wx] = toMap(-196, 0);
    c.fillStyle = '#1fb6c9'; c.fillRect(0, 0, wx, S);
    // roads
    c.strokeStyle = '#5a5a66'; c.lineWidth = 3;
    for (const cc of [-180, -120, -60, 0, 60, 120, 180]) {
      const [ax] = toMap(cc, 0); const [, bz] = toMap(0, cc);
      c.beginPath(); c.moveTo(ax, -10); c.lineTo(ax, S + 10); c.stroke();
      c.beginPath(); c.moveTo(-10, bz); c.lineTo(S + 10, bz); c.stroke();
    }
    // causeway
    const [cx1, cy] = toMap(-560, -150); const [cx2] = toMap(-150, -150);
    c.strokeStyle = '#ffd23c'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx1, cy); c.lineTo(cx2, cy); c.stroke();
    // mission target
    if (target) {
      const [tx, ty] = toMap(target.x, target.z);
      c.fillStyle = '#ffd23c';
      c.beginPath(); c.arc(tx, ty, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    }
    // traffic (white), police (blue/red), heli (yellow)
    c.fillStyle = '#ffffff';
    for (const t of traffic) { const [x, y] = toMap(t.mesh.position.x, t.mesh.position.z); c.fillRect(x - 1.5, y - 1.5, 3, 3); }
    for (const p of police) {
      const [x, y] = toMap(p.x, p.z);
      c.fillStyle = '#3fa9f5'; c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill();
    }
    if (heli) {
      const [x, y] = toMap(heli.position.x, heli.position.z);
      c.fillStyle = '#ffd23c'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
    }
    // player arrow (north-up relative to heading)
    c.save();
    c.translate(S / 2, S / 2); c.rotate(-heading + Math.PI / 2);
    c.fillStyle = '#4dff7a';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.restore();
    // ring
    c.strokeStyle = 'rgba(255,184,77,.9)'; c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); c.stroke();
  },
};
