/* Batzal shared UI: fills the logo and the apps menu of every .bz-bar, and renders the account area (sign-in / rank / avatar menu).
   The Musicals/Account sites render the same markup with React (components/BatzalAccountMenu.tsx): change both together. */
(function () {
  "use strict";
  var SITES = [
    { t: { he: "דף הבית", en: "Home" }, u: "https://batzal.net", h: "batzal.net", p: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
    { t: { he: "הספרייה", en: "Library" }, u: "https://library.batzal.net", h: "library.batzal.net", p: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z" },
    { t: { he: "מפיק QR", en: "QR maker" }, u: "https://qr.batzal.net", h: "qr.batzal.net", p: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" },
    { t: { he: "בלוג", en: "Blog" }, u: "https://blog.batzal.net", h: "blog.batzal.net", p: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM8 20a3 3 0 01-3-3" },
    // Only offered to people who may open it (super admins).
    { t: { he: "לוח בקרה", en: "Control panel" }, u: "https://admin.batzal.net", h: "admin.batzal.net", admin: true, p: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4" },
  ];
  var LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bzg" x1="12" y1="8" x2="52" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7b97ff"/><stop offset="1" stop-color="#3a58d6"/></linearGradient></defs><path d="M32 10C40 20 54 26 54 40c0 11-10 18-22 18S10 51 10 40c0-14 14-20 22-30z" fill="url(#bzg)"/><path d="M32 15c-6 11-10 21-8 35M32 15c6 11 10 21 8 35" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.2" stroke-linecap="round"/><path d="M32 10c0-4 1-6 4-8" fill="none" stroke="#35c58b" stroke-width="3.4" stroke-linecap="round"/></svg>';
  var logoCount = 0;
  function logoSvg() { logoCount += 1; return LOGO.split("bzg").join("bzg" + logoCount); }
  window.BatzalLogoSvg = logoSvg;
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 004 0"/></svg>';
  var GRID = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>';
  var GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.92h5.45c-.22 1.26-.96 2.33-2.07 3.05l3.34 2.59c1.95-1.8 3.08-4.45 3.08-7.61 0-.72-.06-1.4-.18-2.06H12Z"/><path fill="#34A853" d="M12 22c2.79 0 5.13-.92 6.84-2.49l-3.34-2.59c-.93.63-2.11 1-3.5 1-2.69 0-4.96-1.81-5.77-4.24H2.78v2.67A9.99 9.99 0 0 0 12 22Z"/><path fill="#4A90E2" d="M6.23 13.68A5.96 5.96 0 0 1 5.91 12c0-.58.1-1.14.32-1.68V7.65H2.78A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.35l3.15-2.67Z"/><path fill="#FBBC05" d="M12 6.08c1.52 0 2.88.52 3.95 1.54l2.96-2.96C17.12 2.99 14.79 2 12 2 8.09 2 4.73 4.24 3.08 7.65l3.15 2.67c.81-2.43 3.08-4.24 5.77-4.24Z"/></svg>';

  var TEXT = {
    he: { signIn: "התחברות", google: "המשך עם Google", guest: "המשך כאורח", account: "החשבון שלי", language: "שפה", theme: "בהירות", dark: "כהה", light: "בהיר", signOut: "התנתק",
      notifications: "התראות", markAll: "סמן הכל כנקרא", noNotifications: "אין התראות חדשות", confirmTitle: "להתנתק?", confirmText: "תתנתק מהאתר הזה. אפשר להתחבר שוב בכל רגע.", cancel: "ביטול", apps: "האתרים שלי", level: "דרגה" },
    en: { signIn: "Sign in", google: "Continue with Google", guest: "Continue as guest", account: "My account", language: "Language", theme: "Appearance", dark: "Dark", light: "Light", signOut: "Sign out",
      notifications: "Notifications", markAll: "Mark all as read", noNotifications: "No new notifications", confirmTitle: "Sign out?", confirmText: "You will be signed out of this site. You can sign in again at any time.", cancel: "Cancel", apps: "My sites", level: "Rank" },
  };
  // Rank = role. `level` fills the bar in the tooltip.
  var RANKS = {
    user: { level: 1, he: ["משתמש", "חשבון רגיל. אפשר לצפות בכל התכנים, להגיב ולנהל את הפרופיל. עריכת תכנים ניתנת על ידי מנהלים."], en: ["Member", "A regular account. You can browse everything, comment and manage your profile. Editing is granted by the admins."] },
    editor: { level: 2, he: ["עורך", "אפשר להוסיף ולערוך מחזות וקטעים, בנוסף לכל מה שיש למשתמש רגיל."], en: ["Editor", "You can add and edit musicals and clips, on top of everything a member can do."] },
    admin: { level: 3, he: ["מנהל", "מנהל תכנים ומשתמשים: מאשר עורכים, מטפל בדיווחים ומנהל הרשאות."], en: ["Admin", "Manages content and people: approves editors, handles reports and manages permissions."] },
    superadmin: { level: 4, he: ["מנהל ראשי", "הדרגה הגבוהה ביותר: גישה מלאה לכל האתרים, כולל לוח הבקרה והשליטה בשרתים."], en: ["Super admin", "The highest rank: full access to every site, including the control panel and the servers."] },
  };

  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>';
  // Appearance and language are kept in cookies shared by every *.batzal.net site (and by every port on localhost),
  // so a choice made on one site holds on all of them, signed in or not.
  function readCookie(name) {
    var parts = (document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].trim();
      if (kv.indexOf(name + "=") === 0) return decodeURIComponent(kv.slice(name.length + 1));
    }
    return null;
  }
  function writeCookie(name, value) {
    var domain = /(^|\.)batzal\.net$/.test(location.hostname) ? "; domain=.batzal.net" : "";
    document.cookie = name + "=" + (value == null ? "" : encodeURIComponent(value)) + "; path=/; max-age=" + (value == null ? 0 : 31536000) + "; samesite=lax" + domain + (location.protocol === "https:" ? "; secure" : "");
  }
  function guestLang() { var l = readCookie("bz_lang"); return l === "he" || l === "en" ? l : "he"; }
  function langOf(user) { return user ? (user.lang === "en" ? "en" : "he") : guestLang(); }
  // The control panel is offered to super admins and to anyone holding its permission.
  function canOpenAdmin(user) { return !!user && (user.role === "superadmin" || (user.perms || []).indexOf("panel_view") >= 0); }

  // ---- theme: html[data-theme]; without it the page follows the system setting. localStorage only avoids a flash before the user is known
  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme); else root.removeAttribute("data-theme");
  }
  function rememberTheme(theme) {
    writeCookie("bz_theme", theme === "light" || theme === "dark" ? theme : null);
  }
  applyTheme(readCookie("bz_theme"));

  // Only one header window is open at a time: opening one tells the others to close.
  function exclusive(owner, close) {
    document.addEventListener("bz-popup", function (e) { if (e.detail !== owner) close(); });
  }
  function announce(owner) { document.dispatchEvent(new CustomEvent("bz-popup", { detail: owner })); }

  var current = null;
  var appsItems = [];
  function refreshApps() {
    var lg = langOf(current);
    appsItems.forEach(function (it) {
      it.a.hidden = it.site.admin && !canOpenAdmin(current);
      it.span.textContent = it.site.t[lg];
    });
    document.querySelectorAll(".bz-apps").forEach(function (b) { b.setAttribute("aria-label", TEXT[lg].apps); });
  }

  function init() {
    document.querySelectorAll(".bz-brand").forEach(function (a) {
      if (location.hostname !== "batzal.net") a.href = location.hostname === "localhost" ? a.href : "https://batzal.net";
      if (!a.querySelector("svg")) a.insertAdjacentHTML("afterbegin", logoSvg());
      if (!a.textContent.trim()) a.insertAdjacentHTML("beforeend", "<span>Batzal</span>");
    });
    document.querySelectorAll(".bz-appswrap").forEach(function (wrap) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "bz-apps"; btn.setAttribute("aria-label", TEXT.he.apps);
      btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false"); btn.innerHTML = GRID;
      var menu = document.createElement("div");
      menu.className = "bz-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
      SITES.forEach(function (s) {
        var a = document.createElement("a");
        a.href = s.u; a.setAttribute("role", "menuitem");
        if (s.h === location.hostname) a.setAttribute("aria-current", "page");
        a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + s.p + '"/></svg><span></span>';
        a.hidden = !!s.admin;
        menu.appendChild(a);
        appsItems.push({ a: a, site: s, span: a.lastChild });
      });
      function set(open) { menu.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false"); if (open) announce(wrap); }
      exclusive(wrap, function () { set(false); });
      btn.addEventListener("click", function (e) { e.stopPropagation(); set(menu.hidden); });
      document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) set(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { set(false); btn.focus(); } });
      wrap.append(btn, menu);
    });
    refreshApps();
  }
  var ready = function () { init(); if (window.BatzalI18n) window.BatzalI18n.apply(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
  // the page text is translated once the rest of this script (below) has defined BatzalI18n
  window.addEventListener("load", function () { if (window.BatzalI18n) window.BatzalI18n.apply(); });

  function seg(label, options, active, onPick) {
    var row = make("div", "bz-row");
    row.appendChild(make("span", "", label));
    var group = make("div", "bz-seg");
    options.forEach(function (o) {
      var b = make("button");
      b.type = "button"; b.setAttribute("aria-pressed", o.value === active ? "true" : "false");
      if (o.icon) b.insertAdjacentHTML("afterbegin", o.icon);
      b.appendChild(document.createTextNode(o.label));
      b.addEventListener("click", function () { onPick(o.value); });
      group.appendChild(b);
    });
    row.appendChild(group);
    return row;
  }

  function confirmSignOut(host, t, onYes) {
    var overlay = make("div", "bz-confirm");
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    var box = make("div", "bz-confirm-box");
    box.appendChild(make("h2", "", t.confirmTitle));
    box.appendChild(make("p", "", t.confirmText));
    var actions = make("div", "bz-confirm-actions");
    var no = make("button", "", t.cancel); no.type = "button";
    var yes = make("button", "bz-danger", t.signOut); yes.type = "button";
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    no.addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    yes.addEventListener("click", function () { close(); onYes(); });
    document.addEventListener("keydown", onKey);
    actions.append(no, yes);
    box.appendChild(actions);
    overlay.appendChild(box);
    host.appendChild(overlay);
    no.focus();
  }

  function resolvedTheme() {
    return document.documentElement.getAttribute("data-theme") || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  // Language and appearance rows, shared by the guest pop-up and the signed-in menu.
  function prefRows(parent, t, lg, onChange) {
    parent.appendChild(seg(t.language, [{ value: "he", label: "עברית" }, { value: "en", label: "English" }], lg, function (v) { if (v !== lg) onChange({ lang: v }); }));
    var themeNow = resolvedTheme();
    var themeRow = seg(t.theme, [{ value: "light", label: t.light, icon: SUN }, { value: "dark", label: t.dark, icon: MOON }], themeNow, function (v) {
      if (v === themeNow) return;
      themeNow = v;
      themeRow.querySelectorAll("button").forEach(function (b, idx) { b.setAttribute("aria-pressed", (idx === 0 ? "light" : "dark") === v ? "true" : "false"); });
      onChange({ theme: v });
    });
    parent.appendChild(themeRow);
  }

  // ---- page text in both languages. A page lists its strings in window.BZ_STRINGS = { he: {key: text}, en: {...} } and marks
  // elements with data-i18n (text), data-i18n-ph (placeholder), data-i18n-title, data-i18n-aria. Hebrew is the fallback.
  var I18N = {
    lang: function () { return langOf(current); },
    t: function (key, vars) {
      var all = window.BZ_STRINGS || {};
      var text = (all[I18N.lang()] && all[I18N.lang()][key]) || (all.he && all.he[key]) || key;
      if (vars) for (var k in vars) text = text.split("{" + k + "}").join(vars[k]);
      return text;
    },
    apply: function () {
      var lg = I18N.lang();
      document.documentElement.setAttribute("lang", lg);
      document.documentElement.setAttribute("dir", lg === "en" ? "ltr" : "rtl");
      autoApply(lg);
      [["data-i18n", null], ["data-i18n-ph", "placeholder"], ["data-i18n-title", "title"], ["data-i18n-aria", "aria-label"]].forEach(function (pair) {
        document.querySelectorAll("[" + pair[0] + "]").forEach(function (el) {
          var text = I18N.t(el.getAttribute(pair[0]));
          if (pair[1]) el.setAttribute(pair[1], text); else if (el.tagName === "TITLE") document.title = text; else el.textContent = text;
        });
      });
    },
  };
  // ---- automatic translation for pages whose text is built in many places (the control panel): the page lists
  // window.BZ_AUTO = { exact: {"עברית": "English"}, rules: [["^(\\d+) מתוך (\\d+)$", "$1 of $2"]] }. In English every Hebrew
  // text on the page (including text added later) is replaced; switching back restores the original.
  var HEBREW = /[\u0590-\u05FF]/;
  var translated = []; // [{node|el, attr, original}]
  var autoBusy = false;
  function autoText(text) {
    var a = window.BZ_AUTO;
    if (!a) return null;
    var t = text.trim();
    if (!t || !HEBREW.test(t)) return null;
    if (a.exact && Object.prototype.hasOwnProperty.call(a.exact, t)) return text.replace(t, a.exact[t]);
    var rules = a.rules || [];
    for (var i = 0; i < rules.length; i++) {
      var re = new RegExp(rules[i][0]);
      if (re.test(t)) return text.replace(t, t.replace(re, rules[i][1]));
    }
    return null;
  }
  function autoWalk(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var n = walker.currentNode;
    while (n) {
      if (n.nodeType === 3) {
        var parentTag = n.parentNode && n.parentNode.nodeName;
        if (parentTag !== "SCRIPT" && parentTag !== "STYLE") {
          var out = autoText(n.data);
          if (out != null) { translated.push({ node: n, original: n.data }); n.data = out; }
        }
      } else if (n.nodeType === 1) {
        ["placeholder", "aria-label", "title"].forEach(function (attr) {
          var v = n.getAttribute && n.getAttribute(attr);
          var o = v && autoText(v);
          if (o != null) { translated.push({ el: n, attr: attr, original: v }); n.setAttribute(attr, o); }
        });
      }
      n = walker.nextNode();
    }
  }
  function autoApply(lg) {
    if (!window.BZ_AUTO) return;
    autoBusy = true;
    try {
      if (lg === "en") { autoWalk(document.body); var ot = autoText(document.title); if (ot != null) document.title = ot; }
      else {
        translated.forEach(function (item) { if (item.node) item.node.data = item.original; else item.el.setAttribute(item.attr, item.original); });
        translated = [];
      }
    } finally { autoBusy = false; }
    if (!autoApply.observer && window.MutationObserver) {
      autoApply.observer = new MutationObserver(function (records) {
        if (autoBusy || langOf(current) !== "en") return;
        autoBusy = true;
        try { records.forEach(function (r) { if (r.type === "characterData") { var o = autoText(r.target.data); if (o != null) { translated.push({ node: r.target, original: r.target.data }); r.target.data = o; } } else if (r.type === "attributes") { var v = r.target.getAttribute(r.attributeName); var oo = v && autoText(v); if (oo != null) { translated.push({ el: r.target, attr: r.attributeName, original: v }); r.target.setAttribute(r.attributeName, oo); } } else r.addedNodes.forEach(function (nd) { if (nd.nodeType === 3) { var o2 = autoText(nd.data); if (o2 != null) { translated.push({ node: nd, original: nd.data }); nd.data = o2; } } else if (nd.nodeType === 1) autoWalk(nd); }); }); } finally { autoBusy = false; }
      });
      autoApply.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    }
  }

  window.BatzalI18n = I18N;

  // ---- one network: being signed in (or out) at one Batzal site means the same everywhere ----
  // The account site answers 200 to /api/preferences when this browser is signed in there and 401 when it is not.
  function probe(idp) {
    return fetch(idp + "/api/preferences", { credentials: "include" }).then(function (r) { return r.status; }).catch(function () { return 0; });
  }
  function recentlyTried() {
    try { var at = Number(sessionStorage.getItem("bz-sso-try") || 0); return Date.now() - at < 30000; } catch (e) { return false; }
  }
  function markTried() { try { sessionStorage.setItem("bz-sso-try", String(Date.now())); } catch (e) { /* ignore */ } }
  var watching = false;
  function watchNetwork(idp, getUser, opts) {
    function check() {
      var user = getUser();
      probe(idp).then(function (status) {
        if (!user && opts.autoSignIn !== false && status === 200 && !recentlyTried()) { markTried(); location.href = opts.signInHref || "/api/sso/start"; }
        if (user && status === 401 && (opts.onSignedOut || opts.onLogout)) (opts.onSignedOut || opts.onLogout)();
      });
    }
    check();
    if (!watching) {
      watching = true;
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") check(); });
    }
  }

  // Notification bell: the same messages on every Batzal site (they live at the account site).
  function ago(iso, lg) {
    var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (lg === "he") {
      if (s < 60) return "הרגע";
      if (s < 3600) return "לפני " + Math.round(s / 60) + " דק׳";
      if (s < 86400) return "לפני " + Math.round(s / 3600) + " שע׳";
      return "לפני " + Math.round(s / 86400) + " ימים";
    }
    var f = new Intl.RelativeTimeFormat(lg, { numeric: "auto" });
    if (s < 3600) return f.format(-Math.max(1, Math.round(s / 60)), "minute");
    if (s < 86400) return f.format(-Math.round(s / 3600), "hour");
    return f.format(-Math.round(s / 86400), "day");
  }
  function bellWidget(idp, lg, t) {
    var wrap = make("div", "bz-bellwrap");
    var btn = make("button", "bz-bell");
    btn.type = "button"; btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", t.notifications); btn.title = t.notifications;
    btn.innerHTML = BELL;
    var badge = make("span", "bz-bell-badge"); badge.hidden = true; btn.appendChild(badge);
    var panel = make("div", "bz-notif"); panel.hidden = true;
    var head = make("div", "bz-notif-head");
    head.appendChild(make("strong", "", t.notifications));
    var all = make("button", "bz-notif-all", t.markAll); all.type = "button";
    head.appendChild(all);
    var list = make("div", "bz-notif-list");
    panel.append(head, list);

    function paint(d) {
      badge.hidden = !d.unread;
      badge.textContent = d.unread > 9 ? "9+" : String(d.unread);
      all.hidden = !d.unread;
      list.textContent = "";
      if (!d.items.length) { list.appendChild(make("div", "bz-notif-empty", t.noNotifications)); return; }
      d.items.forEach(function (item) {
        var a = make("a", "bz-notif-item" + (item.read ? "" : " unread"));
        a.href = item.href || "#";
        a.appendChild(make("strong", "", item.title));
        if (item.body) a.appendChild(make("span", "", item.body));
        a.appendChild(make("small", "", ago(item.createdAt, lg)));
        a.addEventListener("click", function () { if (!item.read) markRead([item.id]); });
        list.appendChild(a);
      });
    }
    function load() {
      fetch(idp + "/api/notifications", { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d) paint(d); })
        .catch(function () { /* the bell just stays as it was */ });
    }
    function markRead(ids) {
      fetch(idp + "/api/notifications", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: ids }) })
        .then(load).catch(function () { /* ignore */ });
    }
    all.addEventListener("click", function () { markRead("all"); });
    function set(open) { panel.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false"); if (open) { announce(wrap); load(); } }
    exclusive(wrap, function () { set(false); });
    btn.addEventListener("click", function (e) { e.stopPropagation(); set(panel.hidden); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); });
    window.setInterval(load, 60000);
    load();
    wrap.append(btn, panel);
    return wrap;
  }

  // opts: idp (account site address), signInHref, onLogout(), onPrefs({lang, theme}) after a choice was made
  // (guests keep their choice in this browser; signed-in people save it at the account site).
  window.BatzalAccount = {
    render: function (box, user, opts) {
      opts = opts || {};
      current = user || null;
      box.textContent = "";
      refreshApps();
      I18N.apply();
      var lg = langOf(user);
      var t = TEXT[lg];
      var idp = (opts.idp || "https://account.batzal.net").replace(/\/$/, "");

      if (!user) {
        var wrapIn = make("div", "bz-signin-wrap");
        var btnIn = make("button", "bz-guest-btn");
        btnIn.type = "button"; btnIn.setAttribute("aria-haspopup", "true"); btnIn.setAttribute("aria-expanded", "false"); btnIn.setAttribute("aria-label", t.signIn); btnIn.title = t.signIn;
        btnIn.innerHTML = PERSON;
        var pop = make("div", "bz-pop"); pop.hidden = true;
        var g = make("a", "bz-google"); g.href = opts.signInHref || "/api/sso/start"; g.insertAdjacentHTML("afterbegin", GOOGLE); g.appendChild(document.createTextNode(t.google));
        pop.appendChild(g);
        pop.appendChild(document.createElement("hr"));
        prefRows(pop, t, lg, function (c) {
          if (c.theme) { applyTheme(c.theme); rememberTheme(c.theme); }
          if (c.lang) writeCookie("bz_lang", c.lang);
          try { if (opts.onPrefs) opts.onPrefs(c); } catch (e) { /* the menu must still update */ }
          if (c.lang) window.BatzalAccount.render(box, null, opts);
        });
        var setPop = function (open) { pop.hidden = !open; btnIn.setAttribute("aria-expanded", open ? "true" : "false"); if (open) announce(wrapIn); };
        exclusive(wrapIn, function () { setPop(false); });
        btnIn.addEventListener("click", function (e) { e.stopPropagation(); setPop(pop.hidden); });
        document.addEventListener("click", function (e) { if (!wrapIn.contains(e.target)) setPop(false); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") setPop(false); });
        wrapIn.append(btnIn, pop);
        box.appendChild(wrapIn);
        watchNetwork(idp, function () { return current; }, opts);
        return;
      }

      var wrap = make("div", "bz-acct");
      var rank = RANKS[user.role] || RANKS.user;

      var rw = make("div", "bz-rankwrap");
      var chip = make("button", "bz-rank"); chip.type = "button";
      chip.insertAdjacentHTML("afterbegin", STAR);
      chip.appendChild(make("span", "", rank[lg][0]));
      var tip = make("div", "bz-rank-tip"); tip.setAttribute("role", "tooltip");
      tip.appendChild(make("strong", "", rank[lg][0]));
      tip.appendChild(make("p", "", rank[lg][1]));
      var pips = make("div", "bz-pips");
      for (var i = 1; i <= 4; i++) { var pip = make("i", i <= rank.level ? "on" : ""); pip.style.setProperty("--i", String(i)); pips.appendChild(pip); }
      pips.appendChild(make("span", "", t.level + " " + rank.level + "/4"));
      tip.appendChild(pips);
      rw.append(chip, tip);

      var btn = make("button", "bz-acct-btn");
      btn.type = "button"; btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", user.name);
      if (user.picture) {
        var im = document.createElement("img");
        im.src = user.picture; im.alt = ""; im.referrerPolicy = "no-referrer";
        btn.appendChild(im);
      } else {
        btn.appendChild(make("span", "ini", (user.name || "?").trim().charAt(0).toUpperCase()));
      }
      var menu = make("div", "bz-acct-menu");
      menu.hidden = true; menu.setAttribute("role", "menu");
      var head = make("div", "bz-acct-head");
      var nm = make("strong", "", user.name); nm.setAttribute("dir", "auto"); head.appendChild(nm);
      if (user.email) head.appendChild(make("small", "", user.email));
      menu.appendChild(head);
      var link = make("a", "", t.account); link.href = idp + "/profile"; link.setAttribute("role", "menuitem"); menu.appendChild(link);

      prefRows(menu, t, lg, function (change) {
        var body = {};
        if (change.lang) { body.language = change.lang; writeCookie("bz_lang", change.lang); }
        if (change.theme) { body.theme = change.theme; applyTheme(change.theme); rememberTheme(change.theme); }
        fetch(idp + "/api/preferences", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          .catch(function () { /* the choice still applies on this page */ })
          .then(function () { if (opts.onPrefs) opts.onPrefs(change); });
      });
      menu.appendChild(document.createElement("hr"));
      var out = make("button", "", t.signOut);
      out.type = "button"; out.setAttribute("role", "menuitem");
      out.addEventListener("click", function () { set(false); confirmSignOut(wrap, t, function () {
        // End the browser's session at the account site first; it signs out every Batzal site.
        fetch(idp + "/api/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" })
          .catch(function () { /* still sign out here */ })
          .then(function () { if (opts.onLogout) opts.onLogout(); });
      }); });
      menu.appendChild(out);
      function set(open) { menu.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false"); if (open) announce(wrap); }
    exclusive(wrap, function () { set(false); });
      btn.addEventListener("click", function (e) { e.stopPropagation(); set(menu.hidden); });
      document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) set(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
      wrap.append(bellWidget(idp, lg, t), rw, btn, menu);
      box.appendChild(wrap);

      // Another site may have changed the preferences since this session started: ask the account site and follow it.
      watchNetwork(idp, function () { return current; }, opts);
      fetch(idp + "/api/preferences", { credentials: "include" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
        if (!p) return;
        applyTheme(p.theme); rememberTheme(p.theme);
        if ((p.language === "he" || p.language === "en") && p.language !== lg && opts.onPrefs) opts.onPrefs({ lang: p.language });
      }).catch(function () { /* offline or signed out at the account site: keep the session's values */ });
    },
    applyTheme: applyTheme,
  };
  // Session theme (from /api/me) before the first render; null means "follow the system".
  window.BatzalTheme = function (theme) { applyTheme(theme); rememberTheme(theme); };
  // Dialogs: a click on the dim area around the window closes it, and an X button (class dlg-x) does the same.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.tagName === "DIALOG" && t.open) { t.close(); return; }
    var x = t && t.closest ? t.closest(".dlg-x") : null;
    if (x) { var d = x.closest("dialog"); if (d) d.close(); }
  });
})();
