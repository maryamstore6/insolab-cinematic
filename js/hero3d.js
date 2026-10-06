/* ============================================================
   INSOLAB — Hero 3D Insole Render
   Realistic custom insole with arch support, heel cup,
   perforation texture, and studio lighting.
   Three.js r169 (ES module).
   ============================================================ */

import * as THREE from '../lib/three.module.js';

const canvas = document.getElementById('hero-canvas');

if (canvas) {
  init();
}

function init() {
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
    canvas.style.display = 'none';
    return;
  }

  const cores = navigator.hardwareConcurrency || 4;
  const lowEnd = cores <= 2;
  const Q = {
    dpr: Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5),
    segments: lowEnd ? 40 : 72,
    particles: lowEnd ? 60 : 150,
    shadows: false
  };

  renderer.setPixelRatio(Q.dpr);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    38,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0.35, 4.3);
  camera.lookAt(0, 0, 0);

  /* ---------- lighting: soft studio ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe6f5f7, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x00b3b8, 1.1);
  rim.position.set(-5, 1.5, -3);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xbfd4f0, 0.55);
  fill.position.set(-2, -3, 4);
  scene.add(fill);

  /* ============================================================
     INSOLE GEOMETRY — parametric surface
     ============================================================ */

  const INSOLE = {
    length: 2.8,
    widthFore: 0.95,
    widthMid: 0.65,
    widthHeel: 0.75,
    thickness: 0.04,
    archHeight: 0.18,
    heelCupDepth: 0.12,
    heelRise: 0.55,
    toeSpring: 0.06
  };

  function insolePoint(u, v) {
    // Width profile across the length. Round the toe off (taper over the last
    // 18%) so the silhouette reads as a footbed rather than a squared blank.
    const widthProfile = (t) => {
      let w;
      if (t < 0.3) {
        const s = t / 0.3;
        w = INSOLE.widthHeel + (INSOLE.widthMid - INSOLE.widthHeel) * s;
      } else {
        const s = (t - 0.3) / 0.7;
        const smooth = s * s * (3 - 2 * s);
        w = INSOLE.widthMid + (INSOLE.widthFore - INSOLE.widthMid) * smooth;
      }
      // rounded toe
      if (t > 0.82) {
        const k = (t - 0.82) / 0.18;
        w *= 1 - 0.45 * (k * k);
      }
      // slightly rounded heel too
      if (t < 0.12) {
        const k = 1 - t / 0.12;
        w *= 1 - 0.22 * (k * k);
      }
      return w;
    };

    const halfWidth = widthProfile(u) / 2;
    const x = (v - 0.5) * 2 * halfWidth;
    const z = u * INSOLE.length;

    let y = INSOLE.thickness / 2;
    y += INSOLE.toeSpring * Math.pow(u, 3);

    const archCenter = 0.35;
    const archWidth = 0.12;
    const archU = Math.exp(-Math.pow((u - archCenter) / archWidth, 2));
    const archV = Math.exp(-Math.pow((v - 0.15) / 0.3, 2));
    y += INSOLE.archHeight * archU * archV;

    const heelCenter = 0.08;
    const heelWidth = 0.15;
    const heelU = Math.exp(-Math.pow((u - heelCenter) / heelWidth, 2));
    const heelV = Math.abs(v - 0.5) * 2;
    y += INSOLE.heelCupDepth * heelU * (heelV * heelV - 0.3);

    const heelRiseStart = 0.25;
    if (u < heelRiseStart) {
      const t = 1 - u / heelRiseStart;
      const smooth = t * t * (3 - 2 * t);
      y += INSOLE.heelRise * smooth * smooth;
    }

    const medialRaise = 0.06 * Math.exp(-Math.pow((v - 0.1) / 0.2, 2)) *
                         Math.exp(-Math.pow((u - 0.4) / 0.3, 2));
    y += medialRaise;

    return new THREE.Vector3(x, y, z);
  }

  const segU = Q.segments;
  const segV = Math.floor(Q.segments * 0.6);
  const geometry = new THREE.BufferGeometry();

  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segU; i++) {
    for (let j = 0; j <= segV; j++) {
      const u = i / segU;
      const v = j / segV;
      const p = insolePoint(u, v);
      vertices.push(p.x, p.y, p.z);
      uvs.push(v, u);
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const thickness = INSOLE.thickness;
  const bottomVertices = [];
  for (let i = 0; i < vertices.length; i += 3) {
    bottomVertices.push(vertices[i], vertices[i + 1] - thickness, vertices[i + 2]);
  }

  const allVertices = [...vertices, ...bottomVertices];
  const allUvs = [...uvs, ...uvs];
  const allIndices = [...indices];

  const offset = vertices.length / 3;
  for (let i = 0; i < indices.length; i += 3) {
    allIndices.push(indices[i] + offset, indices[i + 2] + offset, indices[i + 1] + offset);
  }

  for (let i = 0; i < segU; i++) {
    const a = i * (segV + 1);
    const b = (i + 1) * (segV + 1);
    allIndices.push(a, a + offset, b);
    allIndices.push(b, a + offset, b + offset);

    const c = i * (segV + 1) + segV;
    const d = (i + 1) * (segV + 1) + segV;
    allIndices.push(c, d, c + offset);
    allIndices.push(d, d + offset, c + offset);
  }

  const toeOffset = segU * (segV + 1);
  for (let j = 0; j < segV; j++) {
    const a = j;
    const b = j + 1;
    allIndices.push(a, b, a + offset);
    allIndices.push(b, b + offset, a + offset);
  }

  for (let j = 0; j < segV; j++) {
    const a = toeOffset + j;
    const b = toeOffset + j + 1;
    allIndices.push(a, a + offset, b);
    allIndices.push(b, a + offset, b + offset);
  }

  const fullGeometry = new THREE.BufferGeometry();
  fullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
  fullGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
  fullGeometry.setIndex(allIndices);
  fullGeometry.computeVertexNormals();

  /* ---------- materials ---------- */

  const topMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,             // the texture carries the colour
    roughness: 0.55,
    metalness: 0.0,
    side: THREE.FrontSide
  });

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: 0xF0F0F0,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.FrontSide
  });

  const perfCanvas = document.createElement('canvas');
  perfCanvas.width = 512;
  perfCanvas.height = 512;
  const perfCtx = perfCanvas.getContext('2d');
  // Brand navy as the base. Lighting + ACES tone mapping lighten this a lot,
  // so start saturated or the surface lands on grey.
  perfCtx.fillStyle = '#0B3D91';
  perfCtx.fillRect(0, 0, 512, 512);

  perfCtx.fillStyle = '#062A66';
  const dotSpacing = 16;
  const dotRadius = 3;
  for (let y = 0; y < 512; y += dotSpacing) {
    for (let x = 0; x < 512; x += dotSpacing) {
      const offsetX = (y / dotSpacing) % 2 === 0 ? 0 : dotSpacing / 2;
      perfCtx.beginPath();
      perfCtx.arc(x + offsetX, y, dotRadius, 0, Math.PI * 2);
      perfCtx.fill();
    }
  }

  const perfTexture = new THREE.CanvasTexture(perfCanvas);
  perfTexture.wrapS = THREE.RepeatWrapping;
  perfTexture.wrapT = THREE.RepeatWrapping;
  perfTexture.repeat.set(4, 8);
  // Without an explicit colour space three.js treats the canvas as linear
  // data, so the brand blue renders washed-out grey on screen.
  perfTexture.colorSpace = THREE.SRGBColorSpace;
  perfTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  topMaterial.map = perfTexture;

  const insoleMesh = new THREE.Mesh(fullGeometry, [topMaterial, bottomMaterial]);

  const topFaceCount = indices.length;
  const bottomFaceCount = indices.length;
  const sideFaceCount = allIndices.length / 3 - topFaceCount - bottomFaceCount;

  fullGeometry.addGroup(0, topFaceCount, 0);
  fullGeometry.addGroup(topFaceCount, bottomFaceCount, 1);
  fullGeometry.addGroup(topFaceCount + bottomFaceCount, sideFaceCount, 1);

  // Recentre the geometry on its own bounding box so the mesh rotates about
  // its middle. Built in place, the insole spans z 0..2.8 and y 0..~0.55, so
  // any rotation swings the heel cup out of frame.
  fullGeometry.computeBoundingBox();
  const bb = fullGeometry.boundingBox;
  const centre = new THREE.Vector3();
  bb.getCenter(centre);
  fullGeometry.translate(-centre.x, -centre.y, -centre.z);
  fullGeometry.computeBoundingSphere();

  // Fit by bounding SPHERE, not box: the insole's length is on z and it
  // spins about y, so an axis-aligned fit is wrong for every angle but one.
  const radius = fullGeometry.boundingSphere.radius;

  function fitScaleFor(cam) {
    const vFov = (cam.fov * Math.PI) / 180;
    const visH = 2 * Math.tan(vFov / 2) * cam.position.z;
    const visW = visH * cam.aspect;
    return 0.86 * Math.min(visW, visH) / (2 * radius);
  }

  // Orient so the TOP (foot-facing) surface faces the camera. The insole lies
  // in the XZ plane, so a negative tilt here shows the underside instead.
  insoleMesh.rotation.x = Math.PI / 2 - 0.32;
  insoleMesh.rotation.z = -0.30;
  insoleMesh.rotation.y = 0.15;
  insoleMesh.position.set(0, -0.06, 0);
  insoleMesh.scale.setScalar(fitScaleFor(camera));

  scene.add(insoleMesh);

  // Grounded studio shadow so the insole does not look like it is floating
  const floorGeo = new THREE.PlaneGeometry(6, 6);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.95;
  floor.receiveShadow = true;
  scene.add(floor);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.radius = 4;
  insoleMesh.castShadow = true;

  /* ---------- wireframe overlay ---------- */
  const wireGeo = new THREE.WireframeGeometry(fullGeometry);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x0B3D91,
    transparent: true,
    opacity: 0.10
  });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  wireframe.scale.copy(insoleMesh.scale);
  wireframe.rotation.copy(insoleMesh.rotation);
  wireframe.position.copy(insoleMesh.position);
  scene.add(wireframe);

  /* ---------- particles ---------- */
  const pGeo = new THREE.BufferGeometry();
  const pCount = Q.particles;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 4;
    pPos[i * 3 + 1] = Math.random() * 2;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x00B3B8,
    size: 0.015,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  canvas.parentElement.addEventListener('pointermove', (e) => {
    const rect = canvas.parentElement.getBoundingClientRect();
    target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  /* ---------- resize ---------- */
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

    // Re-fit the insole whenever the panel aspect changes, otherwise it
    // overflows on narrow/wide panels.
    if (insoleMesh) {
      insoleMesh.scale.setScalar(fitScaleFor(camera));
      wireframe.scale.copy(insoleMesh.scale);
    }
  }
  window.addEventListener('resize', resize, { passive: true });

  if ('ResizeObserver' in window) {
    let pending = null;
    const ro = new ResizeObserver(() => {
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(resize);
    });
    ro.observe(canvas);
  }

  /* ---------- visibility gating ---------- */
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

  /* ---------- FPS watchdog ---------- */
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

    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    const t = clock.elapsedTime;

    if (!reducedMotion) {
      // Gentle sway: keep the top face toward the camera and stay readable
      insoleMesh.rotation.y = 0.15 + Math.sin(t * 0.35) * 0.18 + pointer.x * 0.30;
      insoleMesh.rotation.x = Math.PI / 2 - 0.32 + Math.sin(t * 0.20) * 0.035 + pointer.y * 0.08;
      insoleMesh.position.y = -0.06 + Math.sin(t * 0.5) * 0.035;

      wireframe.rotation.copy(insoleMesh.rotation);
      wireframe.position.copy(insoleMesh.position);

      if (particles.visible) {
        particles.rotation.y = -t * 0.03;
        particles.position.y = Math.sin(t * 0.3) * 0.1;
      }
    } else {
      insoleMesh.rotation.set(-Math.PI / 2 + 0.30, 0.55, 0.14);
      wireframe.rotation.copy(insoleMesh.rotation);
    }

    // Camera parallax
    camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.03;
    camera.position.y += (0.35 - pointer.y * 0.20 - camera.position.y) * 0.03;
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
      fullGeometry.dispose();
      topMaterial.dispose();
      bottomMaterial.dispose();
      perfTexture.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
    },
    quality: degraded ? 'degraded' : (lowEnd ? 'low' : 'full'),
    stats() { return { totalFrames, degraded, particles: particles.visible, pixelRatio: renderer.getPixelRatio() }; }
  };
}
