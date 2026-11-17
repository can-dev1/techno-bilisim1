// ── GÖRÜNTÜLEYİCİ: sayfadaki bütün fotoğraflar (faaliyet, etkinlik arşivi, anı tüneli) aynı <dialog>'da açılır.
// Bir grup = en yakın [data-galeri] kapsayıcısındaki bütün a.foto bağlantıları.
const dlg = document.querySelector(".goruntuleyici");
const fig = dlg.querySelector("figure");
const img = dlg.querySelector(".gr-gorsel");
const altYazi = dlg.querySelector(".gr-alt");
const sayac = dlg.querySelector(".gr-sayac");
const azalt = matchMedia("(prefers-reduced-motion: reduce)");

let ogeler = [], sira = 0, acan = null, ayarlar = {};

const oge = (a) => {
  const k = a.querySelector("img");
  return { buyuk: a.getAttribute("href"), kucuk: k.getAttribute("src"), w: +k.dataset.w || k.naturalWidth, h: +k.dataset.h || k.naturalHeight, alt: k.alt, kucukEl: k };
};
export const grupOgeleri = (kap) => [...kap.querySelectorAll("a.foto")].map(oge);

// Görselin ekrandaki son kutusu (figure'ün iç alanına sığdırılmış)
function kutu(o) {
  const s = getComputedStyle(fig);
  const pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight), pt = parseFloat(s.paddingTop), pb = parseFloat(s.paddingBottom);
  const aw = innerWidth - pl - pr, ah = innerHeight - pt - pb;
  const o2 = Math.min(aw / o.w, ah / o.h);
  const w = Math.round(o.w * o2), h = Math.round(o.h * o2);
  return { w, h, x: pl + (aw - w) / 2, y: pt + (ah - h) / 2 };
}

const uygunAdres = (o) => (innerWidth * (devicePixelRatio || 1) > 700 ? o.buyuk : o.kucuk);

function goster(i, flip) {
  sira = (i + ogeler.length) % ogeler.length;
  const o = ogeler[sira];
  const k = kutu(o);
  img.width = o.w; img.height = o.h;
  img.style.width = k.w + "px"; img.style.height = k.h + "px";
  img.alt = o.alt;
  img.srcset = `${o.kucuk} 640w, ${o.buyuk} 1280w`;
  img.src = o.kucuk;
  altYazi.textContent = o.alt;
  sayac.textContent = `${sira + 1} / ${ogeler.length}`;
  const tek = ogeler.length < 2;
  dlg.querySelector(".gr-onceki").hidden = tek; dlg.querySelector(".gr-sonraki").hidden = tek;
  // komşuları önceden yükle
  for (const d of [-1, 1]) { const n = ogeler[(sira + d + ogeler.length) % ogeler.length]; if (n && !tek) new Image().src = uygunAdres(n); }

  if (azalt.matches) { img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" }); return; }
  const kaynak = flip && o.kucukEl?.isConnected ? o.kucukEl.getBoundingClientRect() : null;
  if (kaynak && kaynak.width) {
    // FLIP: küçük resmin yerinden tam boya
    const dx = kaynak.left - k.x, dy = kaynak.top - k.y, sx = kaynak.width / k.w, sy = kaynak.height / k.h;
    img.animate([{ transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: .6 },
                 { transformOrigin: "0 0", transform: "none", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
  } else {
    img.animate([{ transform: "scale(.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
  }
}

export function ac(liste, i, kaynakEl, flip = true) {
  if (!liste.length) return;
  ogeler = liste; acan = kaynakEl || document.activeElement;
  document.body.classList.add("kilit");
  ayarlar.acilinca?.();
  dlg.showModal();
  goster(i, flip);
}

function kapat() { dlg.close(); }
dlg.addEventListener("close", () => {
  document.body.classList.remove("kilit");
  img.removeAttribute("srcset"); img.removeAttribute("src");
  ayarlar.kapaninca?.();
  acan?.focus?.({ preventScroll: true });
});

export function goruntuleyiciKur(a = {}) {
  ayarlar = a;
  document.addEventListener("click", (e) => {
    const l = e.target.closest?.("a.foto");
    if (!l || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const kap = l.closest("[data-galeri]");
    if (!kap) return;
    e.preventDefault();
    const hepsi = [...kap.querySelectorAll("a.foto")];
    ac(hepsi.map(oge), hepsi.indexOf(l), l);
  });
}

dlg.querySelector(".gr-onceki").addEventListener("click", () => goster(sira - 1));
dlg.querySelector(".gr-sonraki").addEventListener("click", () => goster(sira + 1));
dlg.querySelector(".gr-kapat").addEventListener("click", kapat);
dlg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { e.preventDefault(); goster(sira - 1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); goster(sira + 1); }
});

// Dokunmatik: yatay 40 px → geçiş, aşağı 80 px → kapan; boş alana dokunma → kapan
let bas = null;
fig.addEventListener("pointerdown", (e) => { bas = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
fig.addEventListener("pointerup", (e) => {
  if (!bas || e.pointerId !== bas.id) return;
  const dx = e.clientX - bas.x, dy = e.clientY - bas.y; bas = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goster(sira + (dx < 0 ? 1 : -1));
  else if (dy > 80) kapat();
  else if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.target === fig) kapat();
});
fig.addEventListener("pointercancel", () => { bas = null; });

addEventListener("resize", () => {
  if (!dlg.open) return;
  const k = kutu(ogeler[sira]);
  img.style.width = k.w + "px"; img.style.height = k.h + "px";
}, { passive: true });
