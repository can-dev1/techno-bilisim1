// ── GİRİŞ SAHNESİ: drone videosunun üstünde Kod Yıldızı + yağan kar. Saydam tuval; videoyu örtmez.
// Kullanım: const s = girisSahnesi(tuval, "yuksek"); her karede s.ciz(hp, saniye, t, imlec, dt)
import * as THREE from "./vendor/three-kulup.min.js";
import { RoomEnvironment } from "./vendor/three-kulup.min.js";
import { yildizYap, karYap } from "./yildiz.js";
import { yildizToplan, yildizDagil, yildizDonus } from "./hareket.js";

const KAR = { yuksek: [2200, 900], orta: [1200, 600], dusuk: [350, 350] };   // [masaüstü, mobil]
const DPR = { yuksek: 1.75, orta: 1.25, dusuk: 1 };

export function girisSahnesi(tuval, kademe = "yuksek") {
  const r = new THREE.WebGLRenderer({ canvas: tuval, antialias: kademe !== "dusuk", alpha: true, powerPreference: "high-performance" });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.95;
  r.setClearColor(0x000000, 0);

  const sahne = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  kamera.position.set(0, 0, 6.2);

  const yildiz = yildizYap();
  const grup = new THREE.Group();
  grup.add(yildiz);
  sahne.add(grup);

  const isik = new THREE.DirectionalLight(0xffffff, 1.6);
  isik.position.set(3, 4, 5);
  const ortamIsik = new THREE.AmbientLight(0xffffff, 0);
  sahne.add(isik, ortamIsik);

  const kar = karYap(KAR.yuksek[0]);   // en fazla adetle bir kez kurulur; kademe yalnızca çizim aralığını değiştirir
  sahne.add(kar);

  let ortam = null, mobil = false, egimX = 0, egimY = 0;

  function boyut() {
    const w = tuval.clientWidth || innerWidth, h = tuval.clientHeight || innerHeight;
    mobil = w < 768;
    r.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    grup.position.set(mobil ? 0 : 1.45, mobil ? 0.75 : 0.15, 0);
    grup.scale.setScalar(mobil ? 0.95 : 1.25);
    kar.geometry.setDrawRange(0, KAR[kademe][mobil ? 1 : 0]);
  }

  function kademeAyarla(k) {
    kademe = k;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR[k]));
    kar.u.uPR.value = r.getPixelRatio();                 // kar tanesi CSS pikselinde aynı boyda kalsın
    if (k === "dusuk") {
      sahne.environment = null;
      ortamIsik.intensity = 0.6;
    } else {
      if (!ortam) {
        const pm = new THREE.PMREMGenerator(r);
        ortam = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
      }
      sahne.environment = ortam;
      ortamIsik.intensity = 0;
    }
    boyut();
  }

  // hp: giriş bölümü ilerlemesi 0→1 · saniye: sahne hazır olduktan sonra geçen süre · t: toplam süre
  // imlec: {x,y} -1..1 (yalnızca ince imleçli cihazlarda) ya da null · dt: kare süresi (sn)
  function ciz(hp, saniye, t, imlec, dt) {
    const dagil = yildizDagil(hp);
    yildiz.guncelle(yildizToplan(saniye), dagil, t);
    const k = 1 - Math.exp(-dt * 12);
    egimX += ((imlec ? -imlec.y * 0.12 : 0) - egimX) * k;
    egimY += ((imlec ? imlec.x * 0.12 : 0) - egimY) * k;
    grup.rotation.set(-0.12 + egimX, -0.18 + egimY, yildizDonus(hp) + t * 0.05);
    kar.u.uZaman.value = t;
    r.render(sahne, kamera);
  }

  kademeAyarla(kademe);
  return {
    ciz, boyut, kademeAyarla,
    yokEt() { ortam?.dispose(); r.dispose(); },
  };
}
