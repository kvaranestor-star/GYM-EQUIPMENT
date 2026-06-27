// Vercel serverless (CommonJS) — тягне каталог Yanre (WooCommerce Store API) на сервері.
// Поклади як  /api/yr-photos.js  у корінь репозиторію (папка має називатися саме "api").
// Тест: відкрий у браузері https://ТВІЙ-САЙТ/api/yr-photos  — має повернути JSON { count, photos }.

const BASE = "https://www.yanrefitness.com/wp-json/wc/store/v1/products";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function abs(u) {
  if (!u) return "";
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return "https://www.yanrefitness.com" + u;
  return u;
}
function bestSrc(img) {
  if (!img) return "";
  if (img.srcset) {
    let best = "", bw = 0;
    for (const part of String(img.srcset).split(",")) {
      const m = part.trim().match(/(\S+)\s+(\d+)w/);
      if (m && +m[2] > bw) { bw = +m[2]; best = m[1]; }
    }
    if (best) return abs(best);
  }
  return abs(img.src);
}

module.exports = async (req, res) => {
  const debug = { pages: 0, firstStatus: null, totalPages: 1, note: "" };
  try {
    const out = {};
    const perPage = 100;
    let page = 1;
    do {
      const r = await fetch(`${BASE}?per_page=${perPage}&page=${page}`, {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": UA,
          "Referer": "https://www.yanrefitness.com/"
        }
      });
      if (page === 1) debug.firstStatus = r.status;
      if (!r.ok) { debug.note = "HTTP " + r.status + " від Store API"; break; }
      debug.totalPages = parseInt(r.headers.get("x-wp-totalpages") || "1", 10) || 1;
      const text = await r.text();
      let list;
      try { list = JSON.parse(text); }
      catch (e) { debug.note = "не JSON (можливо Cloudflare): " + text.slice(0, 120); break; }
      if (!Array.isArray(list) || !list.length) break;
      for (const p of list) {
        const sku = (p.sku || "").trim();
        if (!sku) continue;
        const src = bestSrc((p.images && p.images[0]) || null);
        if (src) out[sku] = src;
      }
      debug.pages = page;
      page++;
    } while (page <= debug.totalPages && page <= 12);

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({ count: Object.keys(out).length, photos: out, debug });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e), debug });
  }
};
