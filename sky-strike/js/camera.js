import * as THREE from 'three';
import { lerp } from './flightModel.js';

const MODES = ['COCKPIT', 'CHASE', 'EXTERNAL'];

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.modeIndex = 1;
    this.lookActive = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.shake = 0;
    this.transition = 0;
    this.sensitivity = 1;
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._current = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._initialized = false;
  }

  get mode() {
    return MODES[this.modeIndex];
  }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    this.transition = 0.4;
    if (this.mode === 'COCKPIT') {
      this.lookYaw = 0;
      this.lookPitch = 0;
    }
  }

  setLook(active) {
    this.lookActive = active;
    if (!active) {
      this.lookYaw = 0;
      this.lookPitch = 0;
    }
  }

  addLook(dx, dy) {
    if (!this.lookActive && this.mode === 'COCKPIT') return;
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - dx * 0.005 * this.sensitivity, -Math.PI, Math.PI);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - dy * 0.004 * this.sensitivity, -1.1, 1.1);
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, aircraft, afterburner, speedNorm) {
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.transition > 0) this.transition = Math.max(0, this.transition - dt);

    this._fwd.set(0, 0, 1).applyQuaternion(aircraft.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(aircraft.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(aircraft.quaternion);

    const cockpit = this.mode === 'COCKPIT';
    const dist = this.mode === 'EXTERNAL' ? 48 : 24;
    const height = this.mode === 'EXTERNAL' ? 10 : 5.2;

    if (cockpit) {
      this._desired.copy(aircraft.position)
        .addScaledVector(this._fwd, 1.65)
        .addScaledVector(this._up, 1.05);
      this._look.copy(aircraft.position)
        .addScaledVector(this._fwd, 18)
        .addScaledVector(this._up, 0.8);
    } else {
      this._desired.copy(aircraft.position)
        .addScaledVector(this._fwd, -dist)
        .addScaledVector(this._up, height);
      this._look.copy(aircraft.position)
        .addScaledVector(this._fwd, 16)
        .addScaledVector(this._up, 2);
    }

    if (this.lookActive || Math.abs(this.lookYaw) + Math.abs(this.lookPitch) > 0.001) {
      const lookDist = cockpit ? 18 : dist * 0.35;
      this._look.copy(aircraft.position)
        .addScaledVector(this._fwd, Math.cos(this.lookYaw) * Math.cos(this.lookPitch) * lookDist)
        .addScaledVector(this._right, Math.sin(this.lookYaw) * lookDist)
        .addScaledVector(this._up, Math.sin(this.lookPitch) * lookDist + 1);
      if (!cockpit && this.lookActive) {
        this._desired.copy(aircraft.position)
          .addScaledVector(this._fwd, -Math.cos(this.lookYaw) * dist * 0.85)
          .addScaledVector(this._right, -Math.sin(this.lookYaw) * dist * 0.6)
          .addScaledVector(this._up, height + Math.sin(this.lookPitch) * 8);
      }
    }

    const snap = cockpit && this.transition <= 0;
    const follow = this.transition > 0 ? 7 : (cockpit ? 18 : 9);
    if (!this._initialized) {
      this._current.copy(this._desired);
      this.camera.position.copy(this._desired);
      this._initialized = true;
    } else if (snap) {
      this._current.copy(this._desired);
    } else {
      const k = 1 - Math.exp(-follow * dt);
      this._current.lerp(this._desired, k);
    }
    this.camera.position.copy(this._current);

    const vib = (cockpit ? 0.012 : 0.004) * speedNorm * speedNorm + (afterburner ? 0.05 : 0) + this.shake * 0.18;
    if (vib > 0) {
      this.camera.position.x += (Math.random() - 0.5) * vib;
      this.camera.position.y += (Math.random() - 0.5) * vib;
      this.camera.position.z += (Math.random() - 0.5) * vib;
    }

    this.camera.up.copy(cockpit ? this._up : this._tmp.set(0, 1, 0));
    this.camera.lookAt(this._look);
  }
}
