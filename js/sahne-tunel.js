// ── TÜNEL SAHNESİ: Anı tüneli için renderer + kamera + sis. Fotoğraf listesini HTML'deki <ol class="tunel-liste">'den alır.
// Kullanım: const s = tunelSahnesi(tuval, fotolar, "yuksek", uyandir); her karede s.ciz(p, t)
// fotolar: [{ src: "media/foto/x-640.webp", w, h, alt }]
import * as THREE from "./vendor/three-kulup.min.js";
import { tunelYap } from "./tunel.js";

const DPR = { yuksek: 1.75, orta: 1.25, dusuk: 1 };

export function tunelSahnesi(tuval, fotolar, kademe = "yuksek", uyandir = () => {}) {
  const r = new THREE.WebGLRenderer({ canvas: tuval, antialias: kademe !== "dusuk", alpha: false, powerPreference: "high-performance" });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;          // fotoğrafların rengi bozulmasın
  r.setClearColor(0x06101d, 1);

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0x06101d);
  sahne.fog = new THREE.Fog(0x06101d, 4, 17);
  const kamera = new THREE.PerspectiveCamera(52, 1, 0.1, 40);

  let mobil = null, grup = null, sonP = 0;
  const v = new THREE.Vector3();

  function kur() {                                // yerleşim mobil/masaüstüne göre değişir
    if (grup) { sahne.remove(grup); grup.yokEt(); }
    grup = tunelYap(fotolar, { mobil, yukle: uyandir });
    sahne.add(grup);
  }

  function boyut() {
    const w = tuval.clientWidth || innerWidth, h = tuval.clientHeight || innerHeight;
    const yeniMobil = w < 768;
    r.setSize(w, h, false);
    kamera.fov = yeniMobil ? 62 : 52;
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    if (yeniMobil !== mobil) { mobil = yeniMobil; kur(); }
  }

  function kademeAyarla(k) {
    kademe = k;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR[k]));
    boyut();
  }

  function ciz(p, t) {
    sonP = p;
    grup.guncelle(p, t, kamera);
    r.render(sahne, kamera);
  }

  // Kameranın hemen önündeki fotoğrafın sırası (sayaç ve "Bu kareyi aç" için)
  function enYakin() {
    const z = grup.kameraZ(sonP);
    let en = 0, enD = Infinity;
    for (const m of grup.kartlar) {
      const d = z - m.position.z;                   // önündeyse artı
      if (d > 0.3 && d < enD) { enD = d; en = m.userData.indeks; }
    }
    return en;
  }

  // Tuvale tıklama: Raycaster yok; kart merkezlerini ekrana izdüşürüp imlecin içinde kalan en yakın kartı bul.
  // x, y: tuval içindeki CSS piksel konumu. Bulamazsa -1.
  function tikla(x, y) {
    const w = tuval.clientWidth, h = tuval.clientHeight;
    const nx = (x / w) * 2 - 1, ny = -(y / h) * 2 + 1;
    let en = -1, enUzak = Infinity;
    for (const m of grup.kartlar) {
      if (m.material.opacity < 0.3) continue;
      v.copy(m.position).applyMatrix4(grup.matrixWorld);
      const uzak = kamera.position.distanceTo(v);
      v.project(kamera);
      if (v.z > 1) continue;                        // kameranın arkasında
      // kartın ekrandaki yarı boyu (NDC): ölçek / (uzaklık · tan(fov/2))
      const t = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
      const yh = (m.scale.y / 2) / (uzak * t), yw = (m.scale.x / 2) / (uzak * t * kamera.aspect);
      if (Math.abs(nx - v.x) <= yw && Math.abs(ny - v.y) <= yh && uzak < enUzak) { enUzak = uzak; en = m.userData.indeks; }
    }
    return en;
  }

  kademeAyarla(kademe);
  return {
    ciz, boyut, kademeAyarla, enYakin, tikla,
    yokEt() { grup?.yokEt(); r.dispose(); },
  };
}
