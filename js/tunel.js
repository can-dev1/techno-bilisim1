// ── ANI TÜNELİ: kulüp fotoğrafları karlı bir tünelde süzülür; kaydırma kamerayı içinden geçirir.
// Fotoğraflar yalnızca bölüme yaklaşılınca yüklenir; her biri 640 px webp (≈ 50–110 KB).
import * as THREE from "./vendor/three-kulup.min.js";

const ARALIK = 2.4;                       // fotoğraflar arası derinlik
const rnd = (i, k) => { const x = Math.sin((i + 1) * (12.9898 + k * 7.13)) * 43758.5453; return x - Math.floor(x); };

// Belirlenimci yerleşim: altın açı sarmalı, merkez boş kalır (kamera yolu)
export function tunelYerlesimi(adet, mobil) {
  const R = mobil ? 1.15 : 2.3;
  return Array.from({ length: adet }, (_, i) => {
    const a = i * 2.39996 + 0.6;
    const r = R * (0.85 + 0.3 * rnd(i, 1));
    return {
      x: Math.cos(a) * r, y: Math.sin(a) * r * (mobil ? 1.15 : 0.62), z: -i * ARALIK - 3,
      ry: -Math.cos(a) * 0.35, rx: Math.sin(a) * 0.18, rz: (rnd(i, 2) - 0.5) * 0.12,
    };
  });
}

export function tunelYap(fotolar, { mobil, yukle }) {
  const grup = new THREE.Group();
  const yer = tunelYerlesimi(fotolar.length, mobil);
  const yukleyici = new THREE.TextureLoader();
  const geo = new THREE.PlaneGeometry(1, 1);
  const kartlar = fotolar.map((f, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b1a2c, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: true });
    const m = new THREE.Mesh(geo, mat);
    const h = mobil ? 1.5 : 1.9, w = h * (f.w / f.h);
    m.scale.set(w, h, 1);
    const p = yer[i];
    m.position.set(p.x, p.y, p.z); m.rotation.set(p.rx, p.ry, p.rz);
    m.userData = { indeks: i, yuklendi: false, src: f.src, hedefOpaklik: 1 };
    grup.add(m);
    return m;
  });
  const uzunluk = fotolar.length * ARALIK + 4;

  // Kamera yakınındaki fotoğrafların dokusunu yükle (önde 6, arkada 2); çok geride kalanları bellekten at
  grup.dokulariGuncelle = (kameraZ) => {
    for (const m of kartlar) {
      const d = m.position.z - kameraZ, u = m.userData;
      if (!u.yuklendi && d < 2 && d > -ARALIK * 6) {
        u.yuklendi = true;
        const bilet = (u.bilet = (u.bilet || 0) + 1);
        yukleyici.load(u.src, (t) => {
          if (bilet !== u.bilet) { t.dispose(); return; }          // bu arada boşaltıldıysa at
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
          m.material.map = t; m.material.color.set(0xffffff); m.material.needsUpdate = true;
          yukle?.();
        });
      } else if (u.yuklendi && (d > ARALIK * 3 || d < -ARALIK * 10)) {
        u.yuklendi = false; u.bilet++;
        if (m.material.map) { m.material.map.dispose(); m.material.map = null; m.material.color.set(0x0b1a2c); m.material.needsUpdate = true; }
      }
    }
  };
  grup.yokEt = () => { for (const m of kartlar) { m.material.map?.dispose(); m.material.dispose(); } geo.dispose(); };
  // p: 0→1 (bölüm içi kaydırma). Kamera tünelin başından sonuna uçar.
  grup.kameraZ = (p) => 2 - p * (uzunluk - 2);
  grup.guncelle = (p, t, kamera) => {
    const z = grup.kameraZ(p);
    kamera.position.set(Math.sin(p * 6.0) * 0.25, Math.cos(p * 4.0) * 0.15, z);
    kamera.lookAt(Math.sin(p * 6.0 + 0.6) * 0.15, 0, z - 6);
    for (const m of kartlar) {
      const d = m.position.z - z;                                  // kameranın önündeyse eksi
      const gorunur = d < 0.6 && d > -ARALIK * 9 ? 1 : 0;
      const yakin = THREE.MathUtils.smoothstep(d, -0.4, 0.6);      // kameraya çok yaklaşınca söner
      m.material.opacity += ((gorunur * (1 - yakin)) - m.material.opacity) * 0.15;
      m.position.y = yer[m.userData.indeks].y + Math.sin(t * 0.6 + m.userData.indeks) * 0.04;
    }
    grup.dokulariGuncelle(z);
  };
  grup.kartlar = kartlar;
  return grup;
}
