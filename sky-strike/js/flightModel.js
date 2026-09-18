import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _euler = new THREE.Euler();

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class FlightModel {
  constructor(stats) {
    this.speed = 0;
    this.throttle = 0;
    this.afterburner = false;
    this.airbrake = false;
    this.boostEnergy = 1;
    this.fuel = 1;
    this.aoa = 0;
    this.gForce = 1;
    this.grounded = true;
    this.stats = stats;
    this.verticalSpeed = 0;
    this.airborneTime = 0;
  }

  update(dt, mesh, input, worldHeight, onRunway) {
    const stats = this.stats;
    const sens = input.sensitivity || 1;

    this.throttle = clamp(this.throttle + input.throttle * dt * 0.55, 0, 1);

    if (this.afterburner && this.boostEnergy > 0 && this.fuel > 0.02) {
      this.boostEnergy = clamp(this.boostEnergy - dt * 0.16, 0, 1);
      if (this.boostEnergy <= 0) this.afterburner = false;
    } else if (!this.afterburner) {
      this.boostEnergy = clamp(this.boostEnergy + dt * 0.09, 0, 1);
    }

    this.fuel = clamp(this.fuel - (0.004 + this.throttle * 0.008 + (this.afterburner ? 0.03 : 0)) * dt, 0, 1);
    if (this.fuel <= 0.01) {
      this.throttle = Math.min(this.throttle, 0.28);
      this.afterburner = false;
    }

    _fwd.set(0, 0, 1).applyQuaternion(mesh.quaternion);
    _up.set(0, 1, 0).applyQuaternion(mesh.quaternion);
    _right.set(1, 0, 0).applyQuaternion(mesh.quaternion);
    _euler.setFromQuaternion(mesh.quaternion, 'YXZ');

    const agility = stats.agility * sens;
    const speedNorm = clamp(this.speed / stats.maxSpeed, 0, 1);
    const control = this.grounded ? 0.35 : 0.45 + speedNorm * 0.7;

    if (this.grounded) {
      mesh.rotateY(-input.yaw * agility * 0.9 * dt - input.roll * agility * 0.55 * dt);
      const pitchUp = input.pitch < -0.18 && this.speed > stats.stallSpeed * 0.85;
      if (pitchUp) {
        this.grounded = false;
        this.airborneTime = 0;
        mesh.rotateX(-0.22);
      }
    } else {
      this.airborneTime += dt;
      if (this.airborneTime < 1.15) mesh.rotateX(-0.16 * dt);
      mesh.rotateZ(-input.roll * agility * 2.35 * control * dt);
      mesh.rotateX(input.pitch * agility * 1.28 * control * dt);
      mesh.rotateY(-input.yaw * agility * 0.85 * control * dt);
      mesh.rotateY(-Math.sin(_euler.z) * (0.55 + speedNorm * 0.85) * dt);
    }

    const max = this.afterburner ? stats.maxSpeed * 1.42 : stats.maxSpeed;
    let target = 8 + this.throttle * (max - 8);
    if (this.grounded) target = Math.min(target, 88);
    if (this.airbrake) target *= this.grounded ? 0.15 : 0.42;
    if (!this.grounded) target += -_fwd.y * 70;
    if (this.grounded && this.throttle < 0.05) target = 0;

    const accel = (this.afterburner ? 48 : 26) / (stats.mass || 1);
    const decel = this.airbrake ? 55 : 16;
    if (this.speed < target) this.speed = Math.min(target, this.speed + accel * dt);
    else this.speed = Math.max(target, this.speed - decel * dt);
    this.speed = Math.max(0, this.speed);

    mesh.position.addScaledVector(_fwd, this.speed * dt);

    if (!this.grounded) {
      const grav = 15;
      const lift = clamp(this.speed / stats.cruiseSpeed, 0, 1.7) * 16 * Math.max(0.08, _up.y);
      this.verticalSpeed = lerp(this.verticalSpeed, lift - grav, 1 - Math.exp(-5 * dt));
      mesh.position.y += this.verticalSpeed * dt;
    } else {
      this.verticalSpeed = 0;
      mesh.position.y = worldHeight + 2.15;
      if (!onRunway && this.speed > this.stats.stallSpeed * 0.85) {
        this.grounded = false;
        this.airborneTime = 0;
        mesh.rotateX(-0.28);
        mesh.position.y = Math.max(worldHeight + 18, mesh.position.y + 8);
      }
    }

    const minY = worldHeight + 2.15;
    if (mesh.position.y < minY) {
      mesh.position.y = minY;
      const diving = _fwd.y < -0.62;
      if (onRunway) {
        if (!this.grounded && this.speed < 78 && Math.abs(_euler.x) < 0.32 && Math.abs(_euler.z) < 0.32) {
          this.grounded = true;
          this.verticalSpeed = 0;
          return 'landed';
        }
        this.grounded = true;
        this.verticalSpeed = 0;
      } else if (diving && this.speed > 100 && this.airborneTime > 2) {
        return 'crash';
      } else {
        this.grounded = false;
        mesh.position.y = minY + 18;
        this.verticalSpeed = 22;
        mesh.rotateX(-0.18);
      }
    }

    this.gForce = 1 + Math.abs(input.pitch) * 2 + Math.abs(input.roll) * 1.2;
    return null;
  }
}
