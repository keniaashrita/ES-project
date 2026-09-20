/**
 * Target Trajectory Generator for 0-50m 2D Grid
 */

export function generateTrajectoryPoint(type, timeSec, origin = { x: 25, y: 25 }) {
  let x = origin.x;
  let y = origin.y;
  let vx = 0;
  let vy = 0;
  let ax = 0;
  let ay = 0;
  let heading = 0;

  switch (type) {
    case 'Circular': {
      const radius = 16;
      const speed = 0.25; // rad/s
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
      const period = 32; // seconds for full perimeter
      const t = timeSec % period;
      const speed = (4 * side) / period;

      if (t < period * 0.25) {
        // Bottom side: moving right
        x = (origin.x - side / 2) + (t / (period * 0.25)) * side;
        y = origin.y - side / 2;
        vx = speed; vy = 0; heading = 0;
      } else if (t < period * 0.5) {
        // Right side: moving up
        x = origin.x + side / 2;
        y = (origin.y - side / 2) + ((t - period * 0.25) / (period * 0.25)) * side;
        vx = 0; vy = speed; heading = 90;
      } else if (t < period * 0.75) {
        // Top side: moving left
        x = (origin.x + side / 2) - ((t - period * 0.5) / (period * 0.25)) * side;
        y = origin.y + side / 2;
        vx = -speed; vy = 0; heading = 180;
      } else {
        // Left side: moving down
        x = origin.x - side / 2;
        y = (origin.y + side / 2) - ((t - period * 0.75) / (period * 0.25)) * side;
        vx = 0; vy = -speed; heading = 270;
      }
      break;
    }

    case 'Straight Line': {
      const distance = 36;
      const speed = 1.2; // m/s
      const cycle = (timeSec * speed) % (distance * 2);
      const currDist = cycle < distance ? cycle : (2 * distance - cycle);
      const direction = cycle < distance ? 1 : -1;

      x = (origin.x - distance / 2) + currDist;
      y = origin.y + 0.15 * Math.sin(timeSec * 0.8);
      vx = speed * direction;
      vy = 0;
      heading = direction > 0 ? 0 : 180;
      break;
    }

    case 'Random Walk': {
      const scale = 15;
      const f1 = 0.18, f2 = 0.32, f3 = 0.11;
      x = origin.x + scale * Math.sin(timeSec * f1) * Math.cos(timeSec * f3);
      y = origin.y + scale * Math.cos(timeSec * f2) * Math.sin(timeSec * f1);
      vx = scale * (f1 * Math.cos(timeSec * f1) * Math.cos(timeSec * f3) - f3 * Math.sin(timeSec * f1) * Math.sin(timeSec * f3));
      vy = scale * (-f2 * Math.sin(timeSec * f2) * Math.sin(timeSec * f1) + f1 * Math.cos(timeSec * f2) * Math.cos(timeSec * f1));
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }

    case 'Custom':
    default: {
      // Elegant Lemniscate (Figure-8)
      const a = 16;
      const speed = 0.2;
      const t = timeSec * speed;
      x = origin.x + (a * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      y = origin.y + (a * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      vx = -a * Math.sin(t);
      vy = a * Math.cos(2 * t);
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }
  }

  // Constrain inside 0-50m perimeter with 2m margin
  x = Math.max(2, Math.min(48, x));
  y = Math.max(2, Math.min(48, y));

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    vx: Number(vx.toFixed(2)),
    vy: Number(vy.toFixed(2)),
    ax: Number(ax.toFixed(2)),
    ay: Number(ay.toFixed(2)),
    heading: Number(heading.toFixed(1))
  };
}