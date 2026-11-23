/* Laguna Azul v2 — game loop: on-foot + driving, wanted heat, combat,
   missions, saves, and the staged ?shot= modes used for the cover frames.
   Rewritten for the fix session: the hero chase now holds a real 90+ MPH
   cruise, two lead cruisers stay glued to the frame in formation, the
   roadblock rides ahead of the car, and the blast re-fires close and big. */
'use strict';

const Game = {
  renderer: null, scene: null, camera: null, clock: null,
  rng: null, keys: {}, paused: false, started: false, freeRoam: false,
  t: 0, frame: 0, ready: false,
  player: null, playerMesh: null, parked: [], marker: null, tracer: null,
  camYaw: 0, camPitch: 0.32, hideTimer: 0, shootCd: 0, slipCd: 0, lastShot: 0,
  shot: null, seed: 1,

  /* ---- boot ---- */
  init() {
    if (this._inited) return;
    this._inited = true;
    const params = new URLSearchParams(location.search);
    this.shot = params.get('shot') || null;
    this.seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.rng = mulberry32(this.seed * 7919 + 13);

    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
    this.clock = new THREE.Clock();
    buildWorld(this.scene, this.rng);
    HUD.init();
    this.spawnPlayerAvatar();
    this.parkStarterCars();
    this.buildObjectiveMarker();
    Entities.spawnTraffic(this.scene, this.rng, 16);
    Entities.spawnPeds(this.scene, this.rng, 26);
    this.loadSave();
    this.bindInput();
    this.stageShot();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.renderer.setAnimationLoop(() => this.tick());
    window.Game = this;
    window.__gameReady = false;
  },

  spawnPlayerAvatar() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xff5e3a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.05, 8), jacket);
    torso.position.y = 1.1; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
    head.position.y = 1.95; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23c }));
    cap.position.y = 2.18; g.add(cap);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.75, 0.17), pants);
      leg.position.set(0, 0.38, s * 0.17); g.add(leg); legs.push(leg);
    }
    g.userData.legs = legs;
    this.scene.add(g);
    this.playerMesh = g;
    this.player = {
      x: 0, z: 30, heading: Math.PI, speed: 0, onFoot: true, inCar: false,
      car: null, health: 82, armour: 64, ammo: 48, cash: 48250, wanted: 0,
      cond: 92, walkPhase: 0, airborne: 0, vy: 0,
    };
  },

  parkStarterCars() {
    const spots = [
      { x: 55, z: 55, m: 0 }, { x: -55, z: -55, m: 2 }, { x: 125, z: -55, m: 3 },
      { x: -125, z: 55, m: 4 }, { x: 55, z: 125, m: 1 }, { x: -55, z: -125, m: 0 },
      { x: 185, z: 55, m: 2 }, { x: -185, z: -55, m: 3 }, { x: 12, z: 120, m: 4 },
    ];
    for (const s of spots) {
      const model = VEHICLE_MODELS[s.m];
      const mesh = buildCarMesh(model);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = (this.rng() * 4 | 0) * Math.PI / 2;
      this.scene.add(mesh);
      this.parked.push({ mesh, model, x: s.x, z: s.z, taken: false, speed: 0, heading: mesh.rotation.y });
    }
  },

  buildObjectiveMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 30; g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23c }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const light = new THREE.PointLight(0xffd23c, 120, 40, 1.5);
    light.position.y = 6; g.add(light);
    this.scene.add(g);
    this.marker = g;
  },

  /* ---- input ---- */
  bindInput() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.toggleCar();
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyQ') this.slipstream();
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
        document.querySelectorAll('.wslot').forEach(s => s.classList.remove('active'));
        const slot = document.querySelector('.wslot[data-k="' + e.code.slice(-1) + '"]');
        if (slot) slot.classList.add('active');
      }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('mousedown', (e) => {
      if (!this.started || this.paused) return;
      if (e.target.closest('button')) return;
      AudioSys.init();
      this.shoot();
    });
    document.getElementById('btn-new').onclick = () => { AudioSys.init(); this.startGame(0, false); };
    document.getElementById('btn-continue').onclick = () => { AudioSys.init(); this.startGame(this.savedMission || 0, false); };
    document.getElementById('btn-free').onclick = () => { AudioSys.init(); this.startGame(0, true); };
    document.getElementById('btn-resume').onclick = () => this.togglePause();
  },

  startGame(missionIdx, freeRoam) {
    this.started = true; this.freeRoam = freeRoam;
    MissionSys.set(missionIdx);
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('crosshair').style.display = this.player.onFoot ? 'block' : 'none';
    HUD.setMission(MissionSys.get());
    this.setWanted(this.player.wanted);
    HUD.setCash(this.player.cash);
    this.updateMarker();
    HUD.toast(freeRoam ? 'FREE ROAM — LAGUNA AZUL IS YOURS' : 'MISSION ' + MissionSys.get().n + ': ' + MissionSys.get().name);
  },

  togglePause() {
    if (!this.started) return;
    this.paused = !this.paused;
    document.getElementById('pause-screen').classList.toggle('hidden', !this.paused);
    if (!this.paused) this.saveGame();
  },

  /* ---- saves ---- */
  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem('laguna-azul-save') || 'null');
      if (s) {
        this.savedMission = s.mission || 0;
        this.player.cash = s.cash || 48250;
        document.getElementById('save-line').textContent =
          'Save found — Mission ' + ((s.mission || 0) + 1) + '/10 · $' + (s.cash || 0).toLocaleString('en-US') + ' · ' + (s.when || '');
        document.getElementById('btn-continue').style.display = '';
        return;
      }
    } catch (e) { /* no save */ }
    this.savedMission = 0;
    document.getElementById('btn-continue').style.display = 'none';
  },

  saveGame() {
    try {
      localStorage.setItem('laguna-azul-save', JSON.stringify({
        mission: MissionSys.current, cash: this.player.cash,
        when: new Date().toLocaleString('en-GB'),
      }));
    } catch (e) { /* storage unavailable */ }
  },

  /* ---- shot modes: real gameplay states, driven by URL params ---- */
  stageShot() {
    if (!this.shot) return;
    const p = this.player;
    if (this.shot === 'hero') {
      MissionSys.set(7); // mission 8: THE LAGUNA HEIST
      p.wanted = 4; p.cash = 48250; p.health = 82; p.ammo = 48;
      /* Rio in the Nebula GT, westbound ON the causeway deck, flat out. */
      const car = this.parked[0];
      car.taken = true; p.inCar = true; p.onFoot = false; p.car = car;
      car.x = -180; car.z = -150; car.heading = Math.PI; /* facing -x, toward the lagoon */
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      car.speed = car.model.top; /* 42 -> HUD reads 92 MPH */
      p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = car.speed;
      Entities.spawnPolice(this.scene, 6);
      /* two lead cruisers start IN the frame, ahead of the player; the rest ring in. */
      const fx = Math.cos(p.heading), fz = Math.sin(p.heading);
      const rx = -Math.sin(p.heading), rz = Math.cos(p.heading);
      const leadSpots = [
        { ahead: 17, side: -11 }, { ahead: 14, side: 12 },
        { ahead: -30, side: 14 }, { ahead: -38, side: -12 },
        { ahead: 44, side: -16 }, { ahead: -52, side: 6 },
      ];
      Entities.police.forEach((u, i) => {
        const spot = leadSpots[i % leadSpots.length];
        u.x = p.x + fx * spot.ahead + rx * spot.side;
        u.z = p.z + fz * spot.ahead + rz * spot.side;
        u.heading = Math.atan2(p.z - u.z, p.x - u.x);
        u.speed = 34;
      });
      Entities.spawnHeli(this.scene);
      Entities.heli.position.set(-202, 9, -140);
      /* traffic jammed on the causeway ahead; blasts re-fire in tick() */
      for (let i = 0; i < 4; i++) {
        const t = Entities.traffic[i];
        t.path = { axis: 'x', at: -150, from: -200, to: 200 };
        t.s = -202 - i * 14; t.speed = 0; t.lane = (i % 2 ? 2.4 : -2.4);
      }
      Entities.explode(this.scene, -200, 1, -143);
      this.startGame(7, false);
      /* startGame re-spawns the pursuit (wiping any staged roadblock) and
         drops its own lane-blocking one — clear it and stage ours on the
         far lane, 40 ahead, where the camera can read it. */
      Entities.clearRoadblocks(this.scene);
      Entities.spawnRoadblock(this.scene, p.x - 40, -143, Math.PI / 2);
      HUD.flashWanted('WANTED LEVEL 4 — AZUL PD AIR UNIT INBOUND');
    } else if (this.shot === 'foot') {
      MissionSys.set(0);
      p.wanted = 2; p.x = 6; p.z = 34; p.heading = Math.PI * 0.75; p.ammo = 48;
      Entities.spawnPolice(this.scene, 4);
      const footSpots = [[26, -18], [-22, 24], [34, 20], [-30, -26]];
      Entities.police.forEach((u, i) => {
        u.x = p.x + footSpots[i][0]; u.z = p.z + footSpots[i][1];
        u.heading = Math.atan2(p.z - u.z, p.x - u.x);
      });
      this.startGame(0, false);
      HUD.toast('ON FOOT — PISTOL OUT, AZUL PD CLOSING IN');
    } else if (this.shot === 'market') {
      MissionSys.set(2); /* mission 3: MERCADO RUN */
      p.wanted = 1; p.cash = 12400;
      const car = this.parked[4];
      car.taken = true; p.inCar = true; p.onFoot = false; p.car = car;
      car.x = 128; car.z = 128; car.heading = Math.PI / 2; car.speed = 12;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      p.x = car.x; p.z = car.z; p.heading = car.heading;
      Entities.spawnPolice(this.scene, 2);
      Entities.police.forEach((u, i) => { u.x = p.x + 40 + i * 12; u.z = p.z - 20; u.heading = 0; });
      /* market traffic crawling past the player */
      for (let i = 0; i < 3; i++) {
        const t = Entities.traffic[5 + i];
        t.path = { axis: 'x', at: 120, from: -200, to: 200 };
        t.s = 95 + i * 22; t.speed = 7; t.lane = (i % 2 ? 2.4 : -2.4);
      }
      this.startGame(2, false);
    } else if (this.shot === 'start') {
      /* attract mode: start screen over a slow orbit of the city */
      this.started = false;
      document.getElementById('start-screen').classList.remove('hidden');
    }
  },

  /* Hero chase formation: the two lead cruisers hold fixed slots ahead of Rio
     (one ramming from the left, one flanking from the right) so the pursuit
     is always in the cover frame, whatever the frame rate. They sit angled
     across the lane so their AZUL PD flanks read from the chase camera. */
  holdHeroFormation() {
    const p = this.player;
    const fx = Math.cos(p.heading), fz = Math.sin(p.heading);
    const rx = -Math.sin(p.heading), rz = Math.cos(p.heading);
    const slots = [
      { unit: Entities.police[0], ahead: 17, side: -11, skew: 0.55 },
      { unit: Entities.police[1], ahead: 14, side: 12, skew: -0.5 },
    ];
    for (const s of slots) {
      const u = s.unit;
      if (!u) continue;
      u.x = p.x + fx * s.ahead + rx * s.side;
      u.z = p.z + fz * s.ahead + rz * s.side;
      u.heading = Math.atan2(p.z - u.z, p.x - u.x) + s.skew;
      u.speed = 38;
      u.dist = Math.hypot(u.x - p.x, u.z - p.z);
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = -u.heading;
    }
    /* roadblock keeps station 40 ahead on the far lane. */
    const rb = Entities.roadblocks[0];
    if (rb) {
      rb.x = p.x + fx * 40;
      rb.mesh.position.set(rb.x, 0, -143);
    }
  },

  /* ---- actions ---- */
  toggleCar() {
    if (!this.started || this.paused) return;
    const p = this.player;
    if (p.inCar) {
      const car = p.car;
      car.speed = 0;
      p.x = car.x + Math.cos(car.heading + Math.PI / 2) * 3.5;
      p.z = car.z + Math.sin(car.heading + Math.PI / 2) * 3.5;
      p.inCar = false; p.onFoot = true; p.car = null; p.speed = 0;
      this.playerMesh.position.set(p.x, 0, p.z);
      this.playerMesh.visible = true;
      document.getElementById('crosshair').style.display = 'block';
      HUD.setSpeed(0, 'ON FOOT', p.cond);
      return;
    }
    let best = null, bestD = 36;
    for (const c of this.parked) {
      if (c.taken) continue;
      const d2 = dist2(p.x, p.z, c.x, c.z);
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    if (best) {
      best.taken = true;
      p.inCar = true; p.onFoot = false; p.car = best;
      p.heading = best.heading;
      this.playerMesh.visible = false;
      document.getElementById('crosshair').style.display = 'none';
      if (p.wanted < 1) { this.setWanted(1); HUD.toast('CAR STOLEN — WANTED LEVEL 1'); }
      AudioSys.blip(220, 0.2, 'square', 0.2);
    }
  },

  slipstream() {
    if (!this.started || this.paused || !this.player.inCar || this.slipCd > 0) return;
    this.slipCd = 8;
    const car = this.player.car;
    car.speed = Math.min(car.model.top * 1.35, car.speed + 22);
    HUD.setCooldown('rio', '8s', false);
    HUD.bonus('SLIPSTREAM! +SPEED');
    AudioSys.blip(880, 0.25, 'sawtooth', 0.25);
  },

  shoot() {
    const p = this.player;
    if (this.shootCd > 0 || p.ammo <= 0) return;
    this.shootCd = 0.28;
    p.ammo--;
    HUD.setAmmo(p.ammo);
    AudioSys.gunshot();
    /* tracer from player toward camera aim */
    const from = p.inCar && p.car
      ? new THREE.Vector3(p.car.x, 1.6, p.car.z)
      : new THREE.Vector3(p.x, 1.7, p.z);
    const dir = new THREE.Vector3(Math.cos(p.heading), -0.03, Math.sin(p.heading));
    const to = from.clone().add(dir.clone().multiplyScalar(60));
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
    this.scene.add(this.tracer);
    setTimeout(() => { if (this.tracer) { this.scene.remove(this.tracer); this.tracer = null; } }, 70);
    /* hit a police car in the line of fire? */
    for (const u of Entities.police) {
      const dx = u.x - from.x, dz = u.z - from.z;
      const along = dx * dir.x + dz * dir.z;
      if (along > 0 && along < 60) {
        const perp = Math.abs(-dx * dir.z + dz * dir.x);
        if (perp < 3.5) {
          u.speed = Math.max(0, u.speed - 12);
          if (Math.random() < 0.4) Entities.explode(this.scene, u.x, 1, u.z);
          this.setWanted(Math.min(5, p.wanted + 1));
          HUD.bonus('HIT! +$150');
          p.cash += 150; HUD.setCash(p.cash);
          break;
        }
      }
    }
  },

  nearMiss() {
    const p = this.player;
    p.cash += 250;
    HUD.setCash(p.cash);
    HUD.bonus('NEAR MISS! +$250');
    AudioSys.blip(1200, 0.12, 'sine', 0.2);
  },

  setWanted(n) {
    const p = this.player;
    const prev = p.wanted;
    p.wanted = clamp(n, 0, 5);
    HUD.setWanted(p.wanted);
    const want = p.wanted * 2;
    if (Entities.police.length !== want && p.wanted > 0) {
      const keep = Entities.police;
      Entities.spawnPolice(this.scene, want);
      keep.forEach((u, i) => { if (Entities.police[i]) { Entities.police[i].x = u.x; Entities.police[i].z = u.z; } });
      /* fresh units spawn around the player */
      Entities.police.forEach((u, i) => {
        if (Math.abs(u.x) < 1 && Math.abs(u.z) < 1) {
          const a = (i / Math.max(1, want)) * Math.PI * 2;
          u.x = p.x + Math.cos(a) * 55; u.z = p.z + Math.sin(a) * 55;
        }
      });
    }
    if (p.wanted === 0) { Entities.spawnPolice(this.scene, 0); Entities.removeHeli(this.scene); }
    if (p.wanted >= 4) Entities.spawnHeli(this.scene);
    else if (p.wanted < 4) Entities.removeHeli(this.scene);
    if (p.wanted >= 3 && Entities.roadblocks.length === 0 && p.inCar) {
      Entities.spawnRoadblock(this.scene, p.x + Math.cos(p.heading) * 70, p.z + Math.sin(p.heading) * 70, p.heading + Math.PI / 2);
    }
    if (p.wanted >= 3) AudioSys.sirenStart(); else AudioSys.sirenStop();
    if (p.wanted > prev) HUD.flashWanted('WANTED LEVEL ' + p.wanted + (p.wanted >= 4 ? ' — AZUL PD AIR UNIT INBOUND' : ' — AZUL PD RESPONDING'));
  },

  updateMarker() {
    const m = MissionSys.get();
    if (this.freeRoam || !m) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(m.target.x, 0, m.target.z);
  },

  checkMission(dt) {
    if (this.freeRoam || !this.started) return;
    const m = MissionSys.get();
    const p = this.player;
    const d2 = dist2(p.x, p.z, m.target.x, m.target.z);
    if (m.kind === 'hide') {
      if (World.inShallows(p.x, p.z)) {
        this.hideTimer += dt;
        HUD.toast('HIDDEN IN THE SHALLOWS… ' + Math.ceil(8 - this.hideTimer) + 's');
        if (this.hideTimer >= 8) this.completeMission();
      } else this.hideTimer = 0;
      return;
    }
    if (d2 < 144) this.completeMission();
  },

  completeMission() {
    const m = MissionSys.get();
    const p = this.player;
    p.cash += 5000;
    HUD.setCash(p.cash);
    HUD.toast('MISSION COMPLETE: ' + m.name + '  +$5,000');
    AudioSys.blip(660, 0.3, 'triangle', 0.3);
    setTimeout(() => AudioSys.blip(880, 0.4, 'triangle', 0.3), 180);
    const next = MissionSys.complete();
    this.saveGame();
    if (!next) {
      HUD.toast('🏆 LAST SUNSET — THE CREW IS FREE. LAGUNA AZUL COMPLETE!');
      return;
    }
    HUD.setMission(next);
    this.updateMarker();
  },

  /* ---- per-frame ---- */
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.t += dt;
    this.frame++;
    const p = this.player;
    const k = this.keys;

    /* attract camera before start */
    if (!this.started) {
      const a = this.t * 0.06;
      this.camera.position.set(Math.cos(a) * 150, 55, Math.sin(a) * 150);
      this.camera.lookAt(0, 8, -40);
      this.renderer.render(this.scene, this.camera);
      if (!this.ready && this.frame > 30) { this.ready = true; window.__gameReady = true; }
      return;
    }
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

    /* movement */
    const sprint = k.ShiftLeft || k.ShiftRight ? 1.7 : 1;
    if (p.onFoot) {
      let mx = 0, mz = 0;
      if (k.KeyW || k.ArrowUp) { mx += Math.cos(p.heading); mz += Math.sin(p.heading); }
      if (k.KeyS || k.ArrowDown) { mx -= Math.cos(p.heading); mz -= Math.sin(p.heading); }
      if (k.KeyA || k.ArrowLeft) p.heading -= 2.4 * dt;
      if (k.KeyD || k.ArrowRight) p.heading += 2.4 * dt;
      const len = Math.hypot(mx, mz) || 1;
      const sp = 6 * sprint;
      const moving = (mx || mz) ? 1 : 0;
      p.x += (mx / len) * sp * dt * moving;
      p.z += (mz / len) * sp * dt * moving;
      p.speed = moving ? sp : 0;
      p.walkPhase += dt * (moving ? 9 : 0);
      if (k.Space && p.airborne <= 0) { p.vy = 6; p.airborne = 0.01; }
      if (p.airborne > 0) {
        p.vy -= 18 * dt; p.airborne += p.vy * dt;
        if (p.airborne <= 0) { p.airborne = 0; p.vy = 0; }
      }
      const fix = World.collide(p.x, p.z, 0.7);
      if (fix) { p.x = fix.x; p.z = fix.z; }
      if (World.isWater(p.x, p.z) && !World.inShallows(p.x, p.z)) {
        p.x -= Math.cos(p.heading) * sp * dt; p.z -= Math.sin(p.heading) * sp * dt;
      }
      this.playerMesh.position.set(p.x, p.airborne, p.z);
      this.playerMesh.rotation.y = -p.heading + Math.PI / 2;
      this.playerMesh.userData.legs[0].rotation.x = Math.sin(p.walkPhase) * 0.7;
      this.playerMesh.userData.legs[1].rotation.x = -Math.sin(p.walkPhase) * 0.7;
    } else if (p.inCar && p.car) {
      const car = p.car;
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 0.55 : 0);
      car.speed = clamp(car.speed + fwd * car.model.accel * dt - car.speed * 0.35 * dt, -12, car.model.top);
      if (k.Space) car.speed *= (1 - 2.2 * dt); /* handbrake */
      /* hero chase: cruise control holds top speed so the cover reads 92 MPH */
      if (this.shot === 'hero') car.speed = car.model.top;
      if (Math.abs(car.speed) > 0.5) {
        car.heading += ((k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0)) * 1.9 * dt * Math.sign(car.speed);
      }
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z += Math.sin(car.heading) * car.speed * dt;
      const fix = World.collide(car.x, car.z, 2.4);
      if (fix) { car.x = fix.x; car.z = fix.z; car.speed *= 0.4; p.cond = Math.max(30, p.cond - 0.2); }
      if (World.isWater(car.x, car.z)) { car.speed = clamp(car.speed, -4, 4); p.cond = Math.max(30, p.cond - 0.05); }
      /* stunt ramp: airborne bonus */
      for (const r of World.ramps) {
        if (dist2(car.x, car.z, r.x, r.z) < 25 && Math.abs(car.speed) > 20 && !car.jumped) {
          car.jumped = true;
          p.cash += 500; HUD.setCash(p.cash);
          HUD.bonus('STUNT JUMP! +$500');
          setTimeout(() => { car.jumped = false; }, 4000);
        }
      }
      car.mesh.position.set(car.x, Math.abs(Math.sin(this.t * 30)) * 0.03 * Math.min(1, Math.abs(car.speed) / 20), car.z);
      car.mesh.rotation.y = -car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.z += car.speed * dt * 1.4;
      p.x = car.x; p.z = car.z; p.heading = car.heading;
      p.speed = car.speed;
      AudioSys.setEngine(Math.abs(car.speed) / car.model.top, true);
    }

    /* wanted: decay in the shallows / when hidden */
    if (p.wanted > 0) {
      const hidden = World.inShallows(p.x, p.z);
      const nearest = Entities.police.reduce((m, u) => Math.min(m, u.dist || 999), 999);
      if (hidden) {
        this.hideTimer += dt;
        if (this.hideTimer > 6) { this.setWanted(p.wanted - 1); this.hideTimer = 0; HUD.toast('LINE OF SIGHT BROKEN — HEAT FALLING'); }
      } else if (nearest > 120) {
        this.hideTimer += dt;
        if (this.hideTimer > 14) { this.setWanted(p.wanted - 1); this.hideTimer = 0; }
      } else this.hideTimer = 0;
      /* police ramming damages the player */
      for (const u of Entities.police) {
        if (u.dist !== undefined && u.dist < 4.5 && u.unit.role === 'RAMMING') {
          p.health = Math.max(0, p.health - 6 * dt);
          if (p.health <= 0) { p.health = 100; p.wanted = 0; this.setWanted(0); HUD.toast('BUSTED — LUZ BAILED YOU OUT. -$2,000'); p.cash = Math.max(0, p.cash - 2000); HUD.setCash(p.cash); }
        }
      }
    }

    /* cooldowns, clock */
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.slipCd = Math.max(0, this.slipCd - dt);
    if (this.slipCd === 0) HUD.setCooldown('rio', 'READY', true);
    else HUD.setCooldown('rio', Math.ceil(this.slipCd) + 's', false);
    const mins = 18 * 60 + 42 + Math.floor(this.t * 0.5);
    HUD.setClock(Math.floor(mins / 60) % 24, mins % 60, 'FRI');

    /* world updates */
    Entities.updateTraffic(dt, p);
    Entities.updatePeds(dt, p);
    Entities.updatePolice(dt, p, World.inShallows(p.x, p.z));
    Entities.updateHeli(dt, p, this.t);
    Entities.updateExplosions(dt);
    if (this.shot === 'hero') {
      this.holdHeroFormation();
      /* keep a blast burning just ahead-right of the car, close and compact */
      if (this.t - (this.lastBoom || -10) > 0.7) {
        this.lastBoom = this.t;
        Entities.explode(this.scene, p.x - 22 + Math.random() * 4, 1, p.z + 5);
      }
    }
    World.waterMesh.position.y = 0.25 + Math.sin(this.t * 0.7) * 0.05;
    for (const b of World.boats) b.position.y = 0.2 + Math.sin(this.t * 0.9 + b.position.z) * 0.12;
    if (this.marker.visible) this.marker.rotation.y += dt * 0.8;
    this.checkMission(dt);

    /* camera: third person follow */
    const back = p.inCar ? 14 : 7.5;
    const height = p.inCar ? 6.2 : 3.4;
    const cx = p.x - Math.cos(p.heading) * back;
    const cz = p.z - Math.sin(p.heading) * back;
    /* hero frame: shift the camera sideways so the car clears the dialogue box */
    const lat = this.shot === 'hero' ? 5 : 0;
    const lx = -Math.sin(p.heading) * lat, lz = Math.cos(p.heading) * lat;
    this.camera.position.x = lerp(this.camera.position.x, cx + lx, 1 - Math.pow(0.001, dt));
    this.camera.position.y = lerp(this.camera.position.y, height + (p.airborne || 0), 1 - Math.pow(0.001, dt));
    this.camera.position.z = lerp(this.camera.position.z, cz + lz, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(p.x + Math.cos(p.heading) * 8, 1.6, p.z + Math.sin(p.heading) * 8);

    /* HUD */
    HUD.setVitals(p.health, p.armour, p.x, p.z);
    HUD.setDispatch(Entities.police);
    HUD.setSpeed(p.inCar && p.car ? Math.abs(p.car.speed) * 2.2 : (p.onFoot ? Math.abs(Math.sin(p.walkPhase)) * 4 : 0),
      p.inCar && p.car ? p.car.model.name : 'ON FOOT', p.cond);
    HUD.drawMinimap(p.x, p.z, p.heading, MissionSys.get() ? MissionSys.get().target : null,
      Entities.traffic, Entities.police, Entities.heli);

    this.renderer.render(this.scene, this.camera);
    if (!this.ready && this.frame > 25) { this.ready = true; window.__gameReady = true; }
  },
};

addEventListener('DOMContentLoaded', () => Game.init());
if (document.readyState !== 'loading') Game.init();
