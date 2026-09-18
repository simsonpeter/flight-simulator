import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1,
    name: 'VLUCHT NAAR BELGIË',
    blurb: 'Start in Duitsland. Vlieg over de grens en kom terecht in België.',
    briefing: 'Stijg op in Keulen. Blijf de poorten volgen tot Brussel.',
    tod: 'DAY',
    weather: 'CLEAR',
    checkpoints: [
      { pos: [0, 70, -420], name: 'Keulen' },
      { pos: [90, 140, 180], name: 'Aachen' },
      { pos: [40, 210, 880], name: 'Grens DE/BE' },
      { pos: [-70, 180, 1480], name: 'Luik' },
      { pos: [20, 120, 2100], name: 'Brussel' }
    ],
    enemies: [],
    intercept: false,
    needLanding: false,
    xp: 400
  },
  {
    id: 2,
    name: 'AIR PATROL',
    blurb: 'Destroy hostile aircraft operating near the island.',
    briefing: 'Three bandits on patrol. Acquire, lock, and eliminate.',
    tod: 'DAY',
    weather: 'CLOUDY',
    checkpoints: [],
    enemies: [
      { type: 'scout', pos: [280, 160, 420] },
      { type: 'fighter', pos: [-240, 180, 520] },
      { type: 'fighter', pos: [40, 200, 780] }
    ],
    intercept: false,
    xp: 700
  },
  {
    id: 3,
    name: 'INTERCEPT',
    blurb: 'Stop enemy fighters from reaching the protected zone.',
    briefing: 'Hostiles inbound on the northern corridor. Do not let them through.',
    tod: 'SUNSET',
    weather: 'CLEAR',
    checkpoints: [],
    enemies: [
      { type: 'scout', pos: [-900, 280, -2800] },
      { type: 'fighter', pos: [-400, 300, -3200] },
      { type: 'fighter', pos: [200, 260, -3000] },
      { type: 'scout', pos: [800, 240, -2600] }
    ],
    intercept: true,
    zone: [0, 80, -2200],
    xp: 900
  },
  {
    id: 4,
    name: 'DOGFIGHT',
    blurb: 'Survive waves of enemy fighters.',
    briefing: 'Multiple contacts. Stay fast, stay lethal.',
    tod: 'NIGHT',
    weather: 'CLEAR',
    checkpoints: [],
    enemies: [
      { type: 'scout', pos: [600, 240, 800] },
      { type: 'scout', pos: [-700, 260, 900] },
      { type: 'fighter', pos: [100, 300, 1400] }
    ],
    waves: [
      [{ type: 'fighter', pos: [900, 280, 400] }, { type: 'fighter', pos: [-900, 280, 500] }],
      [{ type: 'heavy', pos: [0, 320, 1800] }, { type: 'scout', pos: [400, 300, 1700] }, { type: 'scout', pos: [-400, 300, 1700] }]
    ],
    intercept: false,
    xp: 1200
  },
  {
    id: 5,
    name: 'BOSS',
    blurb: 'Engage the elite VX-OMEGA over the storm front.',
    briefing: 'An experimental heavy fighter and escorts. Bring it down.',
    tod: 'SUNSET',
    weather: 'STORM',
    checkpoints: [],
    enemies: [
      { type: 'boss', pos: [0, 340, 1500] },
      { type: 'fighter', pos: [220, 300, 1300] },
      { type: 'fighter', pos: [-220, 300, 1300] }
    ],
    intercept: false,
    xp: 2000
  }
];

export class MissionRuntime {
  constructor(scene, def) {
    this.def = def;
    this.scene = scene;
    this.checkpoints = [];
    this.next = 0;
    this.tookOff = false;
    this.landed = false;
    this.kills = 0;
    this.requiredKills = def.enemies.length;
    this.wave = 0;
    this.breach = false;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this._buildCheckpoints();
  }

  _buildCheckpoints() {
    const raw = this.def.checkpoints || [];
    for (const item of raw) {
      const [x, y, z] = Array.isArray(item) ? item : item.pos;
      const name = Array.isArray(item) ? '' : (item.name || '');
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(38, 1.35, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x66ffd1, transparent: true, opacity: 0.9 })
      );
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(38, 2.8, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x22aa88, transparent: true, opacity: 0.22, depthWrite: false })
      );
      group.add(ring, glow);
      group.position.set(x, y, z);
      this.scene.add(group);
      this.checkpoints.push({ mesh: group, pos: new THREE.Vector3(x, y, z), done: false, radius: 42, name });
    }
    this._orientRings();
  }

  _orientRings() {
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cur = this.checkpoints[i].pos;
      const prev = i === 0 ? new THREE.Vector3(0, 16, -780) : this.checkpoints[i - 1].pos;
      const dir = cur.clone().sub(prev).normalize();
      this.checkpoints[i].mesh.lookAt(cur.clone().add(dir));
    }
  }

  onTakeoff() {
    this.tookOff = true;
  }

  onLanding() {
    this.landed = true;
  }

  onKill(enemy) {
    this.kills++;
  }

  extraWaves() {
    return this.def.waves || [];
  }

  update(dt, player, enemies) {
    for (const cp of this.checkpoints) {
      cp.mesh.rotation.z += dt * 0.8;
      const i = this.checkpoints.indexOf(cp);
      const mat = cp.mesh.children[0].material;
      mat.color.setHex(i === this.next && !cp.done ? 0xffe08a : cp.done ? 0x44ff88 : 0x338877);
    }
    if (this.next < this.checkpoints.length) {
      const cp = this.checkpoints[this.next];
      if (player.position.distanceTo(cp.pos) < cp.radius) {
        cp.done = true;
        this.next++;
        return { checkpoint: this.next, total: this.checkpoints.length, name: cp.name, border: cp.name && cp.name.indexOf('Grens') >= 0 };
      }
    }

    if (this.def.intercept) {
      const zone = new THREE.Vector3(...this.def.zone);
      for (const e of enemies) {
        if (e.alive && e.position.distanceTo(zone) < 160) {
          this.breach = true;
          this.failed = true;
          this.failReason = 'PROTECTED ZONE BREACHED';
        }
      }
    }
    return null;
  }

  objectives(player, enemiesAlive, totalEnemies) {
    const list = [];
    if (this.def.id === 1) {
      list.push({ done: this.tookOff || !player.flight.grounded || this.next > 0, text: 'Opstijgen in Duitsland' });
      const nextCp = this.checkpoints[this.next];
      const label = nextCp ? nextCp.name : 'Brussel';
      list.push({ done: this.next >= this.checkpoints.length, text: this.next >= this.checkpoints.length ? 'Gelanderoute België voltooid' : `Vlieg naar ${label} (${this.next}/${this.checkpoints.length})` });
      if (this.next >= 3) list.push({ done: true, text: 'Grens over · België' });
      else list.push({ done: false, text: 'Bereik België' });
      this.tookOff = list[0].done;
    } else if (this.def.intercept) {
      list.push({ done: this.kills >= this.requiredKills && !this.breach, text: `${this.kills}/${this.requiredKills} Intercept hostiles` });
      list.push({ done: !this.breach, text: 'Defend protected zone' });
    } else {
      const need = this.requiredKills + this.extraWaves().reduce((a, w) => a + w.length, 0);
      list.push({ done: this.kills >= need, text: `${this.kills}/${need} Destroy enemy aircraft` });
      if (this.def.id === 5) list.push({ done: this.kills >= need, text: 'Destroy VX-OMEGA' });
    }
    const all = list.every((o) => o.done);
    if (all && !this.failed) this.complete = true;
    return list;
  }

  currentNav() {
    if (this.next < this.checkpoints.length) return this.checkpoints[this.next].pos;
    if (this.def.intercept) return new THREE.Vector3(...this.def.zone);
    return null;
  }

  dispose() {
    for (const cp of this.checkpoints) this.scene.remove(cp.mesh);
  }
}
