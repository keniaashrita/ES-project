export function generateTrajectoryPoint(type, timeSec, origin = { x: 25, y: 25 }) {
  let x = origin.x, y = origin.y, vx = 0, vy = 0, ax = 0, ay = 0, heading = 0;

  switch (type) {
    case 'Circular': {
      const radius = 16;
      const speed = 0.25;
      const angle = (timeSec * speed) % (2 * Math.PI);
      x = origin.x + radius * Math.cos(angle);
      y = origin.y + radius * Math.sin(angle);
      vx = -radius * speed * Math.sin(angle);
      vy = radius * speed * Math.cos(angle);
      ax = -radius * speed * speed * Math.cos(angle);
      ay = -radius * speed * speed * Math.sin(angle);
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }
    case 'Square': {
      const side = 28;
      const period = 32;
      const t = timeSec % period;
      const speed = (4 * side) / period;
      if (t < period * 0.25) {
        x = (origin.x - side / 2) + (t / (period * 0.25)) * side;
        y = origin.y - side / 2;
        vx = speed; heading = 0;
      } else if (t < period * 0.5) {
        x = origin.x + side / 2;
        y = (origin.y - side / 2) + ((t - period * 0.25) / (period * 0.25)) * side;
        vy = speed; heading = 90;
      } else if (t < period * 0.75) {
        x = (origin.x + side / 2) - ((t - period * 0.5) / (period * 0.25)) * side;
        y = origin.y + side / 2;
        vx = -speed; heading = 180;
      } else {
        x = origin.x - side / 2;
        y = (origin.y + side / 2) - ((t - period * 0.75) / (period * 0.25)) * side;
        vy = -speed; heading = 270;
      }
      break;
    }
    case 'Straight Line': {
      const distance = 36;
      const speed = 1.2;
      const cycle = (timeSec * speed) % (distance * 2);
      const currDist = cycle < distance ? cycle : (2 * distance - cycle);
      const direction = cycle < distance ? 1 : -1;
      x = (origin.x - distance / 2) + currDist;
      y = origin.y;
      vx = speed * direction;
      heading = direction > 0 ? 0 : 180;
      break;
    }
    case 'Random Walk': {
      const scale = 15;
      x = origin.x + scale * Math.sin(timeSec * 0.18) * Math.cos(timeSec * 0.11);
      y = origin.y + scale * Math.cos(timeSec * 0.32) * Math.sin(timeSec * 0.18);
      heading = (Math.atan2(Math.cos(timeSec * 0.32), Math.sin(timeSec * 0.18)) * (180 / Math.PI) + 360) % 360;
      break;
    }
    default: {
      const a = 16, speed = 0.2, t = timeSec * speed;
      x = origin.x + (a * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      y = origin.y + (a * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      vx = -a * Math.sin(t);
      vy = a * Math.cos(2 * t);
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }
  }

  return {
    x: Number(Math.max(2, Math.min(48, x)).toFixed(2)),
    y: Number(Math.max(2, Math.min(48, y)).toFixed(2)),
    vx: Number(vx.toFixed(2)),
    vy: Number(vy.toFixed(2)),
    ax: Number(ax.toFixed(2)),
    ay: Number(ay.toFixed(2)),
    heading: Number(heading.toFixed(1))
  };
}
