// ── MOTOR: sayfadaki TEK requestAnimationFrame döngüsü + kademe (cihaz gücü).
// Her bölüm kendini kaydeder: { ad, aktifMi(), oku(), yaz(dt, t) }. Önce bütün okumalar, sonra bütün yazmalar.
const isler = new Set();
let son = performance.now(), t = 0, calisiyor = false, kirli = true, durdu = false;

export function kaydet(is) { isler.add(is); uyandir(); return () => isler.delete(is); }
export function uyandir() {
  if (!calisiyor && !document.hidden) { calisiyor = true; son = performance.now(); requestAnimationFrame(kare); }
}
// Son kareden beri kaydırma / yeniden boyutlanma oldu mu? (kaydırmaya bağlı işler yalnızca o zaman çalışır)
export const kaydirildi = () => kirli;
// Görüntüleyici açıkken WebGL sahneleri durur
export function durdur(d) { durdu = d; uyandir(); }
export const durduMu = () => durdu;

function kare(simdi) {
  const dt = Math.min(0.05, (simdi - son) / 1000); son = simdi; t += dt;
  olc(simdi);
  const aktif = [];
  for (const i of isler) if (i.aktifMi()) aktif.push(i);
  kirli = false;
  for (const i of aktif) i.oku?.();
  for (const i of aktif) i.yaz(dt, t);
  if (aktif.length && !document.hidden) requestAnimationFrame(kare); else calisiyor = false;
}
const kirlet = () => { kirli = true; uyandir(); };
addEventListener("scroll", kirlet, { passive: true });
addEventListener("resize", kirlet, { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden) kirlet(); });

// Yaylı yumuşatma (kare hızından bağımsız)
export const yay = (mevcut, hedef, dt, k = 12) => mevcut + (hedef - mevcut) * (1 - Math.exp(-dt * k));

// ── KADEME
const SIRA = ["yuksek", "orta", "dusuk"];
const azalt = matchMedia("(prefers-reduced-motion: reduce)");
const azVeri = matchMedia("(prefers-reduced-data: reduce)");
export const azHareket = () => azalt.matches;

// Donanım hızlandırmalı WebGL var mı? Yazılımla çizim (SwiftShader, llvmpipe; GPU'su kara listede cihazlar)
// "büyük performans kaybı" sayılır: 3D'yi CPU'da çizmek sayfayı kilitler, o yüzden 3D'siz yol seçilir.
function webglVar() {
  try {
    const c = document.createElement("canvas"), o = { failIfMajorPerformanceCaveat: true };
    const gl = c.getContext("webgl2", o) || c.getContext("webgl", o);
    if (!gl) return false;
    const bilgi = gl.getExtension("WEBGL_debug_renderer_info");
    const cizici = String(gl.getParameter(bilgi ? bilgi.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i.test(cizici);
  } catch { return false; }
}
export function baslangicKademesi() {
  const n = navigator;
  // Deneme için: localStorage.kademe = "yuksek" | "orta" | "dusuk" | "yok" (README'de)
  let zorla = null; try { zorla = localStorage.getItem("kademe"); } catch {}
  if (["yuksek", "orta", "dusuk", "yok"].includes(zorla)) return zorla;
  if (azalt.matches || azVeri.matches || n.connection?.saveData || !webglVar()) return "yok";
  if ((n.deviceMemory && n.deviceMemory <= 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4)) return "orta";
  return "yuksek";
}

let kademe = baslangicKademesi();
const dinleyiciler = new Set();
document.documentElement.dataset.kademe = kademe;
export const mevcutKademe = () => kademe;
export function kademeDinle(f) { dinleyiciler.add(f); }
function kademeIndir(hedef) {
  if (kademe === "yok" || SIRA.indexOf(hedef) <= SIRA.indexOf(kademe)) return;   // yalnızca aşağı
  kademe = hedef;
  document.documentElement.dataset.kademe = kademe;
  for (const f of dinleyiciler) f(kademe);
}

// Ölçüm: giriş sahnesinin ilk 40 karesi (ilk 5 atlanır), sonra 3 sn'lik kayan ortalama.
// Ekranın yenileme hızına yetişen kare "yüksek" sayılır (60 Hz ekranda rAF aralığı hiçbir zaman 14 ms'nin altına inmez).
let cizildi = false, sayac = 0, toplam = 0, enKisa = Infinity, oncekiKare = 0;
const pencere = [];
// Bir 3D sahne bu karede çizdiyse çağrılır; ölçüm yalnızca art arda çizilen karelerde yapılır
export const sahneCizdi = () => { cizildi = true; };
function olc(simdi) {
  const ciz = cizildi; cizildi = false;
  if (!ciz || durdu) { oncekiKare = 0; return; }
  const ms = oncekiKare ? simdi - oncekiKare : 0; oncekiKare = simdi;
  if (!ms || ms > 250) return;                       // ilk kare ya da sekme arası
  sayac++;
  if (sayac <= 5) return;
  enKisa = Math.min(enKisa, ms);
  if (sayac <= 45) {
    toplam += ms;
    if (sayac === 45) {
      const ort = toplam / 40, yetisiyor = ort <= enKisa * 1.15;
      kademeIndir(ort <= 14 || yetisiyor ? "yuksek" : ort <= 22 ? "orta" : "dusuk");
    }
    return;
  }
  pencere.push([simdi, ms]);
  while (pencere.length && simdi - pencere[0][0] > 3000) pencere.shift();
  if (pencere.length > 30 && simdi - pencere[0][0] > 2500) {
    const ort = pencere.reduce((a, [, m]) => a + m, 0) / pencere.length;
    if (ort > 26) { kademeIndir(SIRA[Math.min(2, SIRA.indexOf(kademe) + 1)]); pencere.length = 0; }
  }
}

// Görünürlük yardımcısı
export function gozle(el, f, rootMargin = "25% 0px", threshold = 0) {
  const io = new IntersectionObserver((g) => { for (const x of g) f(x.isIntersecting, x); }, { rootMargin, threshold });
  io.observe(el);
  return io;
}
