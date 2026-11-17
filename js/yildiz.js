// ── KOD YILDIZI: kulüp logosundaki 8 kollu yıldızın 3D hâli. Her kol bir "</>" etiketidir:
// dış "<" dışarı bakar, ortada "/" çizgisi, iç ">" merkeze bakar. 8 kol × 5 çubuk = 40 çubuk → TEK InstancedMesh (tek çizim çağrısı).
// Birim: yıldızın dış yarıçapı = 1.
import * as THREE from "./vendor/three-kulup.min.js";

const KALINLIK = 0.062, DERINLIK = 0.10;

// +x yönündeki tek kolun çubukları: [x1, y1, x2, y2]
const KOL = [
  [1.00, 0.00, 0.745, 0.185], [1.00, 0.00, 0.745, -0.185],          // dış "<" (tepe dışarıda)
  [0.565, -0.20, 0.645, 0.20],                                       // "/"
  [0.235, 0.00, 0.47, 0.155], [0.235, 0.00, 0.47, -0.155],          // iç ">" (tepe merkezde)
];

// Basit belirlenimci rastgele (her yüklemede aynı)
const rnd = (i, k) => { const x = Math.sin((i + 1) * (12.9898 + k * 7.13)) * 43758.5453; return x - Math.floor(x); };

export function yildizParcalari() {
  const parcalar = [];
  for (let kol = 0; kol < 8; kol++) {
    const a = (kol * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
    KOL.forEach(([x1, y1, x2, y2], j) => {
      const ax = x1 * c - y1 * s, ay = x1 * s + y1 * c, bx = x2 * c - y2 * s, by = x2 * s + y2 * c;
      const i = parcalar.length;
      // Toplanma başlangıcı: 3.5–6.5 birim uzakta, kar taneleri gibi dağınık
      const u = rnd(i, 1) * Math.PI * 2, v = Math.acos(2 * rnd(i, 2) - 1), r = 3.5 + 3 * rnd(i, 3);
      parcalar.push({
        cx: (ax + bx) / 2, cy: (ay + by) / 2, aci: Math.atan2(by - ay, bx - ax),
        boy: Math.hypot(bx - ax, by - ay) + KALINLIK * (j === 2 ? 0 : 0.9),   // köşelerde üst üste binsin
        kolX: c, kolY: s,                                                       // dağılma yönü
        bas: [r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v) - 1.5],
        donus: [rnd(i, 4) - 0.5, rnd(i, 5) - 0.5, rnd(i, 6) - 0.5],
        gecikme: rnd(i, 7) * 0.45, hiz: 0.6 + 0.8 * rnd(i, 8),
      });
    });
  }
  return parcalar;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function yildizYap() {
  const parcalar = yildizParcalari();
  const malzeme = new THREE.MeshPhysicalMaterial({
    color: 0x1d5cc0, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1,
    emissive: 0x0a2a66, emissiveIntensity: 0.55, envMapIntensity: 0.85,
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, KALINLIK, DERINLIK), malzeme, parcalar.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();

  // toplan: 0→1 (açılış), dagil: 0→1 (kaydırma), t: saniye
  mesh.guncelle = (toplan, dagil, t) => {
    parcalar.forEach((pr, i) => {
      const k = easeOutCubic(clamp01((toplan - pr.gecikme) / (1 - pr.gecikme * 0.9)));
      const kalan = 1 - k;
      const d = dagil * dagil;
      p.set(
        pr.bas[0] * kalan + pr.cx * k + pr.kolX * d * (1.6 + pr.hiz),
        pr.bas[1] * kalan + pr.cy * k + pr.kolY * d * (1.6 + pr.hiz),
        pr.bas[2] * kalan + Math.sin(t * 0.9 + i * 0.35) * 0.015 * k + d * (2.2 + 2.5 * pr.hiz),
      );
      e.set(pr.donus[0] * (kalan * 6 + d * 5), pr.donus[1] * (kalan * 6 + d * 5), pr.aci + pr.donus[2] * (kalan * 4 + d * 3));
      q.setFromEuler(e);
      const olcek = 1 - 0.85 * clamp01((dagil - 0.55) / 0.45);
      sc.set(pr.boy * olcek, olcek, olcek);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

// ── KAR: GPU'da düşen yumuşak kar taneleri (kademeye göre sayı)
const KAR_VS = `
uniform float uZaman; uniform float uBoyut; uniform float uPR; uniform float uRuzgar;
attribute float aFaz;
varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y - uZaman * (0.25 + 0.35 * aFaz) + 5.0, 10.0) - 5.0;
  p.x += sin(uZaman * 0.6 + aFaz * 6.2831) * 0.18 + uRuzgar * (p.y + 5.0) * 0.04;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uBoyut * uPR * (0.55 + 0.9 * aFaz) / max(0.2, -mv.z);
  vA = 0.35 + 0.55 * aFaz;
}`;
const KAR_FS = `
precision mediump float;
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = (1.0 - smoothstep(0.15, 0.5, r)) * vA;
  gl_FragColor = vec4(vec3(1.0), a);
}`;

export function karYap(adet) {
  const konum = new Float32Array(adet * 3), faz = new Float32Array(adet);
  for (let i = 0; i < adet; i++) {
    konum.set([(rnd(i, 11) - 0.5) * 14, (rnd(i, 12) - 0.5) * 10, -5 + rnd(i, 13) * 7.5], i * 3);
    faz[i] = rnd(i, 14);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(konum, 3));
  g.setAttribute("aFaz", new THREE.BufferAttribute(faz, 1));
  const u = { uZaman: { value: 0 }, uBoyut: { value: 34 }, uPR: { value: 1 }, uRuzgar: { value: 0 } };
  const noktalar = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: KAR_VS, fragmentShader: KAR_FS, uniforms: u, transparent: true, depthWrite: false }));
  noktalar.frustumCulled = false;
  noktalar.u = u;
  return noktalar;
}
