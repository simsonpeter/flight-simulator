export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sweep = 0;
    this.range = 3800;
  }

  update(dt, data) {
    this.sweep += dt * 1.8;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 6;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 30, 28, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,255,212,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * i / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const ang = -data.heading * Math.PI / 180;
    const draw = (x, z, color, size = 3) => {
      const dx = x - data.x;
      const dz = z - data.z;
      const rx = dx * Math.cos(ang) - dz * Math.sin(ang);
      const rz = dx * Math.sin(ang) + dz * Math.cos(ang);
      const px = cx + (rx / this.range) * r;
      const py = cy - (rz / this.range) * r;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    };

    ctx.fillStyle = 'rgba(125,255,212,0.18)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, this.sweep, this.sweep + 0.45);
    ctx.closePath();
    ctx.fill();

    if (data.objectives) {
      for (const o of data.objectives) draw(o.x, o.z, '#e7c36a', 4);
    }
    for (const e of data.enemies) draw(e.x, e.z, '#ff4a4a', 3.2);
    for (const m of data.missiles) draw(m.x, m.z, '#ffaa33', 2.2);
    ctx.fillStyle = '#7dffd4';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.lineTo(cx + 4, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(125,255,212,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
