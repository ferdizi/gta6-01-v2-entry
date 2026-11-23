/* Laguna Azul v2 — vehicles, foot traffic, Azul PD pursuit, helicopter, blasts.
   Rewritten for the fix session: PD livery now reads at a glance (white doors
   + AZUL PD decals + split red/blue bar), the heli is a real helicopter
   (glass canopy, skids, tail fin, spinning disc), and explosions are bigger,
   brighter and longer-lived so they punch through the golden-hour haze. */
'use strict';

/* ---- catalogues ---- */
const VEHICLE_MODELS = [
  { name: 'VULCAR NEBULA GT', color: 0xff5e3a, top: 42, accel: 26 },
  { name: 'AZUL TAXI CAB', color: 0xffd23c, top: 30, accel: 18 },
  { name: 'MARISOL SEDAN', color: 0x3fa9f5, top: 33, accel: 20 },
  { name: 'PLAYA PICKUP', color: 0x7dff9e, top: 31, accel: 19 },
  { name: 'CORAL COUPE', color: 0xc65b7c, top: 38, accel: 23 },
  { name: 'AZUL PD CRUISER', color: 0x1c4d8f, top: 40, accel: 25 },
];
const WALKER_NAMES = ['MARÍA', 'CARLOS', 'SOFÍA', 'DIEGO', 'LUCÍA', 'JORGE', 'ELENA', 'PABLO'];
const PD_UNITS = [
  { name: 'UNIT 7 — RAMÍREZ', role: 'RAMMING' }, { name: 'UNIT 12 — ORTEGA', role: 'FLANKING' },
  { name: 'UNIT 3 — VEGA', role: 'MARKSMAN' }, { name: 'UNIT 9 — SOLÍS', role: 'SPOTLIGHT' },
  { name: 'UNIT 21 — FUENTES', role: 'RAMMING' }, { name: 'UNIT 5 — DELGADO', role: 'FLANKING' },
  { name: 'UNIT 14 — MARÍN', role: 'ROADBLOCK' }, { name: 'UNIT 30 — REYES', role: 'PURSUIT' },
];

/* ---- mesh builders ---- */

/* Canvas decal that reads "AZUL PD" — stuck on both doors of every cruiser. */
function makeDoorDecal() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#1c4d8f';
  g.font = 'bold 34px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AZUL PD', 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let doorDecalTex = null;

function buildCarMesh(model) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x182430 });
  const isPD = model.name.indexOf('PD') !== -1;

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 2.1), paint);
  body.position.y = 0.75; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.9), glass);
  cabin.position.set(-0.2, 1.6, 0); g.add(cabin);

  /* PD livery: white door band + AZUL PD decal on each flank. */
  if (isPD) {
    if (!doorDecalTex) doorDecalTex = makeDoorDecal();
    const bandMat = new THREE.MeshLambertMaterial({ color: 0xf4f6fa });
    for (const side of [1, -1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.06), bandMat);
      band.position.set(0.1, 0.85, side * 1.06); g.add(band);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5),
        new THREE.MeshBasicMaterial({ map: doorDecalTex }));
      decal.position.set(0.1, 0.88, side * 1.1);
      decal.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(decal);
    }
  }

  if (isPD) {
    /* white roof panel: from the chase camera (above-behind) the white
       roof is what marks a cruiser at a glance. */
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xf4f6fa });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.7), roofMat);
    roof.position.set(-0.2, 1.98, 0); g.add(roof);
  }

  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 1.05], [1.5, -1.05], [-1.5, 1.05], [-1.5, -1.05]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), tyreMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  /* headlights + taillights */
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
  beam.position.set(2.32, 0.85, 0); g.add(beam);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tail.position.set(-2.32, 0.85, 0); g.add(tail);

  if (isPD) {
    /* split light bar: red on the left half, blue on the right. */
    const redHalf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    redHalf.position.set(-0.2, 2.22, 0.26); g.add(redHalf);
    const blueHalf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blueHalf.position.set(-0.2, 2.22, -0.26); g.add(blueHalf);
    g.userData.lightbar = [redHalf, blueHalf];
  }
  g.userData.wheels = wheels;
  return g;
}

function buildPedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, [0xff8a5c, 0x5cb8ff, 0x8dff7a, 0xffd23c, 0xe88ca0, 0xffffff]) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a30]) });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), shirt);
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.9; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
    leg.position.set(0, 0.35, s * 0.16); g.add(leg);
  }
  return g;
}

/* ---- the entity registry ---- */
const Entities = {
  traffic: [], peds: [], police: [], roadblocks: [], explosions: [],
  heli: null, heliLight: null,

  /* ---- spawning ---- */
  spawnTraffic(scene, rng, n) {
    for (let i = 0; i < n; i++) {
      const path = pick(rng, World.trafficPaths);
      const model = pick(rng, VEHICLE_MODELS.filter(m => m.name.indexOf('PD') === -1));
      const mesh = buildCarMesh(model);
      scene.add(mesh);
      this.traffic.push({
        mesh, model, path,
        s: range(rng, path.from, path.to),
        speed: range(rng, 7, 13) * (rng() > 0.5 ? 1 : -1),
        lane: range(rng, -2.4, 2.4),
      });
    }
  },

  spawnPeds(scene, rng, n) {
    for (let i = 0; i < n; i++) {
      const mesh = buildPedMesh(rng);
      scene.add(mesh);
      this.peds.push({
        mesh, name: pick(rng, WALKER_NAMES),
        x: range(rng, -180, 190), z: range(rng, -180, 190),
        heading: rng() * Math.PI * 2, speed: range(rng, 1.2, 2.6),
        panic: 0, phase: rng() * Math.PI * 2,
      });
    }
  },

  spawnPolice(scene, count) {
    for (const p of this.police) scene.remove(p.mesh);
    this.police = [];
    for (let i = 0; i < count; i++) {
      const unit = PD_UNITS[i % PD_UNITS.length];
      const mesh = buildCarMesh(VEHICLE_MODELS[5]);
      scene.add(mesh);
      this.police.push({
        mesh, model: VEHICLE_MODELS[5], unit,
        x: 0, z: 0, heading: 0, speed: 0,
        state: 'chase', stuck: 0,
      });
    }
    this.clearRoadblocks(scene);
  },

  /* Remove every roadblock — mesh AND its collider — so a respawned
     pursuit never leaves an invisible wall behind. */
  clearRoadblocks(scene) {
    for (const r of this.roadblocks) {
      scene.remove(r.mesh);
      const ci = World.colliders.indexOf(r.col);
      if (ci !== -1) World.colliders.splice(ci, 1);
    }
    this.roadblocks = [];
  },

  spawnRoadblock(scene, x, z, heading) {
    const g = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const car = buildCarMesh(VEHICLE_MODELS[5]);
      car.position.set(i * 5.2, 0, (i % 2) * 1.2);
      car.rotation.y = (i % 2) * 0.25;
      g.add(car);
    }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 0.6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    barrier.position.set(0, 0.9, 3.4); g.add(barrier);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 0.62),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    stripe.position.set(0, 1.15, 3.4); g.add(stripe);
    g.position.set(x, 0, z); g.rotation.y = heading;
    scene.add(g);
    const col = { x0: x - 8, x1: x + 8, z0: z - 3, z1: z + 3 };
    this.roadblocks.push({ mesh: g, x, z, col });
    World.colliders.push(col);
  },

  spawnHeli(scene) {
    if (this.heli) return;
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c4d8f });
    const white = new THREE.MeshLambertMaterial({ color: 0xf4f6fa });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
    /* fuselage: navy belly, white stripe, glass canopy up front */
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 2.2), navy);
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.5, 2.25), white);
    stripe.position.y = 0.25; g.add(stripe);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.0), glass);
    canopy.position.set(2.1, 0.55, 0); g.add(canopy);
    /* tail boom + fin + tail rotor so the silhouette reads at a glance */
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 0.6), navy);
    tail.position.set(-4.2, 0.4, 0); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.15), navy);
    fin.position.set(-6.2, 1.1, 0); g.add(fin);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    tailRotor.position.set(-6.4, 0.5, 0.4); g.add(tailRotor);
    g.userData.tailRotor = tailRotor;
    /* skids */
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.14), skidMat);
      skid.position.set(0, -1.35, s * 1.05); g.add(skid);
      for (const sx of [-1.4, 1.4]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), skidMat);
        strut.position.set(sx, -1.1, s * 1.05); g.add(strut);
      }
    }
    /* main rotor: crossed blades + a translucent spin disc */
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const rotor = new THREE.Group();
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.5), rotorMat);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 12), rotorMat);
    rotor.add(bladeA); rotor.add(bladeB);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 24),
      new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06;
    rotor.add(disc);
    rotor.position.y = 1.5;
    g.add(rotor);
    g.userData.rotor = rotor;
    /* searchlight + red beacon */
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
    lamp.position.set(1.5, -1.1, 0); g.add(lamp);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(-1.5, 1.15, 0); g.add(beacon);
    g.userData.beacon = beacon;
    const spot = new THREE.SpotLight(0xfff2b0, 900, 120, 0.32, 0.5, 1.2);
    spot.position.set(1.5, -1, 0);
    g.add(spot); g.add(spot.target);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 11, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = Math.PI; cone.position.y = -5.5;
    g.add(cone);
    this.heliLight = spot;
    this.heli = g;
    g.scale.setScalar(1.45);
    g.position.set(0, 46, 0);
    scene.add(g);
  },

  removeHeli(scene) {
    if (!this.heli) return;
    scene.remove(this.heli);
    this.heli = null; this.heliLight = null;
  },

  /* ---- explosions: white-hot core, orange shell, smoke column, ground ring.
     Kept compact on purpose: a fireball that fills the frame reads as a
     balloon, not a blast. ---- */
  explode(scene, x, y, z) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe95e }));
    core.scale.y = 0.75; g.add(core);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.95 }));
    mid.scale.y = 0.8; g.add(mid);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff2a00, transparent: true, opacity: 0.5 }));
    shell.scale.y = 0.8; g.add(shell);
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(3.8, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55 }));
    smoke.position.y = 4; g.add(smoke);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 5.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
    g.position.set(x, y, z);
    scene.add(g);
    const light = new THREE.PointLight(0xff8a2a, 500, 60, 1.4);
    light.position.set(x, y + 4, z);
    scene.add(light);
    this.explosions.push({ mesh: g, light, t: 0 });
    AudioSys.explosion();
  },

  updateExplosions(dt) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.t += dt;
      const s = 1 + e.t * 0.8;
      e.mesh.scale.set(s, s * 0.85, s);
      /* fade slowly on purpose: a fireball that goes pale mid-life reads
         as a balloon in the cover frame, so the orange stays vivid. */
      e.mesh.children[1].material.opacity = Math.max(0, 0.95 - e.t * 0.55);
      e.mesh.children[2].material.opacity = Math.max(0, 0.5 - e.t * 0.3);
      e.mesh.children[3].position.y = 4 + e.t * 7;
      e.mesh.children[3].material.opacity = Math.max(0, 0.55 - e.t * 0.5);
      e.mesh.children[4].material.opacity = Math.max(0, 0.8 - e.t * 1.0);
      e.light.intensity = Math.max(0, 500 - e.t * 500);
      if (e.t > 1.0) {
        World.scene.remove(e.mesh); World.scene.remove(e.light);
        this.explosions.splice(i, 1);
      }
    }
  },

  /* ---- per-frame updates ---- */
  updateTraffic(dt, playerPos) {
    for (const c of this.traffic) {
      c.s += c.speed * dt;
      if (c.s > 205) c.s = -205;
      if (c.s < -205) c.s = 205;
      const p = c.path;
      let x, z, heading;
      if (p.axis === 'z') { x = p.at + c.lane; z = c.s; heading = c.speed > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { x = c.s; z = p.at + c.lane; heading = c.speed > 0 ? 0 : Math.PI; }
      c.mesh.position.set(x, 0, z);
      c.mesh.rotation.y = -heading;
      for (const w of c.mesh.userData.wheels) w.rotation.z += c.speed * dt * 2;
      /* near-miss bonus: player car passes close at speed */
      if (playerPos && playerPos.inCar && playerPos.speed > 18) {
        const d2 = dist2(x, z, playerPos.x, playerPos.z);
        if (d2 < 30 && !c.nearMissed) {
          c.nearMissed = true;
          if (window.Game) window.Game.nearMiss();
        }
      } else if (c.nearMissed) {
        const d2 = dist2(x, z, playerPos ? playerPos.x : 9999, playerPos ? playerPos.z : 9999);
        if (d2 > 400) c.nearMissed = false;
      }
    }
  },

  updatePeds(dt, playerPos) {
    for (const p of this.peds) {
      p.phase += dt * 6;
      const panic = playerPos && playerPos.wanted >= 3 && dist2(p.x, p.z, playerPos.x, playerPos.z) < 2500;
      const sp = panic ? p.speed * 3.2 : p.speed;
      p.x += Math.cos(p.heading) * sp * dt;
      p.z += Math.sin(p.heading) * sp * dt;
      if (Math.random() < dt * 0.12) p.heading += range(Math.random, -1, 1);
      if (p.x < -190 || p.x > 200 || p.z < -190 || p.z > 200) p.heading += Math.PI;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading + Math.PI / 2;
      p.mesh.position.y = Math.abs(Math.sin(p.phase)) * 0.08;
    }
  },

  updatePolice(dt, playerPos, inShallows) {
    for (const u of this.police) {
      const dx = playerPos.x - u.x, dz = playerPos.z - u.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const want = Math.atan2(dz, dx);
      let turn = want - u.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const role = u.unit.role;
      const targetSpeed = inShallows ? 6 : (role === 'RAMMING' ? 30 : role === 'FLANKING' ? 26 : 20);
      u.heading += clamp(turn, -2.2 * dt, 2.2 * dt);
      u.speed = lerp(u.speed, targetSpeed, dt * 0.8);
      /* flankers aim ahead of the player, rammers aim straight at him */
      let tx = playerPos.x, tz = playerPos.z;
      if (role === 'FLANKING') { tx += Math.cos(playerPos.heading) * 18; tz += Math.sin(playerPos.heading) * 18; }
      const dx2 = tx - u.x, dz2 = tz - u.z;
      const d2 = Math.sqrt(dx2 * dx2 + dz2 * dz2) || 1;
      if (d2 > 6) {
        u.x += Math.cos(u.heading) * u.speed * dt;
        u.z += Math.sin(u.heading) * u.speed * dt;
      } else if (role === 'RAMMING') {
        u.x += Math.cos(u.heading) * u.speed * dt * 0.5;
        u.z += Math.sin(u.heading) * u.speed * dt * 0.5;
      }
      const fix = World.collide(u.x, u.z, 2.4);
      if (fix) { u.x = fix.x; u.z = fix.z; u.heading += 0.9; }
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = -u.heading;
      /* light bar strobes red/blue, alternating halves */
      if (u.mesh.userData.lightbar) {
        const flip = Math.floor(performance.now() / 300) % 2 === 0;
        u.mesh.userData.lightbar[0].material.color.setHex(flip ? 0xff2222 : 0x551111);
        u.mesh.userData.lightbar[1].material.color.setHex(flip ? 0x113366 : 0x2266ff);
      }
      u.dist = d;
    }
  },

  updateHeli(dt, playerPos, t) {
    if (!this.heli) return;
    const h = this.heli;
    /* hover ahead-right of the player, low enough to sit inside the chase
       camera's frame instead of clipping out the top of it */
    const fx = Math.cos(playerPos.heading), fz = Math.sin(playerPos.heading);
    const rx = -Math.sin(playerPos.heading), rz = Math.cos(playerPos.heading);
    const hx = playerPos.x + fx * 22 + rx * 10;
    const hz = playerPos.z + fz * 22 + rz * 10;
    h.position.x = lerp(h.position.x, hx, dt * 1.5);
    h.position.z = lerp(h.position.z, hz, dt * 1.5);
    h.position.y = 8.5 + Math.sin(t * 0.8) * 0.8;
    h.rotation.y = Math.atan2(playerPos.x - h.position.x, playerPos.z - h.position.z);
    h.userData.rotor.rotation.y += dt * 22;
    if (h.userData.tailRotor) h.userData.tailRotor.rotation.x += dt * 30;
    if (h.userData.beacon) {
      h.userData.beacon.material.color.setHex(Math.floor(t * 3) % 2 ? 0xff2222 : 0x881111);
    }
    if (this.heliLight) {
      this.heliLight.target.position.set(playerPos.x - h.position.x, -h.position.y, playerPos.z - h.position.z);
      this.heliLight.target.updateMatrixWorld();
    }
  },
};
