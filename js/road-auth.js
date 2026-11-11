/* ROAD Supabase Auth — browser session gate. No service-role credentials belong here. */
(() => {
  "use strict";
  const CONFIG = {
    url: "https://oinojqdxzyxurvrskhgs.supabase.co",
    publishableKey: "sb_publishable_O6ETKT_YgzPRjLLHi5rzaA_a8CKwhBs",
    hcaptchaSiteKey: "e45a9994-1dae-40be-b8d2-de3c72526a86",
    storageKey: "road.supabase.session.v1"
  };
  const $ = id => document.getElementById(id);
  const gate = $("roadAuthGate");
  const form = $("roadAuthForm");
  const status = $("roadAuthStatus");
  const submit = $("roadAuthSubmit");
  let captchaWidget = null;
  let captchaToken = "";
  let session = null;
  let refreshTimer = null;

  function say(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? "جارٍ التحقق…" : "تسجيل الدخول";
  }
  function store(next) {
    session = next;
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(next)); }
    catch (_) { say("تعذر حفظ الجلسة على هذا الجهاز.", true); }
  }
  function readStored() {
    try {
      const value = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
      return value && value.access_token && value.refresh_token ? value : null;
    } catch (_) { return null; }
  }
  async function request(path, options = {}, token) {
    const headers = Object.assign({
      apikey: CONFIG.publishableKey,
      "Content-Type": "application/json"
    }, options.headers || {});
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(CONFIG.url + path, Object.assign({}, options, { headers }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.msg || data.message || data.error_description || data.error || "تعذر إكمال الطلب.";
      throw new Error(message);
    }
    return data;
  }
  async function getIdentity(accessToken) {
    const user = await request("/auth/v1/user", { method: "GET" }, accessToken);
    const rows = await request(
      "/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(user.id) + "&limit=1",
      { method: "GET" }, accessToken
    );
    if (!Array.isArray(rows) || !rows.length || !["admin", "user"].includes(rows[0].role)) {
      throw new Error("هذا الحساب لا يملك دوراً مفعّلاً في ROAD. تواصل مع مسؤول النظام.");
    }
    return { user, role: rows[0].role };
  }
  function reveal(identity) {
    gate.hidden = true;
    document.body.classList.add("authenticated");
    const badge = $("roadAccountBadge");
    badge.hidden = false;
    badge.textContent = (identity.role === "admin" ? "ADMIN" : "USER") + " · " + (identity.user.email || identity.user.id);
    $("roadSignOut").hidden = false;
    $("roadSignOut").addEventListener("click", signOut, { once: true });
    if (refreshTimer) clearTimeout(refreshTimer);
    const expiresIn = Math.max(60, Number(session.expires_in || 3600) - 180);
    refreshTimer = setTimeout(refreshSession, expiresIn * 1000);
  }
  function lock(message) {
    document.body.classList.remove("authenticated");
    gate.hidden = false;
    $("roadAccountBadge").hidden = true;
    $("roadSignOut").hidden = true;
    say(message || "سجّل الدخول للمتابعة.");
  }
  async function refreshSession() {
    if (!session || !session.refresh_token) return lock("انتهت الجلسة. سجّل الدخول مجدداً.");
    try {
      const next = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      store(next);
      const identity = await getIdentity(next.access_token);
      reveal(identity);
    } catch (_) {
      localStorage.removeItem(CONFIG.storageKey);
      session = null;
      lock("انتهت الجلسة أو تعذر تجديدها. سجّل الدخول مجدداً.");
    }
  }
  async function signOut() {
    if (refreshTimer) clearTimeout(refreshTimer);
    try {
      if (session) await request("/auth/v1/logout", { method: "POST" }, session.access_token);
    } catch (_) { /* local session is still cleared */ }
    localStorage.removeItem(CONFIG.storageKey);
    session = null;
    lock("تم تسجيل الخروج من هذا الجهاز.");
    resetCaptcha();
  }
  function resetCaptcha() {
    captchaToken = "";
    if (window.hcaptcha && captchaWidget !== null) {
      try { window.hcaptcha.reset(captchaWidget); } catch (_) {}
    }
  }
  function onCaptchaVerified(token) { captchaToken = token || ""; }
  function onCaptchaExpired() { captchaToken = ""; }
  window.roadCaptchaVerified = onCaptchaVerified;
  window.roadCaptchaExpired = onCaptchaExpired;
  function loadCaptcha() {
    if (window.hcaptcha) return renderCaptcha();
    if (document.querySelector('script[data-road-hcaptcha]')) return;
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?onload=roadHcaptchaReady&render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.roadHcaptcha = "1";
    script.onerror = () => say("تعذر تحميل hCaptcha. تحقق من الاتصال أو إعدادات النطاق.", true);
    document.head.appendChild(script);
  }
  function renderCaptcha() {
    if (captchaWidget !== null || !window.hcaptcha || !$("roadCaptcha")) return;
    try {
      captchaWidget = window.hcaptcha.render("roadCaptcha", {
        sitekey: CONFIG.hcaptchaSiteKey,
        callback: onCaptchaVerified,
        "expired-callback": onCaptchaExpired,
        "error-callback": onCaptchaExpired,
        theme: "dark"
      });
    } catch (_) { say("تعذر تهيئة hCaptcha. تحقق من Site Key والنطاق المسموح.", true); }
  }
  window.roadHcaptchaReady = renderCaptcha;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("roadAuthEmail").value.trim();
    const password = $("roadAuthPassword").value;
    if (!email || !password) return say("أدخل البريد الإلكتروني وكلمة المرور.", true);
    if (!captchaToken) return say("أكمل اختبار hCaptcha أولاً.", true);
    setBusy(true);
    say("جارٍ التحقق من الحساب…");
    try {
      const next = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password, captcha_token: captchaToken })
      });
      store(next);
      const identity = await getIdentity(next.access_token);
      $("roadAuthPassword").value = "";
      reveal(identity);
    } catch (error) {
      localStorage.removeItem(CONFIG.storageKey);
      session = null;
      say(error.message || "فشل تسجيل الدخول.", true);
      resetCaptcha();
    } finally { setBusy(false); }
  });

  (async function boot() {
    loadCaptcha();
    const saved = readStored();
    if (!saved) return lock("سجّل الدخول للمتابعة.");
    session = saved;
    try {
      const identity = await getIdentity(saved.access_token);
      reveal(identity);
    } catch (_) {
      try {
        const next = await request("/auth/v1/token?grant_type=refresh_token", {
          method: "POST", body: JSON.stringify({ refresh_token: saved.refresh_token })
        });
        store(next);
        const identity = await getIdentity(next.access_token);
        reveal(identity);
      } catch (_) {
        localStorage.removeItem(CONFIG.storageKey);
        session = null;
        lock("انتهت الجلسة. سجّل الدخول مجدداً.");
      }
    }
  })();
})();