import * as THREE from 'three';
import { ENEMY_DEFS, createAircraftMesh, updateExhaust } from './aircraft.js';
import { clamp, lerp } from './flightModel.js';

const STATES = ['PATROL', 'INTERCEPT', 'ATTACK', 'EVADE', 'RETREAT'];
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _desired = new THREE.Quaternion();
const _nose = new THREE.Vector3(0, 0, 1);

export class Enemy {
  constructor(scene, type, position, home) {
    this.id = 'enemy-' + Math.random().toString(36).slice(2, 8);
    this.type = type;
    this.def = ENEMY_DEFS[type] || ENEMY_DEFS.fighter;
    this.mesh = createAircraftMesh(this.def, { scale: type === 'boss' ? 1.45 : type === 'heavy' ? 1.2 : type === 'scout' ? 0.85 : 1 });
    this.mesh.position.copy(position);
    scene.add(this.mesh);
    this.position = this.mesh.position;
    this.home = home.clone();
    this.health = this.def.armor;
    this.maxHealth = this.def.armor;
    this.alive = true;
    this.state = 'PATROL';
    this.speed = this.def.maxSpeed * 0.55;
    this.patrolT = Math.random() * Math.PI * 2;
    this.gunCd = 1 + Math.random();
    this.missileCd = 4 + Math.random() * 4;
    this.missiles = this.def.missiles;
    this.thinkT = 0;
    this.evadeT = 0;
    this.score = this.def.score;
    this.name = this.def.name;
    this.onMissileHit = null;
    this.incomingThreat = 0;
    this.ingress = null;
  }

  applyDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (amount > 20) this.state = 'EVADE';
    if (this.health <= this.maxHealth * 0.25) this.state = 'RETREAT';
    if (this.health <= 0) this.alive = false;
  }

  update(dt, player, time, gun, missiles) {
    if (!this.alive) return;
    this.thinkT -= dt;
    this.gunCd = Math.max(0, this.gunCd - dt);
    this.missileCd = Math.max(0, this.missileCd - dt);
    this.evadeT = Math.max(0, this.evadeT - dt);

    const dist = this.mesh.position.distanceTo(player.position);
    if (this.thinkT <= 0) {
      this.thinkT = 0.4 + Math.random() * 0.5;
      this._chooseState(dist, player);
    }

    const aim = this._aimPoint(player, dist);
    const maxTurn = this.def.agility * (this.state === 'EVADE' ? 2.2 : 1.4);
    _to.copy(aim).sub(this.mesh.position);
    if (_to.lengthSq() > 0.001) {
      _to.normalize();
      _desired.setFromUnitVectors(_nose, _to);
      this.mesh.quaternion.rotateTowards(_desired, maxTurn * dt * 0.55);
    }

    const targetSpd = this.state === 'RETREAT' ? this.def.maxSpeed * 0.9
      : this.state === 'ATTACK' ? this.def.maxSpeed * 0.8
      : this.def.maxSpeed * 0.58;
    this.speed = lerp(this.speed, targetSpd, 1 - Math.exp(-1.2 * dt));
    _fwd.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    this.mesh.position.addScaledVector(_fwd, this.speed * dt);
    if (this.mesh.position.y < 40) this.mesh.position.y = 40;

    updateExhaust(this.mesh, 0.7, this.state === 'ATTACK', time);

    if (player.alive) this._weapons(dt, player, dist, gun, missiles);
  }

  _chooseState(dist, player) {
    if (this.incomingThreat > 0 || this.evadeT > 0) {
      this.state = 'EVADE';
      return;
    }
    if (this.health < this.maxHealth * 0.22) {
      this.state = 'RETREAT';
      return;
    }
    if (this.ingress && dist > 1100) {
      this.state = 'PATROL';
      return;
    }
    if (dist < 700) this.state = Math.random() < 0.18 ? 'EVADE' : 'ATTACK';
    else if (dist < 1800) this.state = 'INTERCEPT';
    else this.state = 'PATROL';
    if (this.state === 'EVADE') this.evadeT = 1.5 + Math.random();
  }

  _aimPoint(player, dist) {
    if (this.state === 'PATROL') {
      this.patrolT += 0.25;
      const center = this.ingress || this.home;
      const rad = this.ingress ? 380 : 420;
      return new THREE.Vector3(
        center.x + Math.cos(this.patrolT) * rad,
        (center.y || this.home.y) + Math.sin(this.patrolT * 0.6) * 80,
        center.z + Math.sin(this.patrolT) * rad
      );
    }
    if (this.state === 'RETREAT') {
      return this.home.clone().setY(this.home.y + 120);
    }
    if (this.state === 'EVADE') {
      _fwd.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
      return this.mesh.position.clone().addScaledVector(_fwd, 200).addScaledVector(side, Math.sin(this.patrolT * 3) * 180).add(new THREE.Vector3(0, 60, 0));
    }
    const lead = player.flight ? player.flight.speed * 0.35 : 40;
    const p = player.position.clone();
    const pf = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion).multiplyScalar(lead);
    p.add(pf);
    if (this.state === 'INTERCEPT') {
      p.add(new THREE.Vector3(0, 40, 0));
    }
    if (this.state === 'ATTACK') {
      const behind = new THREE.Vector3(0, 0, -1).applyQuaternion(player.mesh.quaternion).multiplyScalar(90);
      p.add(behind);
    }
    return p;
  }

  _weapons(dt, player, dist, gun, missiles) {
    _fwd.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    _to.copy(player.position).sub(this.mesh.position).normalize();
    const align = _fwd.dot(_to);
    if (this.state === 'ATTACK' && dist < 520 && align > 0.88 && this.gunCd <= 0) {
      if (Math.random() > 0.22) gun.tryFire(this.mesh, this.id, this.def.gunDamage, 7);
      this.gunCd = 0.12 + Math.random() * 0.1;
    }
    if (dist < 1400 && dist > 180 && align > 0.72 && this.missileCd <= 0 && this.missiles > 0 && Math.random() > 0.35) {
      if (missiles.launch(this.mesh, player, this.id, 28, 1.15)) {
        this.missiles--;
        this.missileCd = 6 + Math.random() * 4;
      }
    }
  }
}

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(type, position, home) {
    const e = new Enemy(this.scene, type, position, (home || position).clone());
    this.list.push(e);
    return e;
  }

  update(dt, player, time, gun, missiles) {
    for (const e of this.list) {
      if (!e.alive) continue;
      e.update(dt, player, time, gun, missiles);
    }
  }

  alive() {
    return this.list.filter((e) => e.alive);
  }

  removeDead(explosions, onKill) {
    for (const e of this.list) {
      if (!e.alive && !e._consumed) {
        e._consumed = true;
        explosions.explode(e.position.clone(), e.type === 'boss' ? 2.4 : 1.4, true);
        this.scene.remove(e.mesh);
        onKill(e);
      }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.mesh);
    this.list.length = 0;
  }

  getTargetables() {
    return this.alive();
  }
}
