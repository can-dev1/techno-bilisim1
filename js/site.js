// ── SİTE: giriş noktası. Menü, giriş eğrileri, videolar, kapak akışı, zaman çizgisi, sayılar, görüntüleyici.
// Three.js'e ihtiyaç duyan iki sahne (sahne-giris.js, sahne-tunel.js) sonradan, dinamik import() ile gelir.
import { kaydet, uyandir, kaydirildi, durdur, durduMu, yay, azHareket, mevcutKademe, kademeDinle, gozle, sahneCizdi } from "./motor.js";
import { bolumIlerleme, videoOlcek, ortuOpaklik, baslikStil, ipucuOpaklik, tuvalOpaklik, kapakStili, kartKatlanma, clamp01, easeOutCubic } from "./hareket.js";
import { goruntuleyiciKur, ac as goruntuleyiciAc, grupOgeleri } from "./goruntuleyici.js";

const kok = document.documentElement;
kok.classList.add("js");
const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const ince = matchMedia("(hover: hover) and (pointer: fine)");
const genis = matchMedia("(min-width: 1024px)");
const mobilMq = matchMedia("(max-width: 767.98px)");
const baglanti = navigator.connection;
const veriAz = () => !!baglanti?.saveData || matchMedia("(prefers-reduced-data: reduce)").matches;
const otomatik = () => !azHareket() && !veriAz();
const bosta = (f) => ("requestIdleCallback" in window ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 200));
const oyna = (v) => v.play().catch(() => {});

// Tema tercihi: depolama kapalı olsa da anahtar çalışır.
const temaDugme = $(".tema-dugme");
function temaUygula(acik) {
  kok.dataset.tema = acik ? "acik" : "koyu";
  temaDugme.setAttribute("aria-checked", String(acik));
  $("meta[name='theme-color']").content = acik ? "#F3F6FA" : "#06101D";
}
let kayitliTema = null;
try { kayitliTema = localStorage.getItem("tema"); } catch {}
temaUygula(kayitliTema === "acik");
temaDugme.hidden = false;
temaDugme.addEventListener("click", () => {
  temaUygula(kok.dataset.tema !== "acik");
  try { localStorage.setItem("tema", kok.dataset.tema); } catch {}
});

let boyutTimer = 0;
const boyutDinleyiciler = [];
addEventListener("resize", () => { clearTimeout(boyutTimer); boyutTimer = setTimeout(() => boyutDinleyiciler.forEach((f) => f()), 150); }, { passive: true });

// ═════════ ÜST ÇUBUK
const ust = $("#ust");
{
  const nobet = document.createElement("div");
  nobet.className = "nobet";
  nobet.setAttribute("aria-hidden", "true");
  document.body.prepend(nobet);
  new IntersectionObserver(([x]) => ust.classList.toggle("cam", !x.isIntersecting)).observe(nobet);

  // Aktif bölüm → menüde kayan çizgi
  const linkler = $$(".menu a");
  const cizgi = $(".menu-cizgi");
  const harita = { kulup: "kulup", filmler: "arsiv", arsiv: "arsiv", anilar: "arsiv", "eski-arsiv": "arsiv", iletisim: "iletisim" };
  let aktif = null, x = 0, w = 0, hx = 0, hw = 0, olc = true, ilk = true;
  const io = new IntersectionObserver((g) => {
    for (const e of g) if (e.isIntersecting) {
      const hedef = harita[e.target.id];
      aktif = linkler.find((l) => l.dataset.bolum === hedef) || null;
      linkler.forEach((l) => (l === aktif ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
      cizgi.classList.toggle("acik", !!aktif);
      olc = true; uyandir();
    }
  }, { rootMargin: "-40% 0px -59% 0px" });
  ["giris", "kulup", "filmler", "arsiv", "anilar", "eski-arsiv", "iletisim"].forEach((id) => io.observe(document.getElementById(id)));
  boyutDinleyiciler.push(() => { olc = true; uyandir(); });
  kaydet({
    ad: "menu",
    aktifMi: () => olc || Math.abs(x - hx) > 0.3 || Math.abs(w - hw) > 0.3,
    oku: () => { if (olc && aktif) { hx = aktif.offsetLeft; hw = aktif.offsetWidth; } },
    yaz: (dt) => {
      if (olc && ilk && aktif) { x = hx; w = hw; ilk = false; }
      olc = false;
      x = yay(x, hx, dt); w = yay(w, hw, dt);
      cizgi.style.transform = `translateX(${x}px) scaleX(${w / 100})`;
    },
  });

  // Mobil menü: <dialog> (odak tuzağı ve Esc tarayıcıdan)
  const menu = $("#mobil-menu"), ac = $(".menu-ac");
  ac.addEventListener("click", () => {
    menu.showModal(); ac.setAttribute("aria-expanded", "true"); document.body.classList.add("kilit");
  });
  $(".menu-kapat", menu).addEventListener("click", () => menu.close());
  menu.addEventListener("click", (e) => {
    const l = e.target.closest("a");
    if (!l) return;
    const id = l.getAttribute("href");
    menu.close();
    if (!id.startsWith("#")) return;                 // dış bağlantı (üyelik formu) normal açılır
    e.preventDefault();
    const hedef = document.getElementById(id.slice(1));
    requestAnimationFrame(() => { if (hedef) hedefeKaydir(hedef, id); });
  });
  menu.addEventListener("close", () => { ac.setAttribute("aria-expanded", "false"); document.body.classList.remove("kilit"); });
  genis.addEventListener("change", () => { if (genis.matches && menu.open) menu.close(); });
}

// ═════════ GİRİŞ
const giris = $("#giris");
const poster = $(".giris-poster"), gVideo = $(".giris-video"), ortu = $(".giris-ortu");
const satirlar = $$(".satir", giris), gAlt = $(".giris-alt"), gDugme = $(".giris-dugme"), ipucu = $(".giris-ipucu");
const uc = $(".giris-3d"), gTuval = $(".giris-tuval"), gOynat = $(".giris-oynat");
let girisGorunur = true, hp = 0, sonHp = -1, gSahne = null, hazirZamani = 0, imlec = null, gKullanici = false;

function girisVideoKaynak() {
  if (gVideo.src) return;
  const buyuk = genis.matches && !veriAz() && !/2g|3g/.test(baglanti?.effectiveType ?? "");
  gVideo.src = buyuk ? gVideo.dataset.genis : gVideo.dataset.dar;
}
function girisVideoGuncelle() {
  if (girisGorunur && !document.hidden && !gKullanici && gVideo.src) oyna(gVideo);
  else gVideo.pause();
}
gVideo.addEventListener("playing", () => { gVideo.classList.add("hazir"); gOynat.setAttribute("aria-pressed", "true"); gOynat.setAttribute("aria-label", "Giriş videosunu duraklat"); });
gVideo.addEventListener("pause", () => { gOynat.setAttribute("aria-pressed", "false"); gOynat.setAttribute("aria-label", "Giriş videosunu oynat"); });
gOynat.addEventListener("click", () => {
  if (gVideo.paused) { gKullanici = false; girisVideoKaynak(); oyna(gVideo); }
  else { gKullanici = true; gVideo.pause(); }
});
gozle(giris, (v) => { girisGorunur = v; girisVideoGuncelle(); uyandir(); }, "0px");

if (ince.matches) addEventListener("pointermove", (e) => {
  imlec = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
}, { passive: true });

kaydet({
  ad: "giris",
  aktifMi: () => girisGorunur && (kaydirildi() || sonHp < 0 || (gSahne && hp < 1 && !durduMu())),
  oku: () => { hp = bolumIlerleme(giris); },
  yaz: (dt, t) => {
    if (hp !== sonHp) {
      sonHp = hp;
      const s = `scale(${videoOlcek(hp)})`;
      poster.style.transform = s; gVideo.style.transform = s;
      ortu.style.opacity = ortuOpaklik(hp);
      satirlar.forEach((el, i) => Object.assign(el.style, baslikStil(hp, i, 2)));
      Object.assign(gAlt.style, baslikStil(hp, 2, 4));
      const d = baslikStil(hp, 3, 4);
      Object.assign(gDugme.style, d);
      gDugme.style.visibility = d.opacity < 0.02 ? "hidden" : "";
      const io = ipucuOpaklik(hp);
      ipucu.style.opacity = io; ipucu.style.visibility = io < 0.02 ? "hidden" : "";
    }
    if (gSahne) {
      const op = tuvalOpaklik(hp) * clamp01((performance.now() - hazirZamani) / 300);
      gTuval.style.opacity = op;
      if (hp < 1 && !durduMu()) {
        gSahne.ciz(hp, (performance.now() - hazirZamani) / 1000, t, ince.matches ? imlec : null, dt);
        sahneCizdi();
      }
    }
  },
});

async function girisSahnesiYukle() {
  if (mevcutKademe() === "yok") return;
  try {
    const { girisSahnesi } = await import("./sahne-giris.js");
    if (mevcutKademe() === "yok") return;
    gSahne = girisSahnesi(gTuval, mevcutKademe());
    hazirZamani = performance.now();
    uc.classList.add("hazir");
    kademeDinle((k) => gSahne?.kademeAyarla(k));
    boyutDinleyiciler.push(() => gSahne?.boyut());
    gTuval.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      try { gSahne?.yokEt(); } catch {}
      gSahne = null; uc.classList.remove("hazir"); gTuval.style.opacity = 0;
    }, { once: true });
    uyandir();
  } catch { /* yedek logo kalır */ }
}

// İlk boyamadan sonra, boşta: giriş videosu + Kod Yıldızı
function ilkBoyamadanSonra() {
  bosta(() => {
    gOynat.hidden = false;
    if (otomatik()) { girisVideoKaynak(); girisVideoGuncelle(); }
    girisSahnesiYukle();
  });
}
if (document.readyState === "complete") ilkBoyamadanSonra(); else addEventListener("load", ilkBoyamadanSonra, { once: true });

// ═════════ BELİRME (paragraflar, etkinlik arşivi kartları) · bir kez
{
  const belirler = $$(".belir");
  if (azHareket()) belirler.forEach((p) => p.classList.add("gorundu"));
  else {
    const io = new IntersectionObserver((g) => {
      for (const e of g) if (e.isIntersecting) { e.target.classList.add("gorundu"); io.unobserve(e.target); }
    }, { threshold: 0.15 });
    belirler.forEach((p) => io.observe(p));
  }
  const kartlar = $$(".ea-kart");
  if (azHareket()) kartlar.forEach((k) => k.classList.add("gorundu"));
  else {
    const io = new IntersectionObserver((g) => {
      let n = 0;
      for (const e of g) if (e.isIntersecting) {
        e.target.style.animationDelay = `${n++ * 60}ms`;
        e.target.classList.add("gorundu"); io.unobserve(e.target);
      }
    }, { threshold: 0.1 });
    kartlar.forEach((k) => io.observe(k));
  }
}

// ═════════ 3D EĞİM (alan kartları ≤ 8°, arşiv kartları ≤ 6°) · yalnızca ince imleçte
{
  const egik = new Map();
  let hareketli = false;
  const kur = (el, max) => {
    const d = { el, max, x: 0, y: 0, hx: 0, hy: 0, mx: 50, my: 0 };
    egik.set(el, d);
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      d.hy = (u - 0.5) * 2 * max; d.hx = -(v - 0.5) * 2 * max; d.mx = u * 100; d.my = v * 100;
      hareketli = true; uyandir();
    });
    el.addEventListener("pointerleave", () => { d.hx = 0; d.hy = 0; hareketli = true; uyandir(); });
  };
  if (ince.matches && !azHareket()) {
    $$(".alan.egik").forEach((el) => kur(el, 8));
    if (genis.matches) $$(".ea-kart.egik").forEach((el) => kur(el, 6));
    kaydet({
      ad: "egim",
      aktifMi: () => hareketli,
      yaz: (dt) => {
        hareketli = false;
        for (const d of egik.values()) {
          if (Math.abs(d.x - d.hx) < 0.01 && Math.abs(d.y - d.hy) < 0.01 && !d.hx && !d.hy) {
            if (d.x || d.y) { d.x = d.y = 0; d.el.style.transform = ""; d.el.style.willChange = ""; }
            continue;
          }
          d.x = yay(d.x, d.hx, dt); d.y = yay(d.y, d.hy, dt);
          d.el.style.transform = `perspective(900px) rotateX(${d.x.toFixed(2)}deg) rotateY(${d.y.toFixed(2)}deg)`;
          d.el.style.willChange = "transform";
          d.el.style.setProperty("--mx", d.mx + "%"); d.el.style.setProperty("--my", d.my + "%");
          hareketli = true;
        }
      },
    });
  }
}

// ═════════ SAYI ŞERİDİ (0'dan 1.2 sn'de)
{
  const sayilar = $$(".sayilar strong");
  if (!azHareket()) {
    sayilar.forEach((s) => { s.textContent = "0"; });
    let bas = 0, bitti = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !bas) { bas = performance.now(); io.disconnect(); uyandir(); }
    }, { threshold: 0.5 });
    io.observe($(".sayilar"));
    kaydet({
      ad: "sayilar",
      aktifMi: () => bas && !bitti,
      yaz: () => {
        const p = clamp01((performance.now() - bas) / 1200), e = easeOutCubic(p);
        sayilar.forEach((s) => { s.textContent = String(Math.round(+s.dataset.sayi * e)); });
        if (p >= 1) bitti = true;
      },
    });
  }
}

// ═════════ KULÜP KAMERASI · 3D kapak akışı
const akis = $("#kulup-videolari");
const kapaklar = $$(".kapak", akis);
const N = kapaklar.length;
const videolar = kapaklar.map((k) => $("video", k));
const isilti = $(".akis-isilti");
const bilgi = $(".akis-bilgi"), noktalar = $$(".akis-noktalar button"), akisDugme = $(".akis-dugme");
let a = 0, hedef = 0, surukle = null, suruklendi = false, akisAcik = !azHareket(), oynatIstegi = otomatik();
let kamYakin = false, kamGorunur = false, secili = -1, oynayan = -1, sonA = NaN, sonGenislik = innerWidth, isiltiKuruldu = false;
const gizliKapak = new Array(N).fill(false);

function akisDugmesi() {
  akisDugme.setAttribute("aria-pressed", String(akisAcik));
  akisDugme.textContent = akisAcik ? "Akışı durdur" : "Akışı başlat";
}
akisDugmesi();
akisDugme.addEventListener("click", () => { akisAcik = !akisAcik; akisDugmesi(); });
const akisiDurdur = () => { if (akisAcik) { akisAcik = false; akisDugmesi(); } };

function kapaklariYaz() {
  const mobil = mobilMq.matches;
  for (let i = 0; i < N; i++) {
    const ad = Math.abs(i - a), gizli = ad > 2.6;
    if (gizli && gizliKapak[i]) continue;              // görünmeyen kapak hesaplanmaz
    const k = kapaklar[i].style, st = kapakStili(i, a, mobil);
    k.transform = st.transform; k.opacity = st.opacity; k.zIndex = st.zIndex; k.filter = st.filter;
    k.visibility = gizli ? "hidden" : "";
    gizliKapak[i] = gizli;
  }
}

function sec(i) {
  i = Math.max(0, Math.min(N - 1, i));
  if (i === secili) return;
  secili = i;
  kapaklar.forEach((k, j) => k.classList.toggle("etkin", j === i));
  noktalar.forEach((n, j) => (j === i ? n.setAttribute("aria-current", "true") : n.removeAttribute("aria-current")));
  const h = $(".kapak-metin h3", kapaklar[i]).textContent, p = $(".kapak-metin p", kapaklar[i])?.textContent ?? "";
  $("h3", bilgi).textContent = h; $("p", bilgi).textContent = p;
  if (isiltiKuruldu) isiltiGuncelle();
}
function isiltiGuncelle() {
  const src = $(".kapak-poster", kapaklar[secili]).getAttribute("src");
  if (isilti.getAttribute("src") === src) return;
  isilti.classList.add("degisiyor");
  isilti.onload = () => isilti.classList.remove("degisiyor");
  isilti.src = src;
}
function hedefeGit(i, kullanici = true) {
  hedef = Math.max(0, Math.min(N - 1, i));
  if (kullanici) akisiDurdur();
  sec(hedef); uyandir();
}

function sesSifirla(j) {
  const v = videolar[j]; v.muted = true;
  const s = $(".ses", kapaklar[j]);
  if (s) { s.setAttribute("aria-pressed", "false"); s.setAttribute("aria-label", "Sesi aç"); }
}
function birak(j) {
  const v = videolar[j];
  v.pause();
  if (v.src) { try { v.currentTime = 0; } catch {} }
  sesSifirla(j);
  kapaklar[j].classList.remove("oynuyor", "duraklatildi");
  $(".kapak-ilerleme i", kapaklar[j]).style.transform = "scaleX(0)";
}
function kamOynatma() {
  videolar.forEach((v, j) => { if (j !== oynayan && !v.paused) birak(j); });
  if (oynayan < 0) return;
  const v = videolar[oynayan];
  if (kamGorunur && !document.hidden && oynatIstegi && !durduMu()) {
    if (!v.src) v.src = v.dataset.src;
    if (v.paused) oyna(v);
  } else if (!v.paused) v.pause();
}
videolar.forEach((v, j) => {
  const k = kapaklar[j];
  v.addEventListener("playing", () => { k.classList.add("oynuyor"); k.classList.remove("duraklatildi"); uyandir(); });
  v.addEventListener("pause", () => { k.classList.remove("oynuyor"); if (j === oynayan && v.currentTime > 0) k.classList.add("duraklatildi"); });
  v.addEventListener("ended", () => {
    if (j !== oynayan) return;
    if (akisAcik) hedefeGit((j + 1) % N, false);
    else { k.classList.remove("duraklatildi"); try { v.currentTime = 0; } catch {} }
  });
  const ses = $(".ses", k);
  ses?.addEventListener("click", (e) => {
    e.stopPropagation();
    v.muted = !v.muted;
    ses.setAttribute("aria-pressed", String(!v.muted));
    ses.setAttribute("aria-label", v.muted ? "Sesi aç" : "Sesi kapat");
    if (v.paused) { oynatIstegi = true; kamOynatma(); }
  });
  $(".oynat", k).addEventListener("click", (e) => {
    e.stopPropagation();
    if (j !== secili) { hedefeGit(j); return; }
    oynatIstegi = true; kamOynatma();
  });
});
function oynatDurdur() {
  if (oynayan < 0) return;
  const v = videolar[oynayan];
  if (v.paused) { oynatIstegi = true; kamOynatma(); } else { oynatIstegi = false; v.pause(); }
}

// Sürükleme (fare + dokunmatik). Dikey kaydırma bozulmasın: önce 8 px yatay hareket gerekir.
const adim = () => innerWidth * (mobilMq.matches ? 0.66 : 0.23);
akis.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || e.target.closest("button")) return;
  surukle = { x: e.clientX, y: e.clientY, a0: a, id: e.pointerId, basladi: false, iz: [[performance.now(), e.clientX]] };
});
akis.addEventListener("pointermove", (e) => {
  const s = surukle;
  if (!s || e.pointerId !== s.id) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (!s.basladi) {
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { surukle = null; return; }
    if (Math.abs(dx) < 8) return;
    s.basladi = true; akis.setPointerCapture(e.pointerId); akis.classList.add("suruklen"); akisiDurdur();
  }
  a = Math.max(-0.4, Math.min(N - 0.6, s.a0 - dx / adim()));
  const now = performance.now();
  s.iz.push([now, e.clientX]);
  while (s.iz.length > 2 && now - s.iz[0][0] > 80) s.iz.shift();
  uyandir();
});
function surukleBitir(e) {
  const s = surukle;
  if (!s || e.pointerId !== s.id) return;
  surukle = null;
  if (!s.basladi) return;
  akis.classList.remove("suruklen");
  suruklendi = true;
  const [t0, x0] = s.iz[0], hiz = (e.clientX - x0) / Math.max(1, performance.now() - t0);   // px/ms
  let h = Math.round(a);
  if (hiz < -0.3) h = Math.floor(a) + 1; else if (hiz > 0.3) h = Math.ceil(a) - 1;
  hedefeGit(h);
}
akis.addEventListener("pointerup", surukleBitir);
akis.addEventListener("pointercancel", surukleBitir);
akis.addEventListener("click", (e) => {
  if (suruklendi) { suruklendi = false; e.preventDefault(); e.stopPropagation(); return; }
  const k = e.target.closest(".kapak");
  if (!k || e.target.closest("button")) return;
  const i = +k.dataset.i;
  if (i === secili) oynatDurdur(); else hedefeGit(i);
}, true);
// Yatay tekerlek / dokunmatik yüzey
let teker = 0, tekerSon = 0;
akis.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  teker += e.deltaX;
  const now = performance.now();
  if (Math.abs(teker) > 50 && now - tekerSon > 350) { hedefeGit(hedef + Math.sign(teker)); teker = 0; tekerSon = now; }
}, { passive: false });
akis.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); hedefeGit(hedef + 1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); hedefeGit(hedef - 1); }
  else if ((e.key === "Enter" || e.key === " ") && e.target === akis) { e.preventDefault(); oynatDurdur(); }
});
noktalar.forEach((n, i) => n.addEventListener("click", () => hedefeGit(i)));

gozle($("#filmler"), (v) => {
  kamYakin = v;
  if (v && !isiltiKuruldu) { isiltiKuruldu = true; isilti.hidden = false; isiltiGuncelle(); }
  uyandir();
});
gozle($(".akis-sahne"), (v) => { kamGorunur = v; kamOynatma(); }, "0px", 0.35);
mobilMq.addEventListener("change", () => { gizliKapak.fill(false); sonA = NaN; uyandir(); });

kaydet({
  ad: "kamera",
  aktifMi: () => kamYakin && (surukle?.basladi || Math.abs(a - hedef) > 0.0005 || a !== sonA || (oynayan >= 0 && !videolar[oynayan].paused) || innerWidth !== sonGenislik),
  yaz: (dt) => {
    if (!surukle?.basladi) { a = yay(a, hedef, dt); if (Math.abs(a - hedef) < 0.0005) a = hedef; }
    if (a !== sonA || innerWidth !== sonGenislik) {
      if (innerWidth !== sonGenislik) { sonGenislik = innerWidth; gizliKapak.fill(false); }
      sonA = a; kapaklariYaz();
      const r = Math.round(a), yeni = Math.abs(a - r) < 0.15 ? r : -1;
      if (yeni !== oynayan) {
        if (oynayan >= 0) birak(oynayan);
        oynayan = yeni;
        if (yeni >= 0 && surukle?.basladi) sec(yeni);
        kamOynatma();
      }
    }
    if (oynayan >= 0) {
      const v = videolar[oynayan];
      if (v.duration) $(".kapak-ilerleme i", kapaklar[oynayan]).style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(4)})`;
    }
  },
});

// content-visibility:auto olan etkinlik arşivinin ötesindeki hedefler (iletişim): kaydırma bitince konumu düzelt
const eskiArsiv = $("#eski-arsiv");
function hedefeKaydir(el, id) {
  el.scrollIntoView({ behavior: azHareket() ? "auto" : "smooth" });
  history.replaceState(null, "", id);
  if (!(eskiArsiv.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
  let bitti = false;
  const duzelt = () => { if (bitti) return; bitti = true; removeEventListener("scrollend", duzelt); el.scrollIntoView({ behavior: "auto" }); };
  addEventListener("scrollend", duzelt, { once: true });
  setTimeout(duzelt, 1600);
}
document.addEventListener("click", (e) => {
  const l = e.target.closest?.('a[href^="#"]');
  if (!l || e.defaultPrevented || l.closest("#mobil-menu")) return;
  const id = l.getAttribute("href"), el = id.length > 1 && document.getElementById(id.slice(1));
  if (el && eskiArsiv.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) { e.preventDefault(); hedefeKaydir(el, id); }
});

// Sayfa içi "Videoyu izle ↓" bağlantıları ve adres çubuğundaki #video-adi
function videoyaGit(id, kaydir = true) {
  const k = document.getElementById(id);
  if (!k || !k.classList.contains("kapak")) return false;
  if (kaydir) $("#filmler").scrollIntoView({ behavior: azHareket() ? "auto" : "smooth" });
  hedefeGit(+k.dataset.i);
  return true;
}
document.addEventListener("click", (e) => {
  const l = e.target.closest?.('a[href^="#"]');
  if (l && videoyaGit(l.getAttribute("href").slice(1))) e.preventDefault();
});
sec(0);
if (location.hash && document.getElementById(location.hash.slice(1))?.classList.contains("kapak")) {
  const i = +document.getElementById(location.hash.slice(1)).dataset.i;
  a = hedef = i; sec(i);
  requestAnimationFrame(() => $("#filmler").scrollIntoView());
}
kapaklariYaz();

// ═════════ FAALİYET ARŞİVİ · ışıyan zaman çizgisi + katlanan kartlar
{
  const zaman = $(".zaman"), zk = $$(".zk", zaman), isik = $(".zaman-isik"), cipler = $$(".filtreler .cip");
  const sayac = $(".faaliyet-sayac strong");
  const yakin = new Set(), yerlesik = new Set();
  let gorunur = false, zKirli = true, olcGerek = true, ust = 0, boy = 1, noktaY = [], topler = new Map();
  const noktalarZ = zk.map((k) => $(".zk-nokta", k));

  function duzen() {
    let n = 0;
    for (const k of zk) {
      if (k.hidden) continue;
      if (genis.matches) { k.style.gridColumn = n % 2 ? "2" : "1"; k.style.gridRow = `${n + 1} / span 2`; }
      else { k.style.gridColumn = ""; k.style.gridRow = ""; }
      k.classList.toggle("sol", n % 2 === 0); k.classList.toggle("sag", n % 2 === 1);
      n++;
    }
    olcGerek = true; zKirli = true; uyandir();
  }
  duzen();
  genis.addEventListener("change", duzen);
  boyutDinleyiciler.push(() => { olcGerek = true; zKirli = true; uyandir(); });

  if (azHareket()) zk.forEach((k) => { k.classList.add("yerlesti"); yerlesik.add(k); });
  const io = new IntersectionObserver((g) => {
    for (const e of g) e.isIntersecting ? yakin.add(e.target) : yakin.delete(e.target);
    zKirli = true; uyandir();
  }, { rootMargin: "100% 0px" });
  zk.forEach((k) => io.observe(k));
  gozle(zaman, (v) => { gorunur = v; zKirli = true; uyandir(); });

  cipler.forEach((c) => c.addEventListener("click", () => {
    const f = c.dataset.filtre;
    cipler.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    let say = 0;
    for (const k of zk) {
      const goster = f === "Tümü" || k.dataset.kategori === f;
      if (goster && k.hasAttribute("data-faaliyet")) say++;
      if (k.hidden === !goster) continue;
      k.hidden = !goster;
      if (goster) { k.classList.remove("yeniden"); void k.offsetWidth; k.classList.add("yeniden"); }
    }
    sayac.textContent = String(say);
    duzen();
  }));
  zk.forEach((k) => k.addEventListener("animationend", () => k.classList.remove("yeniden")));

  kaydet({
    ad: "zaman",
    aktifMi: () => gorunur && (kaydirildi() || zKirli),
    oku: () => {
      if (olcGerek) {
        noktaY = zk.map((k) => (k.hidden ? Infinity : k.offsetTop + 39));
        boy = Math.max(1, zaman.offsetHeight); olcGerek = false;
      }
      ust = zaman.getBoundingClientRect().top;
      topler.clear();
      for (const k of yakin) if (!yerlesik.has(k) && !k.hidden) topler.set(k, k.getBoundingClientRect().top);
    },
    yaz: () => {
      zKirli = false;
      const cizgi = innerHeight * 0.6 - ust;
      isik.style.transform = `scaleY(${clamp01(cizgi / boy).toFixed(4)})`;
      noktalarZ.forEach((n, i) => n.classList.toggle("yandi", noktaY[i] <= cizgi));
      for (const [k, top] of topler) {
        const oran = (innerHeight - top) / innerHeight;
        if (oran >= 1) { yerlesik.add(k); k.classList.add("yerlesti"); k.style.transform = ""; k.style.opacity = ""; continue; }
        const st = kartKatlanma(Math.max(0, oran));
        k.style.transform = st.transform; k.style.opacity = st.opacity;
      }
    },
  });
}

// ═════════ ANI TÜNELİ (WebGL) · bölüme bir ekran kala yüklenir
{
  const iz = $(".tunel-iz"), tuval = $(".tunel-tuval"), liste = $(".tunel-liste"), izgara = $(".izgara");
  const no = $(".tunel-no"), alt = $(".tunel-alt"), acBtn = $(".tunel-ac");
  const imgler = $$("img", liste), toplam = imgler.length;
  const pad = (n) => String(n).padStart(2, "0");
  let tunel = null, yukleniyor = false, gorunur = false, p = 0, sonI = -1;

  const ucYok = () => { kok.dataset.kademe = "yok"; izgara.open = true; };
  if (mevcutKademe() === "yok") ucYok();
  else {
    gozle(iz, (v) => { gorunur = v; uyandir(); }, "0px");
    gozle(iz, async (v) => {
      if (!v || yukleniyor) return;
      yukleniyor = true;
      try {
        const { tunelSahnesi } = await import("./sahne-tunel.js");
        const fotolar = imgler.map((img) => ({ src: img.currentSrc || img.src, w: +img.dataset.w, h: +img.dataset.h, alt: img.alt }));
        tunel = tunelSahnesi(tuval, fotolar, mevcutKademe(), uyandir);
        kademeDinle((k) => tunel?.kademeAyarla(k));
        boyutDinleyiciler.push(() => tunel?.boyut());
        tuval.addEventListener("webglcontextlost", (e) => {
          e.preventDefault(); try { tunel?.yokEt(); } catch {} tunel = null; ucYok();
        }, { once: true });
        kaydet({
          ad: "tunel",
          aktifMi: () => gorunur && !!tunel && !durduMu(),
          oku: () => { p = bolumIlerleme(iz); },
          yaz: (dt, t) => {
            tunel.ciz(p, t); sahneCizdi();
            const i = tunel.enYakin();
            if (i !== sonI) { sonI = i; no.textContent = `${pad(i + 1)} / ${pad(toplam)}`; alt.textContent = imgler[i].alt; }
          },
        });
        uyandir();
      } catch { ucYok(); }
    }, "100% 0px");
  }

  const ac = (i, el) => goruntuleyiciAc(grupOgeleri(liste), i, el, false);
  acBtn.addEventListener("click", () => ac(tunel ? tunel.enYakin() : 0, acBtn));
  let bas = null;
  tuval.addEventListener("pointerdown", (e) => { bas = { x: e.clientX, y: e.clientY }; });
  tuval.addEventListener("pointerup", (e) => {
    if (!bas || !tunel) return;
    const uzak = Math.hypot(e.clientX - bas.x, e.clientY - bas.y); bas = null;
    if (uzak > 6) return;
    const i = tunel.tikla(e.offsetX, e.offsetY);
    if (i >= 0) ac(i, acBtn);
  });
  if (ince.matches) tuval.addEventListener("pointermove", (e) => {
    if (tunel) tuval.classList.toggle("isaret", tunel.tikla(e.offsetX, e.offsetY) >= 0);
  });
}

// ═════════ GÖRÜNTÜLEYİCİ · açıkken iki WebGL sahnesi de durur
goruntuleyiciKur({ acilinca: () => { durdur(true); kamOynatma(); }, kapaninca: () => { durdur(false); kamOynatma(); } });

// ═════════ SEKME
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { gVideo.pause(); videolar.forEach((v) => v.pause()); }
  else { girisVideoGuncelle(); kamOynatma(); }
});
