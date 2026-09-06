(() => {
  'use strict';

  const canvas = document.getElementById('nebula');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !window.Worker) return;

  const controls = document.getElementById('sky-controls');
  const regenerate = document.getElementById('new-nebula');
  const toggle = document.getElementById('motion-toggle');
  const skyId = document.getElementById('sky-id');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let worker;
  try {
    worker = new Worker(new URL('nebula-worker.js', document.currentScript.src));
  } catch {
    return;
  }

  let texture = null;
  let previousTexture = null;
  let frame = 0;
  let lastFrame = 0;
  let time = 0;
  let fade = 1;
  let paused = reducedMotion.matches;
  let width = 0;
  let height = 0;
  let generation = 0;
  let stars = [];
  const pointer = { x: 0, y: 0 };
  const drift = { x: 0, y: 0 };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 2200 / width);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (texture) draw();
  }

  function paintCloud(image, alpha) {
    const scale = Math.max(width / image.width, height / image.height) * 1.1;
    const w = image.width * scale;
    const h = image.height * scale;
    const dx = Math.sin(time * .055) * 9 + drift.x * 12;
    const dy = Math.cos(time * .04) * 7 + drift.y * 9;
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
  }

  function draw() {
    if (!texture) return;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#080a13';
    ctx.fillRect(0, 0, width, height);
    if (previousTexture && fade < 1) paintCloud(previousTexture, 1);
    paintCloud(texture, fade);
    ctx.globalAlpha = 1;
    for (const star of stars) {
      const x = star.x * width + drift.x * star.depth * 8;
      const y = star.y * height + drift.y * star.depth * 8;
      const twinkle = .78 + Math.sin(time * star.speed + star.phase) * .22;
      const alpha = star.alpha * twinkle;
      ctx.fillStyle = `rgba(${star.color},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.25) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 7);
        glow.addColorStop(0, `rgba(211,219,255,${alpha * .28})`);
        glow.addColorStop(1, 'rgba(190,205,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 11, y - 11, 22, 22);
        ctx.strokeStyle = `rgba(224,224,255,${alpha * .35})`;
        ctx.lineWidth = .5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
        ctx.stroke();
      }
    }
  }

  function animate(now) {
    frame = 0;
    if (paused || document.hidden || !texture) return;
    const elapsed = Math.min((now - lastFrame) / 1000, .06);
    if (now - lastFrame >= 32) {
      time += elapsed;
      lastFrame = now;
      fade = Math.min(1, fade + elapsed * .75);
      if (fade === 1) previousTexture = null;
      drift.x += (pointer.x - drift.x) * .035;
      drift.y += (pointer.y - drift.y) * .035;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume nebula animation' : 'Pause nebula animation');
    if (paused) {
      fade = 1;
      previousTexture = null;
      draw();
    } else if (!document.hidden && texture) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function generate() {
    regenerate.disabled = true;
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    worker.postMessage({ seed: values[0], width: 1100, height: 800 });
  }

  worker.onmessage = ({ data }) => {
    const nextTexture = document.createElement('canvas');
    nextTexture.width = data.width;
    nextTexture.height = data.height;
    nextTexture.getContext('2d').putImageData(new ImageData(data.pixels, data.width, data.height), 0, 0);
    previousTexture = texture;
    texture = nextTexture;
    fade = previousTexture && !paused ? 0 : 1;
    stars = Array.from({ length: 460 }, () => ({
      x: Math.random(), y: Math.random(),
      radius: Math.random() < .045 ? 1.3 + Math.random() * .35 : .3 + Math.random() * .7,
      alpha: .15 + Math.random() * .65,
      depth: .3 + Math.random(),
      speed: .3 + Math.random() * .7,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > .8 ? '236,211,199' : '212,221,244',
    }));
    generation += 1;
    skyId.textContent = `Nebula ${String(generation).padStart(3, '0')}`;
    controls.hidden = false;
    regenerate.disabled = false;
    canvas.classList.add('ready');
    draw();
    syncMotion();
  };

  worker.onerror = () => {
    worker.terminate();
    regenerate.disabled = true;
    regenerate.title = 'Nebula generation is unavailable';
    if (!texture) controls.hidden = true;
  };
  regenerate.addEventListener('click', generate);
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reducedMotion.addEventListener('change', (event) => { paused = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (event) => {
    if (paused || event.pointerType === 'touch') return;
    pointer.x = event.clientX / width - .5;
    pointer.y = event.clientY / height - .5;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
  resize();
  generate();
})();
