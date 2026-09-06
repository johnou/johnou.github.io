'use strict';

// Rendering happens off the main thread so links and controls remain responsive.
self.onmessage = ({ data: { seed, width, height } }) => {
  const { imul, floor, exp, pow, sin, min, max } = Math;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const random = (x, y) => {
    let n = imul(x, 374761393) + imul(y, 668265263) + seed;
    n = imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const ix = floor(x), iy = floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = random(ix, iy), b = random(ix + 1, iy);
    const c = random(ix, iy + 1), d = random(ix + 1, iy + 1);
    return a + fx * (b - a) + fy * (c - a + fx * (a - b - c + d));
  };
  const fbm = (x, y, octaves) => {
    let result = 0, amplitude = .5;
    for (let i = 0; i < octaves; i++) {
      result += noise(x, y) * amplitude;
      const nextX = x * 1.72 + y * 1.13 + 13.4;
      y = y * 1.72 - x * 1.13 + 7.9;
      x = nextX;
      amplitude *= .5;
    }
    return result;
  };
  const palettes = [
    [[.58, .19, .83], [.12, .53, .69], [.95, .53, .73]],
    [[.33, .25, .91], [.10, .61, .66], [.76, .48, .94]],
    [[.78, .25, .46], [.25, .31, .74], [1, .65, .40]],
    [[.40, .27, .80], [.15, .57, .72], [.82, .66, .94]],
  ];
  const palette = palettes[seed % palettes.length];
  const offset = (seed % 1000) / 17;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / width - .56) * 3.4;
      const ny = (y / height - .48) * 2.5;
      const u = nx * .85 - ny * .53;
      const v = nx * .53 + ny * .85;
      const q = fbm(u * 1.35 + offset, v * 1.35, 4);
      const r = fbm(u * 1.5 - 9, v * 1.5 + offset, 4);
      const cloud = fbm(u * 3 + q * 4 + offset, v * 3 + r * 3, 6);
      const detail = fbm(u * 12 + q * 5, v * 12 + r * 5, 3);
      const bend = v + (q - .45) * 1.3 + sin(u * 1.8) * .16;
      const envelope = exp(-bend * bend * 3.2 - u * u * .24);
      const body = max(0, cloud - .26) * envelope;
      const wisps = pow(body, 1.7) * 4.5;
      const dust = pow(max(0, .59 - cloud), 2) * 3.8;
      const seam = exp(-pow((bend + (r - .5) * .35) * 9, 2));
      const extinction = 1 - seam * (.5 + dust) * .66;
      const glow = pow(body, 3) * 13;
      const blend = min(1, max(0, bend * 2 + .5));
      const grain = (random(x + 700, y + 300) - .5) * 2;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const tint = palette[0][c] * (1 - blend) + palette[1][c] * blend;
        const light = (wisps * tint * (detail * 1.1 + .6) + glow * palette[2][c]) * extinction;
        pixels[i + c] = [6, 8, 17][c] + 225 * (1 - exp(-light * 1.65)) + grain;
      }
      pixels[i + 3] = 255;
    }
  }
  self.postMessage({ width, height, pixels, seed }, [pixels.buffer]);
};
