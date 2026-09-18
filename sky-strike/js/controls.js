export class InputState {
  constructor() {
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.throttle = 0;
    this.fire = false;
    this.missile = false;
    this.airbrake = false;
    this.afterburner = false;
    this.sensitivity = 1;
  }

  resetAxes() {
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.throttle = 0;
  }
}

export class DesktopControls {
  constructor(input, canvas, hooks) {
    this.input = input;
    this.hooks = hooks;
    this.keys = new Set();
    this.enabled = false;

    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onMouseUp = (e) => this.onMouseUp(e);
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onContext = (e) => e.preventDefault();
    this._onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.input.throttle += e.deltaY > 0 ? -0.6 : 0.6;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.input.fire = false;
      this.input.afterburner = false;
      this.input.airbrake = false;
    });
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('contextmenu', this._onContext);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.input.fire = false;
      this.input.missile = false;
      this.input.afterburner = false;
      this.input.airbrake = false;
    }
  }

  onKeyDown(e) {
    if (!this.enabled) return;
    const k = e.code;
    if (['Space', 'Tab', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'].includes(k)) e.preventDefault();
    if (this.keys.has(k)) {
      this.keys.add(k);
      return;
    }
    this.keys.add(k);
    if (k === 'KeyV') this.hooks.onCamera();
    if (k === 'Tab') this.hooks.onTarget();
    if (k === 'Escape') this.hooks.onPause();
    if (k === 'KeyR') {
      this.input.afterburner = true;
      this.hooks.onAfterburner();
    }
    if (k === 'KeyF') this.hooks.onLookToggle();
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
    if (e.code === 'KeyR') this.input.afterburner = false;
  }

  onMouseDown(e) {
    if (!this.enabled) return;
    if (e.button === 0) this.input.fire = true;
    if (e.button === 2) {
      this.input.missile = true;
      this.hooks.onMissile();
    }
    if (e.button === 1) this.hooks.onLookToggle();
  }

  onMouseUp(e) {
    if (e.button === 0) this.input.fire = false;
    if (e.button === 2) this.input.missile = false;
  }

  onMouseMove(e) {
    if (!this.enabled) return;
    if (this.hooks.isLookActive()) this.hooks.onLook(e.movementX, e.movementY);
  }

  update() {
    if (!this.enabled) return;
    const k = this.keys;
    this.input.pitch = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    this.input.roll = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    this.input.yaw = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    this.input.throttle = (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0) - (k.has('ControlLeft') || k.has('ControlRight') ? 1 : 0);
    this.input.airbrake = k.has('Space');
    if (k.has('KeyR')) this.input.afterburner = true;
  }
}
