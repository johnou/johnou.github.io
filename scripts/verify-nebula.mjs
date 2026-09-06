import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const workerSource = readFileSync(new URL('../assets/js/nebula-worker.js', import.meta.url), 'utf8');
let result;
const workerContext = vm.createContext({ self: { postMessage: (data) => { result = data; } } });
vm.runInContext(workerSource, workerContext);
function render(seed, width = 120, height = 90) {
  workerContext.self.onmessage({ data: { seed, width, height } });
  return result;
}
const first = render(42);
assert.equal(first.pixels.length, 120 * 90 * 4);
assert.ok(first.pixels.every((value, i) => i % 4 !== 3 || value === 255));
assert.deepEqual(first.pixels, render(42).pixels, 'Same seed should reproduce the cloud');
assert.notDeepEqual(first.pixels, render(43).pixels, 'New seeds should produce different clouds');
const brightness = [];
for (let i = 0; i < first.pixels.length; i += 4) brightness.push(Math.max(...first.pixels.slice(i, i + 3)));
assert.ok(Math.max(...brightness) - Math.min(...brightness) > 100, 'Cloud should contain dark space and bright detail');
const start = performance.now();
render(4294967295, 1100, 800);
console.log(`Full-resolution nebula generated in ${Math.round(performance.now() - start)} ms`);

const mainSource = readFileSync(new URL('../assets/js/nebula.js', import.meta.url), 'utf8');
function runScene({ reduced = false, workers = true } = {}) {
  const events = new Map();
  const frames = new Map();
  let nextFrame = 0;
  let drawCount = 0;
  let worker;
  const context2d = new Proxy({}, { get: (_, key) => {
    if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key === 'drawImage') return () => { drawCount++; };
    return () => {};
  } });
  function element(id) {
    return { hidden: true, disabled: false, attrs: {}, classList: { add() {} },
      getContext: () => context2d,
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(name, fn) { events.set(`${id}:${name}`, fn); },
    };
  }
  const ids = ['nebula', 'sky-controls', 'new-nebula'];
  const elements = Object.fromEntries(ids.map(id => [id, element(id)]));
  const document = { hidden: false, currentScript: { src: 'http://localhost/assets/js/nebula.js' },
    getElementById: id => elements[id], createElement: () => element('canvas'),
    addEventListener: (name, fn) => events.set(`document:${name}`, fn),
  };
  class Worker {
    constructor() { worker = this; }
    postMessage(message) { this.request = message; }
    terminate() { this.terminated = true; }
  }
  const motionPreference = { matches: reduced, addEventListener: (name, fn) => events.set(`media:${name}`, fn) };
  const window = { Worker: workers ? Worker : undefined, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 2,
    matchMedia: () => motionPreference,
    addEventListener: (name, fn) => events.set(`window:${name}`, fn),
  };
  vm.runInNewContext(mainSource, { document, window, Worker, URL, performance,
    crypto: { getRandomValues: array => { array[0] = 42; } },
    ImageData: class {},
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  return { elements, events, frames, worker, document, window, motionPreference, draws: () => drawCount };
}
const scene = runScene();
assert.equal(scene.worker.request.width, 1100);
assert.equal(scene.elements['new-nebula'].disabled, true);
scene.worker.onmessage({ data: first });
assert.equal(scene.elements['sky-controls'].hidden, false);
assert.equal(scene.elements['new-nebula'].disabled, false);
assert.equal(scene.frames.size, 1);
scene.motionPreference.matches = true;
scene.events.get('media:change')();
assert.equal(scene.frames.size, 0);
scene.events.get('new-nebula:click')();
scene.worker.onmessage({ data: render(43) });
assert.equal(scene.elements['new-nebula'].disabled, false);
assert.equal(scene.frames.size, 0, 'Regenerating with reduced motion must not restart animation');
scene.motionPreference.matches = false;
scene.events.get('media:change')();
scene.document.hidden = true;
scene.events.get('document:visibilitychange')();
assert.equal(scene.frames.size, 0, 'Hidden tabs should not animate');
scene.document.hidden = false;
scene.events.get('document:visibilitychange')();
assert.equal(scene.frames.size, 1);
scene.motionPreference.matches = true;
scene.events.get('media:change')();
assert.equal(scene.frames.size, 0, 'A changed reduced-motion preference should stop motion');
scene.window.innerWidth = 390;
scene.window.innerHeight = 844;
scene.events.get('window:resize')();
assert.equal(scene.elements.nebula.width, 585);
assert.ok(scene.draws() > 0);
const reducedScene = runScene({ reduced: true });
reducedScene.worker.onmessage({ data: first });
assert.equal(reducedScene.frames.size, 0, 'Reduced motion must render a still sky');
const fallback = runScene({ workers: false });
assert.equal(fallback.elements['sky-controls'].hidden, true);
const failure = runScene();
failure.worker.onerror();
assert.ok(failure.worker.terminated);
assert.equal(failure.elements['sky-controls'].hidden, true);
console.log('Passed: seeded rendering, new skies, reduced motion, background tabs, resize, and fallback behavior.');
