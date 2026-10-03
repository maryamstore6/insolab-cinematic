/* ============================================================
   INSOLAB — Hero WebGL scene
   Bright, organic, lightweight. Three.js r169 (ES module).
   Perf-guarded: adapts to weak GPUs, respects reduced-motion.
   ============================================================ */

import * as THREE from '../lib/three.module.js';

const canvas = document.getElementById('hero-canvas');

if (canvas) {
  init();
}

function init() {
  /* ---------- capability checks ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    // No WebGL — CSS blooms alone still carry the hero.
    canvas.style.display = 'none';
    return;
  }

  /* ---------- quality tiers ---------- */
  const cores = navigator.hardwareConcurrency || 4;
  const lowEnd = cores <= 2;
  const Q = {
    dpr:        Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5),
    segments:   lowEnd ? 40 : 72,
    particles:  lowEnd ? 60 : 150,
    shadows:    false
  };

  renderer.setPixelRatio(Q.dpr);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    38,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0.15, 5.4);

  /* ---------- lighting: neutral key + brand teal rim ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe6f5f7, 1.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(4, 6, 5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x00b3b8, 1.6);
  rim.position.set(-5, 1.5, -3);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xbfd4f0, 0.9);
  fill.position.set(-2, -3, 4);
  scene.add(fill);

  /* ---------- the form: organic elongated blob ---------- */
  const geo = new THREE.SphereGeometry(1, Q.segments, Q.segments);

  // Pseudo-noise displacement (cheap, no external lib)
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const noise = (x, y, z) =>
    Math.sin(x * 2.1 + y * 1.3) * 0.5 +
    Math.sin(y * 2.7 + z * 1.9) * 0.3 +
    Math.sin(z * 3.3 + x * 2.2) * 0.2;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise(v.x * 1.6, v.y * 1.6, v.z * 1.6);
    const len = v.length();
    const push = 1 + n * 0.13;
    v.multiplyScalar(push);
    // elongate on Z → footbed-like silhouette
    v.z *= 1.42;
    // taper the "toe" end slightly
    const taper = 1 - Math.max(0, v.z) * 0.11;
    v.x *= taper;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x00777c,
    roughness: 0.42,
    metalness: 0.06,
    flatShading: false
  });

  const form = new THREE.Mesh(geo, mat);
  form.position.set(0, 0, 0);
  form.scale.setScalar(1.38);
  scene.add(form);

  /* ---------- wireframe shell for a technical, precise feel ---------- */
  const wireGeo = new THREE.SphereGeometry(1.09, Math.round(Q.segments / 3), Math.round(Q.segments / 3));
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x0b3d91,
    wireframe: true,
    transparent: true,
    opacity: 0.11
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.scale.set(1.38, 1.38, 1.38 * 1.42);
  scene.add(wire);

  /* ---------- floating particles ---------- */
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(Q.particles * 3);
  const pSeed = new Float32Array(Q.particles);
  for (let i = 0; i < Q.particles; i++) {
    pPos[i * 3]     = (Math.random() - 0.5) * 9;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 7;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    pSeed[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

  const pMat = new THREE.PointsMaterial({
    color: 0x00b3b8,
    size: 0.034,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    depthWrite: false
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- interaction state ---------- */
  const pointer = { x: 0, y: 0 };
  const target  = { x: 0, y: 0 };

  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------- resize ---------- */
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize, { passive: true });

  // The panel's size can change without a window resize (font load,
  // layout reflow, orientation change) — watch the element itself.
  if ('ResizeObserver' in window) {
    let pending = null;
    const ro = new ResizeObserver(() => {
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(resize);
    });
    ro.observe(canvas);
  }

  /* ---------- visibility gating (don't burn CPU offscreen) ---------- */
  let onScreen = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
    }, { threshold: 0.01 }).observe(canvas);
  }
  let tabVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
  });

  /* ---------- FPS watchdog → drop quality if struggling ---------- */
  let frames = 0;
  let acc = 0;
  let degraded = false;
  let totalFrames = 0;

  function watchdog(dt) {
    if (degraded || reducedMotion) return;
    frames++;
    totalFrames++;
    acc += dt;
    if (acc >= 2) {
      const fps = frames / acc;
      if (fps < 32) {
        // step down: fewer particles, lower resolution
        degraded = true;
        particles.visible = false;
        renderer.setPixelRatio(Math.min(1, Q.dpr));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      }
      frames = 0;
      acc = 0;
    }
  }

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  let running = true;

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);

    const dt = Math.min(clock.getDelta(), 0.05);
    if (!onScreen || !tabVisible) return;

    watchdog(dt);

    // eased pointer follow
    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    const t = clock.elapsedTime;

    if (!reducedMotion) {
      // slow organic drift
      form.rotation.y = t * 0.16 + pointer.x * 0.42;
      form.rotation.x = Math.sin(t * 0.22) * 0.11 + pointer.y * 0.22;
      form.rotation.z = Math.sin(t * 0.15) * 0.06;

      wire.rotation.copy(form.rotation);
      wire.rotation.y += 0.09;

      form.position.y = Math.sin(t * 0.55) * 0.07;
      wire.position.y = form.position.y;

      // particle drift
      if (particles.visible) {
        particles.rotation.y = -t * 0.035;
        particles.position.y = Math.sin(t * 0.3) * 0.12;
      }
    } else {
      form.rotation.set(0.15, 0.4, 0);
      wire.rotation.copy(form.rotation);
    }

    // gentle camera parallax
    camera.position.x += (pointer.x * 0.42 - camera.position.x) * 0.035;
    camera.position.y += (0.15 - pointer.y * 0.28 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  resize();
  tick();

  /* ---------- teardown hook ---------- */
  window.__insolabHero3D = {
    stop() { running = false; },
    dispose() {
      running = false;
      geo.dispose(); mat.dispose();
      wireGeo.dispose(); wireMat.dispose();
      pGeo.dispose(); pMat.dispose();
      renderer.dispose();
    },
    quality: degraded ? 'degraded' : (lowEnd ? 'low' : 'full'),
    stats() { return { totalFrames, degraded, particles: particles.visible, pixelRatio: renderer.getPixelRatio() }; }
  };
}
