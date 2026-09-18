import * as THREE from 'three';

export const AIRCRAFT_DEFS = {
  raptor: {
    id: 'raptor',
    name: 'VX-9 RAPTOR',
    role: 'Balanced multi-role fighter',
    color: 0x5a6570,
    accent: 0x1c2430,
    stripe: 0x7dffd4,
    maxSpeed: 310,
    cruiseSpeed: 180,
    stallSpeed: 62,
    armor: 100,
    agility: 1.05,
    missiles: 6,
    gunDamage: 9,
    mass: 1,
    stats: { speed: 72, armor: 70, agility: 74, weapons: 70 }
  },
  viper: {
    id: 'viper',
    name: 'VX-11 VIPER',
    role: 'High-speed interceptor',
    color: 0x2a3344,
    accent: 0x0b1020,
    stripe: 0x4aa3ff,
    maxSpeed: 390,
    cruiseSpeed: 220,
    stallSpeed: 70,
    armor: 72,
    agility: 1.32,
    missiles: 4,
    gunDamage: 7,
    mass: 0.86,
    stats: { speed: 92, armor: 48, agility: 88, weapons: 58 }
  },
  titan: {
    id: 'titan',
    name: 'VX-14 TITAN',
    role: 'Heavy assault platform',
    color: 0x4a4638,
    accent: 0x1a1810,
    stripe: 0xe7c36a,
    maxSpeed: 250,
    cruiseSpeed: 150,
    stallSpeed: 58,
    armor: 165,
    agility: 0.74,
    missiles: 8,
    gunDamage: 12,
    mass: 1.35,
    stats: { speed: 52, armor: 94, agility: 46, weapons: 86 }
  }
};

export const ENEMY_DEFS = {
  scout: { name: 'ENEMY SCOUT', color: 0x8a3030, accent: 0x2a1010, stripe: 0xff8866, maxSpeed: 300, agility: 1.25, armor: 42, missiles: 2, gunDamage: 5, score: 300 },
  fighter: { name: 'ENEMY FIGHTER', color: 0x6a2428, accent: 0x180808, stripe: 0xff5544, maxSpeed: 270, agility: 1.0, armor: 90, missiles: 4, gunDamage: 8, score: 500 },
  heavy: { name: 'ENEMY HEAVY', color: 0x4a3a28, accent: 0x141008, stripe: 0xcc8844, maxSpeed: 210, agility: 0.68, armor: 180, missiles: 6, gunDamage: 11, score: 800 },
  boss: { name: 'VX-OMEGA', color: 0x201018, accent: 0x080406, stripe: 0xff2244, maxSpeed: 280, agility: 0.9, armor: 420, missiles: 12, gunDamage: 14, score: 2500 }
};

function metal(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: extras.metalness ?? 0.82,
    roughness: extras.roughness ?? 0.32,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0,
    transparent: extras.transparent ?? false,
    opacity: extras.opacity ?? 1,
    flatShading: extras.flatShading ?? false
  });
}

export function createAircraftMesh(def, options = {}) {
  const group = new THREE.Group();
  group.name = def.name;
  const scale = options.scale || 1;
  const body = metal(def.color);
  const dark = metal(def.accent, { roughness: 0.45 });
  const stripe = metal(def.stripe, { metalness: 0.4, roughness: 0.4, emissive: def.stripe, emissiveIntensity: 0.18 });
  const canopy = metal(0x88c8ff, { metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.55, emissive: 0x226688, emissiveIntensity: 0.2 });

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 11.2, 10), body);
  fuse.rotation.x = Math.PI / 2;
  fuse.castShadow = true;
  group.add(fuse);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 10), dark);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 7.2;
  group.add(nose);

  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 3.2), dark);
  intakeL.position.set(-0.85, -0.15, 2.2);
  const intakeR = intakeL.clone();
  intakeR.position.x = 0.85;
  group.add(intakeL, intakeR);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 3.6), body);
  wing.position.set(0, -0.15, -0.6);
  wing.rotation.y = 0;
  const wingSweep = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.14, 2.1), body);
  wingSweep.position.set(0, -0.12, 1.4);
  group.add(wing, wingSweep);

  const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 1.1), stripe);
  tipL.position.set(-6.2, 0.1, -1.2);
  const tipR = tipL.clone();
  tipR.position.x = 6.2;
  group.add(tipL, tipR);

  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 1.5), body);
  stab.position.set(0, 0.15, -5.4);
  group.add(stab);

  const vtailL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 1.8), dark);
  vtailL.position.set(-1.15, 1.15, -5.5);
  vtailL.rotation.z = 0.22;
  const vtailR = vtailL.clone();
  vtailR.position.x = 1.15;
  vtailR.rotation.z = -0.22;
  group.add(vtailL, vtailR);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), canopy);
  cockpit.position.set(0, 0.62, 2.35);
  cockpit.scale.set(1, 0.7, 1.35);
  group.add(cockpit);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 7.5), stripe);
  spine.position.set(0, 0.55, -0.4);
  group.add(spine);

  const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 3.4, 10), dark);
  engL.rotation.x = Math.PI / 2;
  engL.position.set(-0.72, -0.05, -4.6);
  const engR = engL.clone();
  engR.position.x = 0.72;
  group.add(engL, engR);

  const exhaustMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const exL = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.8, 8, 1, true), exhaustMat);
  exL.rotation.x = -Math.PI / 2;
  exL.position.set(-0.72, -0.05, -6.6);
  const exR = exL.clone();
  exR.position.x = 0.72;
  group.add(exL, exR);
  group.userData.exhaust = [exL, exR];
  group.userData.exhaustMat = exhaustMat;

  const pylonGeo = new THREE.BoxGeometry(0.12, 0.45, 0.7);
  const missileBody = () => {
    const m = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.5, 6), metal(0xc8d0d8, { metalness: 0.7 }));
    bodyM.rotation.x = Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.25), dark);
    fin.position.z = -0.5;
    m.add(bodyM, fin);
    return m;
  };
  const pylons = [];
  const slots = [-3.4, -2.2, 2.2, 3.4];
  slots.forEach((x) => {
    const p = new THREE.Mesh(pylonGeo, dark);
    p.position.set(x, -0.45, -0.2);
    const mis = missileBody();
    mis.position.set(x, -0.78, -0.1);
    mis.name = 'pylonMissile';
    group.add(p, mis);
    pylons.push(mis);
  });
  group.userData.pylonMissiles = pylons;

  const cockpitInterior = new THREE.Group();
  cockpitInterior.name = 'cockpitInterior';
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.8), dark);
  dash.position.set(0, 0.15, 1.55);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.7),
    new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
  );
  glass.position.set(0, 0.55, 2.05);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), metal(0x222));
  seat.position.set(0, -0.05, 1.1);
  cockpitInterior.add(dash, glass, seat);
  group.add(cockpitInterior);
  group.userData.cockpitInterior = cockpitInterior;

  group.scale.setScalar(scale);
  group.userData.defId = def.id || def.name;
  return group;
}

export function updateExhaust(mesh, throttle, afterburner, time) {
  const list = mesh.userData.exhaust;
  if (!list) return;
  const pulse = 1 + Math.sin(time * (afterburner ? 28 : 16)) * 0.12;
  const len = (0.7 + throttle * 1.1 + (afterburner ? 1.6 : 0)) * pulse;
  const rad = 0.7 + throttle * 0.4 + (afterburner ? 0.7 : 0);
  list.forEach((ex) => {
    ex.scale.set(rad, len, rad);
    ex.visible = throttle > 0.05;
  });
  if (mesh.userData.exhaustMat) {
    mesh.userData.exhaustMat.color.setHex(afterburner ? 0xff6a22 : 0x66ccff);
    mesh.userData.exhaustMat.opacity = afterburner ? 0.85 : 0.4 + throttle * 0.3;
  }
}

export function setPylonVisibility(mesh, remaining, max = 4) {
  const pylons = mesh.userData.pylonMissiles;
  if (!pylons) return;
  pylons.forEach((p, i) => {
    p.visible = i < Math.min(remaining, max);
  });
}
