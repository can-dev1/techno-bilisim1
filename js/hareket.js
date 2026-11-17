// ── Kaydırmaya bağlı değerler: hepsi bölüm ilerlemesinin (0→1) saf fonksiyonu.
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const ara = (x, a, b) => clamp01((x - a) / (b - a));

// Bir bölümün ilerlemesi: üst kenarı ekranın üstüne geldiğinde 0, alt kenarı ekranın altına geldiğinde 1
export const bolumIlerleme = (el) => {
  const r = el.getBoundingClientRect();
  return clamp01(-r.top / Math.max(1, r.height - innerHeight));
};

// ── GİRİŞ (hp: hero izinin ilerlemesi)
export const yildizToplan = (saniye) => clamp01(saniye / 1.8);                      // açılış: zamana bağlı, 1.8 sn
export const yildizDagil  = (hp) => smooth(ara(hp, 0.12, 0.72));
export const yildizDonus  = (hp) => (-Math.PI / 4) * smooth(ara(hp, 0.0, 0.7));
export const videoOlcek   = (hp) => 1 + 0.08 * smooth(ara(hp, 0.0, 0.8));
export const ortuOpaklik  = (hp) => 0.35 + 0.5 * smooth(ara(hp, 0.3, 0.9));          // video üstündeki koyu örtü
export const baslikStil   = (hp, i, n) => {                                           // harf harf yukarı kalkıp bulanıklaşır
  const e = smooth(clamp01((ara(hp, 0.45, 0.85) - (i / n) * 0.35) / 0.65));
  return { transform: `translate3d(0, ${-e * 30}%, 0)`, filter: `blur(${e * 10}px)`, opacity: 1 - e };
};
export const ipucuOpaklik = (hp) => 1 - smooth(ara(hp, 0.0, 0.08));                   // "aşağı kaydır" oku
export const tuvalOpaklik = (hp) => 1 - smooth(ara(hp, 0.86, 1.0));

// ── KULÜP KAMERASI: 3D kapak akışı. i: kart sırası, a: aktif konum (sürüklerken ondalıklı)
export function kapakStili(i, a, mobil) {
  const d = i - a, ad = Math.abs(d);
  const x = d * (mobil ? 66 : 23);                                  // vw
  const ry = Math.max(-55, Math.min(55, -d * 38));                  // derece
  const z = -Math.min(ad, 3) * (mobil ? 120 : 170);                 // px
  const s = 1 - Math.min(ad, 2) * 0.08;
  return {
    transform: `translate3d(calc(-50% + ${x}vw), -50%, ${z}px) rotateY(${ry}deg) scale(${s})`,
    opacity: ad > 2.6 ? 0 : 1 - Math.max(0, ad - 1.6) * 0.6,
    zIndex: 100 - Math.round(ad * 10),
    filter: `brightness(${1 - Math.min(ad, 1.5) * 0.35})`,
  };
}

// ── FAALİYET ZAMAN ÇİZGİSİ: kartın görünür olma payı (IntersectionObserver oranı) → katlanma
export const kartKatlanma = (oran) => {
  const e = easeOutCubic(clamp01(oran / 0.6));
  return { transform: `perspective(1200px) rotateX(${(1 - e) * 18}deg) translate3d(0, ${(1 - e) * 40}px, 0)`, opacity: e };
};
