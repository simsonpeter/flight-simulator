import * as THREE from 'three';
import { createAircraftMesh, AIRCRAFT_DEFS } from './aircraft.js';

export const RUNWAY = {
  y: 14,
  minZ: -900,
  maxZ: 900,
  minX: -24,
  maxX: 24
};

function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.timeOfDay = 'DAY';
    this.weather = 'CLEAR';
    this.clock = 0;
    this.clouds = [];
    this.stars = null;
    this.sun = null;
    this.moon = null;
    this.sunLight = null;
    this.hemi = null;
    this.ocean = null;
    this.rain = null;
    this.lightning = 0;
    this.runwayLights = [];
    this.cityLights = [];
    this.radarDish = null;
    this.fog = null;
    this.islands = [];
    this.protectedZone = new THREE.Vector3(0, 80, -2200);
  }

  build(timeOfDay, weather) {
    this.timeOfDay = timeOfDay;
    this.weather = weather;
    this._lighting();
    this._sky();
    this._ocean();
    this._islands();
    this._mountains();
    this._airfield();
    this._clouds();
    this._stars();
    this._weather();
    this.applyAtmosphere();
  }

  _lighting() {
    this.hemi = new THREE.HemisphereLight(0x8ec8ff, 0x223322, 0.7);
    this.scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.2);
    this.sunLight.position.set(400, 600, 200);
    if (this.quality === 'high') {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 2500;
      this.sunLight.shadow.camera.left = -400;
      this.sunLight.shadow.camera.right = 400;
      this.sunLight.shadow.camera.top = 400;
      this.sunLight.shadow.camera.bottom = -400;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  _sky() {
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(40, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1b0 })
    );
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(22, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xcdd8ff })
    );
    this.scene.add(this.sun, this.moon);
  }

  _ocean() {
    const geo = new THREE.PlaneGeometry(24000, 24000, this.quality === 'low' ? 1 : 24, this.quality === 'low' ? 1 : 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b3a58,
      metalness: 0.72,
      roughness: 0.28,
      envMapIntensity: 0.8
    });
    this.ocean = new THREE.Mesh(geo, mat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = 0;
    this.ocean.receiveShadow = true;
    this.scene.add(this.ocean);
  }

  _islands() {
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x3d5a36, roughness: 0.92, metalness: 0.05 });
    const sand = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.9 });
    const rock = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 0.95 });
    const count = this.quality === 'low' ? 8 : 14;
    for (let i = 0; i < count; i++) {
      const ang = i / count * Math.PI * 2 + seeded(i) * 0.4;
      const dist = 1600 + seeded(i + 3) * 4200;
      const r = 180 + seeded(i + 9) * 280;
      const h = 18 + seeded(i + 5) * 50;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r, h, 8), islandMat);
      mesh.position.set(Math.cos(ang) * dist, h / 2, Math.sin(ang) * dist);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.islands.push({ x: mesh.position.x, z: mesh.position.z, r: r * 0.85, h });

      const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, 4, 8), sand);
      beach.position.set(mesh.position.x, 2, mesh.position.z);
      this.scene.add(beach);

      if (i % 2 === 0) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 1.6, 6), rock);
        peak.position.set(mesh.position.x, h + 8, mesh.position.z);
        this.scene.add(peak);
      }

      this._scatterBuildings(mesh.position.x, mesh.position.z, r * 0.4, i);
    }

    const home = new THREE.Mesh(new THREE.CylinderGeometry(520, 640, 16, 10), islandMat);
    home.position.set(0, 8, 0);
    home.receiveShadow = true;
    this.scene.add(home);
    this.islands.push({ x: 0, z: 0, r: 580, h: 16 });
  }

  _scatterBuildings(x, z, spread, seed) {
    const bmat = new THREE.MeshStandardMaterial({ color: 0x889099, roughness: 0.7, metalness: 0.3 });
    const n = this.quality === 'low' ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const bx = x + (seeded(seed + i * 4) - 0.5) * spread * 2;
      const bz = z + (seeded(seed + i * 7) - 0.5) * spread * 2;
      const h = 8 + seeded(seed + i) * 28;
      const b = new THREE.Mesh(new THREE.BoxGeometry(6 + seeded(i) * 8, h, 6 + seeded(i + 2) * 8), bmat);
      b.position.set(bx, 16 + h / 2, bz);
      this.scene.add(b);
      if (this.timeOfDay === 'NIGHT' || this.timeOfDay === 'SUNSET') {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(2, 2, 2),
          new THREE.MeshBasicMaterial({ color: 0xffcc66 })
        );
        light.position.set(bx, 16 + h + 1, bz);
        this.scene.add(light);
        this.cityLights.push(light);
      }
    }

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(spread * 1.6, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x222 })
    );
    road.position.set(x, 16.3, z);
    this.scene.add(road);
  }

  _mountains() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4d5360, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.8, flatShading: true });
    const n = this.quality === 'low' ? 18 : 32;
    for (let i = 0; i < n; i++) {
      const ang = seeded(i + 40) * Math.PI * 2;
      const dist = 7000 + seeded(i + 80) * 4500;
      const h = 280 + seeded(i + 21) * 900;
      const r = 180 + seeded(i + 12) * 420;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
      m.position.set(Math.cos(ang) * dist, h / 2, Math.sin(ang) * dist);
      this.scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.22, 5), snow);
      cap.position.set(m.position.x, h * 0.78, m.position.z);
      this.scene.add(cap);
    }
  }

  _airfield() {
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.85, metalness: 0.1 });
    const paint = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
    const runway = new THREE.Mesh(new THREE.BoxGeometry(48, 1.2, 1800), asphalt);
    runway.position.set(0, RUNWAY.y, 0);
    runway.receiveShadow = true;
    this.scene.add(runway);

    for (let z = -820; z <= 820; z += 70) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 28), paint);
      stripe.position.set(0, RUNWAY.y, z);
      this.scene.add(stripe);
    }

    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.55, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(48, 22, 36), hangarMat);
      h.position.set(-90 - i * 10, RUNWAY.y + 11, -220 + i * 80);
      this.scene.add(h);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(52, 2, 40), new THREE.MeshStandardMaterial({ color: 0x333 }));
      roof.position.copy(h.position);
      roof.position.y += 12;
      this.scene.add(roof);
    }

    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(10, 28, 10), hangarMat);
    towerBase.position.set(70, RUNWAY.y + 14, -80);
    const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 8, 8), new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.45 }));
    towerTop.position.set(70, RUNWAY.y + 32, -80);
    this.scene.add(towerBase, towerTop);

    const tankMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, metalness: 0.5, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 12, 10), tankMat);
      tank.position.set(90, RUNWAY.y + 6, 120 + i * 18);
      this.scene.add(tank);
    }

    const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 16, 8), hangarMat);
    radarBase.position.set(-70, RUNWAY.y + 8, 200);
    this.radarDish = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x99a, metalness: 0.7 }));
    this.radarDish.position.set(-70, RUNWAY.y + 18, 200);
    this.scene.add(radarBase, this.radarDish);

    const parked = createAircraftMesh(AIRCRAFT_DEFS.raptor, { scale: 0.9 });
    parked.position.set(-40, RUNWAY.y + 2.2, 160);
    parked.rotation.y = 0.4;
    this.scene.add(parked);
    const parked2 = createAircraftMesh(AIRCRAFT_DEFS.viper, { scale: 0.85 });
    parked2.position.set(-52, RUNWAY.y + 2.2, 190);
    parked2.rotation.y = 0.5;
    this.scene.add(parked2);

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffef99 });
    for (let z = -860; z <= 860; z += 40) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), lightMat);
      l.position.set(-23, RUNWAY.y + 1.1, z);
      const r = l.clone();
      r.position.x = 23;
      this.scene.add(l, r);
      this.runwayLights.push(l, r);
    }

    if (this.quality !== 'low') {
      const p1 = new THREE.PointLight(0xffcc77, 0.6, 180);
      p1.position.set(0, RUNWAY.y + 8, -400);
      const p2 = p1.clone();
      p2.position.z = 400;
      this.scene.add(p1, p2);
    }

    const road = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 400), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    road.position.set(40, RUNWAY.y + 0.2, 200);
    this.scene.add(road);
  }

  _clouds() {
    const n = this.quality === 'low' ? 16 : this.quality === 'medium' ? 36 : 58;
    const mat = new THREE.MeshLambertMaterial({ color: 0xf4f7fb, transparent: true, opacity: 0.78 });
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const bits = 3 + (i % 4);
      for (let b = 0; b < bits; b++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(40 + seeded(i + b) * 50, 6, 5), mat);
        puff.position.set((seeded(i * 3 + b) - 0.5) * 90, (seeded(i + b + 2) - 0.5) * 20, (seeded(i + b + 8) - 0.5) * 50);
        g.add(puff);
      }
      g.position.set((seeded(i + 1) - 0.5) * 9000, 280 + seeded(i + 2) * 520, (seeded(i + 4) - 0.5) * 9000);
      this.scene.add(g);
      this.clouds.push({ mesh: g, speed: 6 + seeded(i) * 10 });
    }
  }

  _stars() {
    const count = this.quality === 'low' ? 400 : 1200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 9000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) + 400;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 8 }));
    this.scene.add(this.stars);
  }

  _weather() {
    if (this.weather !== 'STORM' && this.weather !== 'CLOUDY') return;
    if (this.weather === 'STORM' && this.quality !== 'low') {
      const count = 350;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 400;
        pos[i * 3 + 1] = Math.random() * 180;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccff, size: 1.4, transparent: true, opacity: 0.45 }));
      this.scene.add(this.rain);
    }
  }

  applyAtmosphere() {
    const tod = this.timeOfDay;
    const storm = this.weather === 'STORM';
    let fogNear = 400;
    let fogFar = 9000;
    let fogColor = 0x87b8e0;
    let bg = 0x6eacd9;
    let hemiSky = 0x9ecfff;
    let hemiGnd = 0x3a4a30;
    let sunInt = 1.25;
    let sunColor = 0xfff2d0;

    if (tod === 'SUNSET') {
      bg = 0xc45a2a;
      fogColor = 0xd9783c;
      hemiSky = 0xff9966;
      hemiGnd = 0x3a2218;
      sunInt = 1.05;
      sunColor = 0xff6622;
      this.sun.position.set(-500, 120, -800);
      this.moon.position.set(800, -200, 400);
      this.sun.visible = true;
      this.moon.visible = false;
    } else if (tod === 'NIGHT') {
      bg = 0x040814;
      fogColor = 0x0b1224;
      fogNear = 200;
      fogFar = 5000;
      hemiSky = 0x223355;
      hemiGnd = 0x05070c;
      sunInt = 0.12;
      sunColor = 0x8899cc;
      this.sun.position.set(0, -400, 0);
      this.moon.position.set(600, 700, -400);
      this.sun.visible = false;
      this.moon.visible = true;
    } else {
      this.sun.position.set(600, 800, 300);
      this.moon.position.set(-700, -300, 200);
      this.sun.visible = true;
      this.moon.visible = false;
    }

    if (this.weather === 'CLOUDY') {
      fogFar *= 0.7;
      sunInt *= 0.7;
      bg = tod === 'NIGHT' ? 0x0a1020 : 0x7a90a8;
    }
    if (storm) {
      fogNear = 80;
      fogFar = 2200;
      fogColor = 0x2a3340;
      bg = 0x1c2430;
      sunInt *= 0.35;
      hemiSky = 0x445566;
    }

    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    this.hemi.color.setHex(hemiSky);
    this.hemi.groundColor.setHex(hemiGnd);
    this.hemi.intensity = tod === 'NIGHT' ? 0.25 : 0.75;
    this.sunLight.color.setHex(sunColor);
    this.sunLight.intensity = sunInt;
    this.sunLight.position.copy(this.sun.position);
    if (this.stars) this.stars.visible = tod === 'NIGHT';
    this.runwayLights.forEach((l) => { l.visible = tod !== 'DAY' || storm; });
  }

  getHeight(x, z) {
    if (x > RUNWAY.minX && x < RUNWAY.maxX && z > RUNWAY.minZ && z < RUNWAY.maxZ) return RUNWAY.y;
    let best = 0;
    for (const isl of this.islands) {
      const dx = x - isl.x;
      const dz = z - isl.z;
      if (dx * dx + dz * dz < isl.r * isl.r) best = Math.max(best, isl.h);
    }
    return best;
  }

  isOnRunway(x, z) {
    return x > RUNWAY.minX && x < RUNWAY.maxX && z > RUNWAY.minZ && z < RUNWAY.maxZ;
  }

  update(dt, playerPos) {
    this.clock += dt;
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 5000) c.mesh.position.x = -5000;
    }
    if (this.radarDish) this.radarDish.rotation.y += dt * 0.8;
    if (this.ocean && this.quality !== 'low') {
      this.ocean.material.emissive = this.ocean.material.emissive || new THREE.Color(0x000000);
    }
    if (this.rain && playerPos) {
      this.rain.position.copy(playerPos);
      this.rain.position.y += 40;
      const arr = this.rain.geometry.attributes.position.array;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] -= 90 * dt;
        if (arr[i] < 0) arr[i] = 180;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.weather === 'STORM') {
      this.lightning -= dt;
      if (this.lightning <= 0) {
        this.lightning = 3 + Math.random() * 6;
        this.hemi.intensity += 1.4;
        setTimeout(() => this.applyAtmosphere(), 80);
      }
    }
  }
}
