    const rec = Object.assign({}, clean, { status: "new", created_at: new Date().toISOString() });
    if (online()) {
      const r = await fetch(URL() + "/rest/v1/leads", { method: "POST", headers: Object.assign(headers(), { Prefer: "return=minimal" }), body: JSON.stringify(rec) });
      return r.ok;
    }
    rec.id = "ld_" + Date.now(); const a = lsGet(L, []); a.unshift(rec); lsSet(L, a); return true;
  }
  async function leadList() {
    if (online()) {
      const r = await fetch(URL() + "/rest/v1/leads?select=*&order=created_at.desc", { headers: headers() });
      if (!r.ok) throw new Error("Supabase " + r.status); return await r.json();
    }
    return lsGet(L, []);
  }
  async function leadUpdate(id, patch) {
    if (online()) { const r = await fetch(URL() + "/rest/v1/leads?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: Object.assign(headers(), { Prefer: "return=minimal" }), body: JSON.stringify(patch) }); return r.ok; }
    const a = lsGet(L, []); const i = a.findIndex(x => x.id === id); if (i > -1) { Object.assign(a[i], patch); lsSet(L, a); } return true;
  }
  async function leadDelete(id) {
    if (online()) { const r = await fetch(URL() + "/rest/v1/leads?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: headers() }); return r.ok; }
    lsSet(L, lsGet(L, []).filter(x => x.id !== id)); return true;
  }

  /* ---------------- PRODUCTS ---------------- */
  const P = "creagym_products";
  function normProduct(p) {
    let images = Array.isArray(p.images) ? p.images : [];
    if (!images.length && p.image) images = [p.image];
    images = images.map(s => cut(s, 600)).filter(Boolean).slice(0, 12);
    return {
      brand: cut(p.brand, 20) || "SHUA",
      category: cut(p.category, 20) || "strength",
      name: cut(p.name, 120),
      model: cut(p.model, 60),
      subtitle: cut(p.subtitle, 80),
      image: images[0] || "",            // обложка (совместимость)
      images: images,                    // все фото
      description: cut(p.description, 1200),
      specs: (Array.isArray(p.specs) ? p.specs : []).slice(0, 30)
        .map(s => ({ k: cut(s.k, 60), v: cut(s.v, 120) }))
        .filter(s => s.k || s.v)
    };
  }
  async function productList() {
    if (online()) {
      const r = await fetch(URL() + "/rest/v1/products?select=*&order=created_at.asc", { headers: headers() });
      if (!r.ok) throw new Error("Supabase " + r.status);
      return await r.json();
    }
    let a = lsGet(P, null);
    if (a === null) { a = clone(window.CREAGYM_PRODUCTS_DEFAULT).map(x => Object.assign({ id: "pr_" + Math.random().toString(36).slice(2), created_at: new Date().toISOString() }, x)); lsSet(P, a); }
    return a;
  }
  async function productCreate(p) {
    const rec = Object.assign({}, normProduct(p), { created_at: new Date().toISOString() });
    if (online()) { const r = await fetch(URL() + "/rest/v1/products", { method: "POST", headers: Object.assign(headers(), { Prefer: "return=minimal" }), body: JSON.stringify(rec) }); return r.ok; }
    rec.id = "pr_" + Date.now(); const a = lsGet(P, []); a.push(rec); lsSet(P, a); return true;
  }
  async function productUpdate(id, p) {
    const patch = normProduct(p);
    if (online()) { const r = await fetch(URL() + "/rest/v1/products?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: Object.assign(headers(), { Prefer: "return=minimal" }), body: JSON.stringify(patch) }); return r.ok; }
    const a = lsGet(P, []); const i = a.findIndex(x => String(x.id) === String(id)); if (i > -1) { Object.assign(a[i], patch); lsSet(P, a); } return true;
  }
  async function productDelete(id) {
    if (online()) { const r = await fetch(URL() + "/rest/v1/products?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: headers() }); return r.ok; }
    lsSet(P, lsGet(P, []).filter(x => String(x.id) !== String(id))); return true;
  }
  async function productSeedDefaults() {
    let n = 0;
    for (const p of window.CREAGYM_PRODUCTS_DEFAULT) { if (await productCreate(p)) n++; }
    return n;
  }

  /* ---------------- IMAGE UPLOAD ---------------- */
  // Загружает файл в Supabase Storage (bucket: product-images) и возвращает публичный URL.
  // В демо-режиме возвращает data-URL, чтобы фото отображалось локально.
  const BUCKET = "product-images";
  function fileToDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("read error")); r.readAsDataURL(file); });
  }
  async function imageUpload(file) {
    if (!file) throw new Error("no file");
    if (file.size > 5 * 1024 * 1024) throw new Error("Файл більший за 5 МБ");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
    if (online()) {
      const r = await fetch(URL() + "/storage/v1/object/" + BUCKET + "/" + path, {
        method: "POST",
        headers: { apikey: cfg.SUPABASE_KEY, Authorization: "Bearer " + cfg.SUPABASE_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: file
      });
      if (!r.ok) { let m = ""; try { m = (await r.json()).message || ""; } catch (e) {} throw new Error("Storage " + r.status + (m ? " · " + m : "")); }
      return URL() + "/storage/v1/object/public/" + BUCKET + "/" + path;
    }
    return await fileToDataURL(file); // демо
  }

  /* ---------------- SITE SETTINGS (hero / showcase images) ---------------- */
  const S = "creagym_site";
  const SITE_DEFAULT = { hero:"", look1:"", look2:"", look3:"" };
  async function siteGet() {
    if (online()) {
      const r = await fetch(URL() + "/rest/v1/site_settings?id=eq.1&select=data", { headers: headers() });
      if (!r.ok) throw new Error("Supabase " + r.status);
      const rows = await r.json();
      return Object.assign({}, SITE_DEFAULT, (rows[0] && rows[0].data) || {});
    }
    return Object.assign({}, SITE_DEFAULT, lsGet(S, {}));
  }
  async function siteSave(data) {
    const clean = { hero: cut(data.hero, 600), look1: cut(data.look1, 600), look2: cut(data.look2, 600), look3: cut(data.look3, 600) };
    if (online()) {
      const r = await fetch(URL() + "/rest/v1/site_settings?on_conflict=id", {
        method: "POST",
        headers: Object.assign(headers(), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ id: 1, data: clean })
      });
      return r.ok;
    }
    lsSet(S, clean); return true;
  }

  window.CREAGYM_API = {
    isOnline: online,
    leadCreate, leadList, leadUpdate, leadDelete,
    productList, productCreate, productUpdate, productDelete, productSeedDefaults,
    imageUpload, siteGet, siteSave
  };
})();
