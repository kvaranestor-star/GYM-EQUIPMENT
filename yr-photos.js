// Vercel serverless: тягне каталог Yanre (WooCommerce Store API) на сервері (без CORS)
// і повертає { "MODEL": "https://...hd.jpg", ... } по коду моделі (sku).
// Деплой: поклади цей файл як  /api/yr-photos.js  у корінь репозиторію.
// Виклик з адмінки:  fetch('/api/yr-photos')

const BASE = "https://www.yanrefitness.com/wp-json/wc/store/v1/products";

function abs(u) {
  if (!u) return "";
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return "https://www.yanrefitness.com" + u;
  return u;
}

// з srcset обираємо найбільшу ширину; інакше беремо src
function bestSrc(img) {
  if (!img) return "";
  if (img.srcset) {
    let best = "", bw = 0;
    for (const part of img.srcset.split(",")) {
      const m = part.trim().match(/(\S+)\s+(\d+)w/);
      if (m && +m[2] > bw) { bw = +m[2]; best = m[1]; }
    }
    if (best) return abs(best);
  }
  return abs(img.src);
}

export default async function handler(req, res) {
  try {
    const out = {};
    const perPage = 100;
    let page = 1, totalPages = 1;
    do {
      const r = await fetch(`${BASE}?per_page=${perPage}&page=${page}`, {
        headers: { "Accept": "application/json", "User-Agent": "CGM-photo-sync" }
      });
      if (!r.ok) break;
      totalPages = parseInt(r.headers.get("x-wp-totalpages") || "1", 10) || 1;
      const list = await r.json();
      if (!Array.isArray(list) || !list.length) break;
      for (const p of list) {
        const sku = (p.sku || "").trim();
        if (!sku) continue;
        const img = (p.images && p.images[0]) || null;
        const src = bestSrc(img);
        if (src) out[sku] = src;
      }
      page++;
    } while (page <= totalPages && page <= 12);

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ count: Object.keys(out).length, photos: out });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
