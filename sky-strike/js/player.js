import * as THREE from 'three';
import { AIRCRAFT_DEFS, createAircraftMesh, updateExhaust, setPylonVisibility } from './aircraft.js';
import { FlightModel } from './flightModel.js';

export class Player {
  constructor(scene, typeId) {
    this.id = 'player';
    this.def = AIRCRAFT_DEFS[typeId] || AIRCRAFT_DEFS.raptor;
    this.mesh = createAircraftMesh(this.def);
    this.flight = new FlightModel({ ...this.def });
    this.maxHealth = this.def.armor;
    this.health = this.def.armor;
    this.missiles = this.def.missiles;
    this.maxMissiles = this.def.missiles;
    this.alive = true;
    this.lockTimer = 0;
    this.locked = false;
    this.target = null;
    this.hitsTaken = 0;
    this.hurt = false;
    this.gunKills = 0;
    this.position = this.mesh.position;
    this.onMissileHit = null;
    this.contrail = this._makeContrail();
    this.mesh.add(this.contrail);
    scene.add(this.mesh);
    this.resetPose();
  }

  _makeContrail() {
    const geo = new THREE.BufferGeometry();
    const count = 40;
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xddf4ff, size: 0.9, transparent: true, opacity: 0.35 });
    const p = new THREE.Points(geo, mat);
    p.visible = false;
    p.frustumCulled = false;
    p.userData.count = count;
    p.userData.i = 0;
    return p;
  }

  resetPose() {
    this.mesh.position.set(0, 16.2, -780);
    this.mesh.quaternion.identity();
    this.mesh.rotation.set(0, 0, 0);
    this.flight.speed = 0;
    this.flight.throttle = 0;
    this.flight.afterburner = false;
    this.flight.airbrake = false;
    this.flight.boostEnergy = 1;
    this.flight.fuel = 1;
    this.flight.grounded = true;
    this.flight.verticalSpeed = 0;
    this.flight.airborneTime = 0;
    this.health = this.maxHealth;
    this.missiles = this.maxMissiles;
    this.alive = true;
    this.locked = false;
    this.lockTimer = 0;
    this.target = null;
    this.hitsTaken = 0;
    this.hurt = false;
    setPylonVisibility(this.mesh, this.missiles);
  }

  get heading() {
    const e = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    let deg = THREE.MathUtils.radToDeg(e.y);
    deg = (deg + 360) % 360;
    return deg;
  }

  applyDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.hitsTaken += amount;
    this.hurt = true;
    if (this.health <= 0) this.alive = false;
  }

  update(dt, input, world, time) {
    if (!this.alive) return 'dead';
    this.flight.afterburner = !!(input.afterburner && this.flight.boostEnergy > 0.05);
    this.flight.airbrake = !!input.airbrake;
    const y = world.getHeight(this.mesh.position.x, this.mesh.position.z);
    const onRunway = world.isOnRunway(this.mesh.position.x, this.mesh.position.z);
    const event = this.flight.update(dt, this.mesh, input, y, onRunway);
    updateExhaust(this.mesh, this.flight.throttle, this.flight.afterburner, time);
    setPylonVisibility(this.mesh, this.missiles);
    this._updateContrail(dt);
    if (this.mesh.userData.cockpitInterior) {
      this.mesh.userData.cockpitInterior.visible = true;
    }
    return event;
  }

  _updateContrail(dt) {
    const show = this.flight.speed > 220 && this.mesh.position.y > 180;
    this.contrail.visible = show;
    if (!show) return;
    const arr = this.contrail.geometry.attributes.position.array;
    const i = this.contrail.userData.i % this.contrail.userData.count;
    arr[i * 3] = 0.7;
    arr[i * 3 + 1] = 0;
    arr[i * 3 + 2] = -7;
    this.contrail.userData.i++;
    this.contrail.geometry.attributes.position.needsUpdate = true;
  }
}
