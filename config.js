/* ============================================================
   CREAGYM Equipment — единый конфиг и API заявок
   Заполни значения ниже и залей файл рядом с index.html / admin.html
   ============================================================ */
window.CREAGYM_CFG = {
  // Supabase: вставь URL проекта и публичный anon-ключ.
  // Пример URL: https://rkknbltiylsvmycbbyde.supabase.co
  SUPABASE_URL: "https://jugqixsacznucxbanrpf.supabase.co",
  SUPABASE_KEY: "sb_publishable_4HEzfI6H5MA9cLsKtferyw_slYgL8po",

  // Пароль для входа в админ-панель (admin.html)
  ADMIN_PASS: "creagym",

  // (необязательно) Telegram для уведомлений — подключим позже
  TELEGRAM_BOT: "",
  TELEGRAM_CHAT: ""
};

/* --- ниже трогать не нужно ------------------------------------------------ */
(function () {
  const cfg = window.CREAGYM_CFG;
  const LS = "creagym_leads";
  const online = () => !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);

  const headers = () => ({
    apikey: cfg.SUPABASE_KEY,
    Authorization: "Bearer " + cfg.SUPABASE_KEY,
    "Content-Type": "application/json"
  });

  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (e) { return []; } };
  const lsSet = (a) => { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} };

  async function leadCreate(lead) {
    const rec = Object.assign({}, lead, { status: "new", created_at: new Date().toISOString() });
    if (online()) {
      const r = await fetch(cfg.SUPABASE_URL + "/rest/v1/leads", {
        method: "POST",
        headers: Object.assign(headers(), { Prefer: "return=minimal" }),
        body: JSON.stringify(rec)
      });
      return r.ok;
    }
    rec.id = "ld_" + Date.now();
    const a = lsGet(); a.unshift(rec); lsSet(a);
    return true;
  }

  async function leadList() {
    if (online()) {
      const r = await fetch(cfg.SUPABASE_URL + "/rest/v1/leads?select=*&order=created_at.desc", { headers: headers() });
      if (!r.ok) throw new Error("Supabase " + r.status);
      return await r.json();
    }
    return lsGet();
  }

  async function leadUpdate(id, patch) {
    if (online()) {
      const r = await fetch(cfg.SUPABASE_URL + "/rest/v1/leads?id=eq." + encodeURIComponent(id), {
        method: "PATCH", headers: Object.assign(headers(), { Prefer: "return=minimal" }), body: JSON.stringify(patch)
      });
      return r.ok;
    }
    const a = lsGet(); const i = a.findIndex(x => x.id === id);
    if (i > -1) { Object.assign(a[i], patch); lsSet(a); }
    return true;
  }

  async function leadDelete(id) {
    if (online()) {
      const r = await fetch(cfg.SUPABASE_URL + "/rest/v1/leads?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: headers() });
      return r.ok;
    }
    lsSet(lsGet().filter(x => x.id !== id));
    return true;
  }

  window.CREAGYM_API = { leadCreate, leadList, leadUpdate, leadDelete, isOnline: online };
})();
