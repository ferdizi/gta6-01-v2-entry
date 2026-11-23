/* Laguna Azul — the city: lagoon, marina, causeway, terracotta rooftops, palms. */
'use strict';
const World = {
  scene: null, colliders: [], buildings: [], palms: [], boats: [],
  waterZone: { x0: -560, x1: -196, z0: -560, z1: 560 },   // lagoon, west
  shallows: { x0: -230, x1: -150, z0: -40, z1: 150 },     // marina shallows: breaks police line of sight
  causeway: { z: -150, x0: -560, x1: -150 },              // bridge over the lagoon
  ramps: [], trafficPaths: [],
  districts(x, z) {
    if (x < -150) return 'MARINA DISTRICT';
    if (z < -120) return 'OLD TOWN';
    if (x > 90 && z > 60) return 'MERCADO VIEJO';
    if (Math.abs(x) < 60 && Math.abs(z) < 60) return 'PLAZA AZUL';
    if (z > 150) return 'SOUTH BEACH';
    return 'BARRIO ALTO';
  },
  standingFor(x, z) {
    const d = this.districts(x, z);
    return { 'MARINA DISTRICT': 'RESPECTED ★★★', 'OLD TOWN': 'KNOWN ★★☆', 'MERCADO VIEJO': 'FEARED ★★★★',
      'PLAZA AZUL': 'LEGEND ★★★★★', 'SOUTH BEACH': 'LIKED ★★☆', 'BARRIO ALTO': 'KNOWN ★★☆' }[d];
  },
  isWater(x, z) {
    const w = this.waterZone;
    if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) return false;
    // the causeway deck crosses the lagoon
    if (Math.abs(z - this.causeway.z) < 9 && x >= this.causeway.x0 && x <= this.causeway.x1) return false;
    return true;
  },
  collide(x, z, r) {
    // returns push-out correction {x, z} or null
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        return { x: nx + (dx / d) * r, z: nz + (dz / d) * r };
      }
    }
    return null;
  },
  inShallows(x, z) {
    const s = this.shallows;
    return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;
  },
};

function makeFacadeTexture(base, lit) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 2);
  for (let y = 16; y < 256; y += 32) {
    for (let x = 12; x < 128; x += 28) {
      g.fillStyle = lit ? '#ffd98a' : '#2c3550';
      g.fillRect(x, y, 16, 20);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 16, 3);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWorld(scene, rng) {
  World.scene = scene;
  // ---- golden-hour light ----
  scene.background = new THREE.Color(0xff8f5e);
  scene.fog = new THREE.Fog(0xf78d5f, 180, 620);
  const hemi = new THREE.HemisphereLight(0xffc890, 0x3a2a4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
  sun.position.set(-220, 90, -140);
  scene.add(sun);
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  sunBall.position.set(-420, 62, -260);
  scene.add(sunBall);
  // pink clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffc2d6, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 18, 42), 10, 8), cloudMat);
    c.scale.y = 0.32;
    c.position.set(range(rng, -420, 420), range(rng, 120, 190), range(rng, -420, -80));
    scene.add(c);
  }

  // ---- ground: sand + grass + lagoon water ----
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: 0xd9b380 }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.05; scene.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(380, 1200),
    new THREE.MeshLambertMaterial({ color: 0x1fb6c9, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-380, 0.25, 0);
  scene.add(water);
  World.waterMesh = water;
  // beach strip
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, 1200),
    new THREE.MeshLambertMaterial({ color: 0xeed3a0 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-172, 0.02, 0); scene.add(beach);

  // ---- roads (grid every 60) ----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2a33 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
  const coords = [-180, -120, -60, 0, 60, 120, 180];
  for (const c of coords) {
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(10, 420), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.set(c, 0.06, 0); scene.add(r1);
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(420, 10), roadMat);
    r2.rotation.x = -Math.PI / 2; r2.position.set(0, 0.06, c); scene.add(r2);
    for (let d = -195; d <= 195; d += 15) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 4), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.08, d); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.08, c); scene.add(dash2);
    }
  }
  // traffic loops along the grid roads
  World.trafficPaths = coords.map(c => ({ axis: 'z', at: c, from: -200, to: 200 }))
    .concat(coords.map(c => ({ axis: 'x', at: c, from: -200, to: 200 })));

  // ---- buildings: pastel walls, terracotta pyramid roofs, lit windows ----
  const palette = ['#f2c14e', '#e88ca0', '#8fc7e8', '#a8d5a2', '#f5e6c8', '#e8a06a', '#c9a7e8'];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb5502e });
  const roofMat2 = new THREE.MeshLambertMaterial({ color: 0x8a3b22 });
  const texCache = {};
  const facade = (color) => {
    if (!texCache[color]) texCache[color] = makeFacadeTexture(color, true);
    return texCache[color];
  };
  const blocks = [];
  for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
    if (gx === 0 && gz === 0) continue; // plaza
    blocks.push([gx * 60 + 30, gz * 60 + 30]);
  }
  for (const [bx, bz] of blocks) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const w = range(rng, 14, 22), d = range(rng, 14, 22), h = range(rng, 9, 30);
      const ox = bx + (i === 0 ? -8 : 10) + range(rng, -3, 3);
      const oz = bz + range(rng, -8, 8);
      const color = pick(rng, palette);
      const mat = new THREE.MeshLambertMaterial({ map: facade(color) });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(ox, h / 2, oz);
      scene.add(b);
      World.buildings.push(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, range(rng, 3, 6), 4),
        rng() > 0.5 ? roofMat : roofMat2);
      roof.position.set(ox, h + 2, oz);
      roof.rotation.y = Math.PI / 4;
      scene.add(roof);
      World.colliders.push({ x0: ox - w / 2 - 0.4, x1: ox + w / 2 + 0.4, z0: oz - d / 2 - 0.4, z1: oz + d / 2 + 0.4 });
    }
  }
  // landmark: Azul National Bank (tall, marble + gold dome) at plaza north
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xf5eeda });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(34, 26, 24), bankMat);
  bank.position.set(0, 13, -96); scene.add(bank);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x664411 }));
  dome.position.set(0, 26, -96); scene.add(dome);
  const bankSign = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 1),
    new THREE.MeshBasicMaterial({ color: 0x1c4d8f }));
  bankSign.position.set(0, 20, -83.5); scene.add(bankSign);
  World.colliders.push({ x0: -18, x1: 18, z0: -109, z1: -83 });
  World.bankPos = { x: 0, z: -70 };

  // ---- palms along every road ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = range(rng, -0.08, 0.08);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.6, 4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      f.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      f.scale.set(1, 1, 0.28);
      g.add(f);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    World.palms.push(g);
  }
  for (const c of coords) {
    for (let d = -190; d <= 190; d += 38) {
      if (rng() < 0.75) palm(c + 8, d + range(rng, -4, 4));
      if (rng() < 0.6) palm(c - 8, d + 18 + range(rng, -4, 4));
    }
  }
  // beach palms
  for (let z = -200; z <= 200; z += 30) palm(-158 + range(rng, -4, 4), z);

  // ---- marina: docks + boats on the lagoon edge ----
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5a36 });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 4), dockMat);
    dock.position.set(-205, 0.6, -60 + i * 55);
    scene.add(dock);
  }
  const boatColors = [0xffffff, 0xff5e7a, 0x3fa9f5, 0xffd23c];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, boatColors) }));
    hull.position.y = 0.8; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cab.position.set(-0.5, 2.4, 0); g.add(cab);
    g.position.set(-225 - rng() * 40, 0.2, -80 + i * 42 + range(rng, -6, 6));
    g.rotation.y = range(rng, -0.2, 0.2);
    scene.add(g);
    World.boats.push(g);
  }

  // ---- causeway bridge over the lagoon (z = -150) ----
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x4a4550 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(410, 0.7, 16), deckMat);
  deck.position.set(-355, 0.35, -150); scene.add(deck);
  const railMat = new THREE.MeshLambertMaterial({ color: 0xffd23c });
  for (const dz of [-7.4, 7.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(410, 1, 0.5), railMat);
    rail.position.set(-355, 1.5, -150 + dz); scene.add(rail);
  }
  for (let x = -540; x <= -170; x += 46) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 12),
      new THREE.MeshLambertMaterial({ color: 0x6a656e }));
    pillar.position.set(x, -1, -150); scene.add(pillar);
  }

  // ---- stunt ramps ----
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xff9a3c });
  function ramp(x, z, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 10), rampMat);
    m.position.set(x, 0.9, z); m.rotation.y = ry; m.rotation.x = -0.42;
    scene.add(m);
    World.ramps.push({ x, z, ry });
  }
  ramp(-140, 120, Math.PI / 2);
  ramp(120, -140, 0);

  // plaza fountain
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.4, 16),
    new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }));
  fountain.position.set(0, 0.7, 0); scene.add(fountain);
  const fwater = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.4, 16),
    new THREE.MeshLambertMaterial({ color: 0x1fb6c9 }));
  fwater.position.set(0, 1.5, 0); scene.add(fwater);
  World.colliders.push({ x0: -8, x1: 8, z0: -8, z1: 8 });

  return World;
}
