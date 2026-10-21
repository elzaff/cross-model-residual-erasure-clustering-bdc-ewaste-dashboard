// E-Rase (powered by CMRE): the working app.
// Photos go to the Modal backend (code/product/modal_pilah.py) for placement; sessions, items and photos stay on this
// device (IndexedDB). Officer confirmations and corrections are also sent to the backend for later evaluation.
// Two kinds of session share one model: setoran (one depositor, phone, gets a receipt) and batch (many photos, manifest).
(() => {
  "use strict";
  const API = new URLSearchParams(location.search).get("api") || "https://yaraxoaraal--cmre-pilah-pilah-web.us-east.modal.run";
  const E = window.EWASTE, C = E.clusters;
  const CAT = { baterai: "Baterai", layar: "Layar dan monitor", besar: "Peralatan besar", kecil: "Peralatan kecil", ti: "TI dan telekomunikasi", komponen: "Komponen dan PCB" };
  const CHUNK = 8, SIDE = 768;
  const $ = s => document.querySelector(s), main = $("#main"), dlg = $("#dlg");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");
  const ico = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const day = t => new Date(t).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const clock = t => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const short = t => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ", " + clock(t);
  const today = t => new Date(t).toDateString() === new Date().toDateString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const coarse = matchMedia("(pointer: coarse)").matches;

  // ================= storage: IndexedDB, mirrored in memory =================
  const S = new Map(), I = new Map(), urls = new Map();
  const dbp = new Promise((res, rej) => {
    const r = indexedDB.open("cmre-pilah", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("sessions", { keyPath: "id" }); r.result.createObjectStore("items", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (store, mode, fn) => dbp.then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode), q = fn(t.objectStore(store));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  const save = (store, v) => tx(store, "readwrite", s => s.put(v)).catch(e => toast("Gagal menyimpan: " + e.message));
  const drop = (store, k) => tx(store, "readwrite", s => s.delete(k));
  const putS = s => { S.set(s.id, s); return save("sessions", s); };
  const putI = it => { I.set(it.id, it); return save("items", it); };
  const imgURL = it => it.src || urls.get(it.id) || (it.img ? urls.set(it.id, URL.createObjectURL(it.img)).get(it.id) : "");
  const itemsOf = sid => [...I.values()].filter(i => i.sid === sid).sort((a, b) => a.t - b.t);
  const unit = () => { try { return JSON.parse(localStorage.getItem("cmre-unit")) || {}; } catch { return {}; } };
  // new kinds found by the officer through "Jenis baru" (stored on this device)
  const types = () => { try { return JSON.parse(localStorage.getItem("erase-types")) || []; } catch { return []; } };
  const saveTypes = t => { try { localStorage.setItem("erase-types", JSON.stringify(t)); } catch {} };
  const typeOf = id => types().find(t => t.id === id);

  // ================= domain: which bin an item goes to =================
  const isRes = it => it.state === "hasil";
  const cl = it => C[typeof it.corr === "number" ? it.corr : it.res.cluster];
  const held = it => isRes(it) && it.res.ood && !it.conf;
  function route(it) {
    if (!isRes(it)) return null;
    if (it.corr === "bukan") return { key: "bukan", label: "Bukan e-waste", cls: "lain", b3: false };
    if (it.corr === "lain") return { key: "lain", label: "Cek manual", cls: "lain", b3: false };
    if (it.corr === "baru") { const t = typeOf(it.newType) || { name: "Jenis baru", b3: false };
      return { key: "baru-" + it.newType, label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "", b3: t.b3 }; }
    if (held(it)) return { key: "tahan", label: "Ditahan", cls: "tahan", b3: false };
    const c = cl(it);
    return { key: c.cat + (c.b3 ? "-b3" : ""), label: (c.b3 ? "B3 · " : "Non-B3 · ") + CAT[c.cat], cls: c.b3 ? "b3" : "", b3: c.b3 };
  }
  const clusterRoute = c => ({ label: (c.b3 ? "B3 · " : "Non-B3 · ") + CAT[c.cat], cls: c.b3 ? "b3" : "" });
  const tag = (r, lg) => `<span class="tag ${r.cls}${lg ? " lg" : ""}">${esc(r.label)}</span>`;
  function status(it) {
    if (it.state === "proses") return ["", "memproses"];
    if (it.state === "gagal") return ["err", "gagal diproses"];
    if (it.conf === "benar") return ["ok", "dicek petugas"];
    if (it.conf === "koreksi") return ["ok", "dikoreksi petugas"];
    if (it.res.ood) return ["cek", "perlu dicek"];
    return ["", "belum dicek"];
  }
  const kindName = it => !isRes(it) ? "" : it.corr === "bukan" ? "Bukan e-waste" : it.corr === "lain" ? "Jenis lain"
    : it.corr === "baru" ? (typeOf(it.newType) || { name: "Jenis baru" }).name : cl(it).name;
  const qty = it => Math.max(1, it.qty || 1);
  const sName = s => s.label || `Pemilahan ${short(s.created)}`;
  const kindOfSession = s => s.type === "batch" ? "batch" : s.type === "uji" ? "uji metode" : "setoran";
  // held items from real work sessions that still carry their CMRE embedding can be regrouped into new kinds
  const pool = () => [...I.values()].filter(i => isRes(i) && i.res.z && !S.get(i.sid)?.demo && S.get(i.sid)?.type !== "uji"
    && (held(i) || i.corr === "lain")).sort((a, b) => a.t - b.t);
  function tally(list) {
    const res = list.filter(isRes);
    return { n: res.reduce((s, i) => s + qty(i), 0), b3: res.filter(i => route(i).b3).reduce((s, i) => s + qty(i), 0),
      held: res.filter(held).length, open: res.filter(i => !i.conf).length, run: list.filter(i => i.state === "proses").length,
      fail: list.filter(i => i.state === "gagal").length, kg: res.reduce((s, i) => s + (Number(i.kg) || 0), 0) };
  }
  function byRoute(list) {
    const g = new Map();
    list.filter(isRes).forEach(i => { const r = route(i), e = g.get(r.key) || { ...r, n: 0, kg: 0, kinds: new Set() };
      e.n += qty(i); e.kg += Number(i.kg) || 0; e.kinds.add(kindName(i)); g.set(r.key, e); });
    return [...g.values()].sort((a, b) => b.b3 - a.b3 || b.n - a.n);
  }
  const sumLine = t => `<p class="sum"><span><b>${t.n}</b>barang</span><span><b>${t.b3}</b>jalur B3</span>${t.held ? `<span class="warn"><b>${t.held}</b>ditahan</span>` : ""}<span><b>${t.open}</b>belum dicek</span></p>`;

  // ================= backend =================
  let online = false, pinging = null;
  function srv(cls, text) { document.querySelectorAll("[data-srv]").forEach(e => { e.className = "srv " + cls; e.lastElementChild.textContent = text; }); }
  function ping() {
    if (pinging) return pinging;
    srv("wait", "Server AI menyala…");
    pinging = fetch(API + "/health", { signal: AbortSignal.timeout(150000) }).then(r => r.ok).catch(() => false)
      .then(ok => { online = ok; pinging = null; srv(ok ? "on" : "off", ok ? "Server AI siap" : "Server AI tidak terhubung"); return ok; });
    return pinging;
  }
  function feedback(it) {
    if (S.get(it.sid).demo || !online || !it.conf) return;
    fetch(API + "/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predicted: it.res.cluster, verdict: it.conf, corrected: it.conf === "koreksi" ? kindName(it) : "", score: it.res.score }) }).catch(() => {});
  }

  // ---- photos: EXIF rotation applied, longest side 768 px (the pipeline drafts to 768 before resizing)
  async function prep(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, SIDE / Math.max(bmp.width, bmp.height));
    const cv = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(res => cv.toBlob(res, "image/jpeg", 0.9));
  }

  const queue = [];
  let pumping = false;
  async function addFiles(sid, files, meta) {  // meta: optional [{ lab, source }] aligned with files (Uji metode)
    const keep = [...files].map((f, k) => [f, meta ? meta[k] : {}]).filter(([f]) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!keep.length) return;
    let bad = 0;
    for (const [f, m] of keep) {
      let img;
      try { img = await prep(f); } catch { bad++; continue; }
      const it = { id: uid(), sid, name: f.name, t: Date.now(), img, state: "proses", conf: "", corr: null, qty: 1, kg: null, ...m };
      await putI(it); queue.push(it.id);
    }
    if (bad) toast(`${bad} file tidak terbaca sebagai gambar.`);
    render(); pump();
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      if (!online && !(await ping())) {
        queue.splice(0).forEach(id => { const it = I.get(id); if (it) { it.state = "gagal"; putI(it); } });
        toast("Server AI tidak terhubung. Foto tetap tersimpan; tekan Proses ulang nanti.");
        break;
      }
      const part = queue.splice(0, CHUNK).map(id => I.get(id)).filter(Boolean);
      const fd = new FormData();
      part.forEach(it => fd.append("files", it.img, it.name.replace(/\.\w+$/, "") + ".jpg"));
      try {
        const r = await fetch(API + "/predict", { method: "POST", body: fd, signal: AbortSignal.timeout(240000) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || r.statusText);
        part.forEach((it, k) => { const { name, ...res } = j.results[k]; it.res = res; it.state = "hasil"; putI(it); });
      } catch (e) {
        part.forEach(it => { it.state = "gagal"; putI(it); });
        toast("Sebagian foto gagal diproses: " + e.message);
      }
      render();
    }
    pumping = false;
  }
  function retry(sid) {
    itemsOf(sid).filter(i => i.state === "gagal" && i.img).forEach(i => { i.state = "proses"; putI(i); queue.push(i.id); });
    render(); pump();
  }
  function makeSession(type, label = "", place = "") {
    const n = [...S.values()].filter(x => x.type === type && !x.demo).length + 1;
    const s = { id: uid(), no: ({ batch: "B-", uji: "U-" }[type] || "S-") + String(n).padStart(3, "0"), type, label, place, created: Date.now(), done: false };
    putS(s);
    return s;
  }
  function setConf(it, conf, corr = null) { it.conf = conf; it.corr = conf === "koreksi" ? corr : null; putI(it); feedback(it); }
  const corrOptions = sel => `<option value="">Koreksi jenis…</option>${C.map(c => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
    <option value="bukan" ${sel === "bukan" ? "selected" : ""}>Bukan e-waste</option><option value="lain" ${sel === "lain" ? "selected" : ""}>Jenis lain, tidak ada di daftar</option>`;
  const parseCorr = v => v === "bukan" || v === "lain" ? v : Number(v);

  // ================= router =================
  let view = {}, filter = "semua";
  const picked = new Set();
  function render() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    const nav = { riwayat: "riwayat", jenis: "jenis", baru: "baru", "cara-kerja": "cara", uji: "cara", "": "home" }[h[0]] || "";
    document.querySelectorAll("[data-nav]").forEach(a => a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    if (h[0] === "s" && S.has(h[1])) {
      const s = S.get(h[1]);
      if (view.sid !== h[1]) { filter = "semua"; picked.clear(); }
      view = { sid: h[1] };
      return s.type === "uji" ? ujiView(s) : h[2] === "dokumen" ? docView(s) : workspace(s);
    }
    view = {};
    return ({ riwayat: history, jenis: jenis, baru: jenisBaru, uji: ujiSetup, "cara-kerja": caraKerja }[h[0]] || home)();
  }

  // ================= views =================
  function row(it, ws) {
    const [k, txt] = status(it), r = route(it), s = S.get(it.sid);
    const pick = ws && s.type === "batch" && !s.done && isRes(it) && !it.conf && !it.res.ood;
    return `<div class="irow${picked.has(it.id) ? " sel" : ""}">
      <span class="ck">${pick ? `<input type="checkbox" data-pick="${it.id}" ${picked.has(it.id) ? "checked" : ""} aria-label="Pilih ${esc(it.name)}">` : ""}</span>
      <img src="${imgURL(it)}" alt="" loading="lazy" data-open="${it.id}">
      <div class="tx" data-open="${it.id}">${r ? tag(r) : `<span class="tt">${it.state === "proses" ? "Memproses…" : "Belum diproses"}</span>`}
        <span class="sub">${isRes(it) ? esc(kindName(it)) + " · " : ""}${it.lab ? "label " + esc(it.lab) + (it.source ? " (" + esc(it.source) + ")" : "") + " · " : ""}${esc(it.name)}${qty(it) > 1 ? " · " + qty(it) + " buah" : ""}${it.kg ? " · " + fmt(it.kg, 1) + " kg" : ""}</span></div>
      <span class="st ${k}">${it.state === "proses" ? '<span class="spin" role="img" aria-label="memproses"></span>' : it.conf || it.state === "gagal" ? txt : ""}</span>
      <span class="ra">${isRes(it) && !it.conf && !it.res.ood && !s.done ? `<button class="iconbtn" type="button" data-conf="${it.id}" aria-label="Benar: ${esc(it.name)}">${ico("check")}</button>` : ""}</span></div>`;
  }
  function srow(s) {
    const t = tally(itemsOf(s.id));
    return `<a class="srow" href="#/s/${s.id}"><span style="min-width:0"><span class="nm" style="display:block"><span class="dot${s.done ? " done" : ""}" aria-hidden="true"></span>${esc(sName(s))}</span>
      <span class="meta">${esc(s.no)} · ${kindOfSession(s)} · ${today(s.created) ? "hari ini " + clock(s.created) : short(s.created)}${s.done ? " · selesai" : ""}</span></span>
      <span class="r"><span><b>${t.n}</b> barang</span>${t.b3 ? `<span><b>${t.b3}</b> B3</span>` : ""}${t.held ? `<span><b>${t.held}</b> ditahan</span>` : ""}</span></a>`;
  }

  function home() {
    const ss = [...S.values()].sort((a, b) => b.created - a.created), u = unit();
    const todayItems = [...I.values()].filter(i => today(i.t) && i.state !== "gagal").sort((a, b) => b.t - a.t);
    const demo = ss.find(s => s.demo);
    main.innerHTML = `<div class="page">
      <section class="scan">
        <div class="capture" data-drop="home">
          <span class="eyebrow"><i></i>Ditenagai CMRE · 16 jenis e-waste</span>
          <h1>Foto barangnya.<br><span>E-Rase menunjukkan wadahnya.</span></h1>
          <p>Satu barang per foto. Pilih banyak foto sekaligus kalau barangnya banyak.</p>
          <div class="row"><button class="btn pri big" type="button" data-act="quick-cam">${ico("cam")}Ambil foto</button><button class="btn big" type="button" data-act="quick-files">${ico("img")}Pilih dari galeri</button></div>
          ${coarse ? "" : `<p class="small">Atau tarik foto ke kotak ini.</p>`}
        </div>
        <div class="links">
          <span class="srv wait" data-srv><i></i><span>Server AI menyala…</span></span>
          <button type="button" data-new="setoran">Catat setoran warga<span>Isi nama penyetor, lalu cetak tanda terima.</span></button>
          <a href="#/baru">Jenis baru${pool().length ? ` · ${pool().length} barang ditahan` : ""}<span>Kelompokkan barang yang belum dikenal, lalu beri nama.</span></a>
          <a href="#/uji">Uji metode dengan foldermu<span>Bandingkan hasil dengan dan tanpa CMRE pada fotomu sendiri.</span></a>
          <button type="button" data-act="demo">${demo ? "Buka sesi contoh" : "Coba 12 foto contoh"}<span>Hasil pipeline yang sudah dihitung, tanpa server.</span></button>
          <button type="button" data-act="unit">${esc(u.unit || "Atur nama unit")}<span>${u.officer ? "Petugas " + esc(u.officer) : "Nama unit dan petugas tercetak di tanda terima."}</span></button>
        </div>
      </section>
      <section class="section"><div class="sechead"><h2>Hari ini</h2>${todayItems.length ? `<a href="#/riwayat">Riwayat</a>` : ""}</div>
        ${todayItems.length ? sumLine(tally(todayItems)) + `<div class="list">${todayItems.slice(0, 8).map(i => row(i)).join("")}</div>`
          : `<p class="empty">Belum ada barang hari ini. Foto barang pertama untuk mulai.</p>`}</section>
      ${ss.length ? `<section class="section"><div class="sechead"><h2>Sesi terakhir</h2></div><div class="rows">${ss.slice(0, 5).map(srow).join("")}</div></section>` : ""}
    </div>`;
    if (!online && !pinging) srv("off", "Server AI tidak terhubung"); else if (online) srv("on", "Server AI siap");
  }

  function history() {
    const ss = [...S.values()].sort((a, b) => b.created - a.created), all = ss.flatMap(s => itemsOf(s.id)), g = byRoute(all), max = Math.max(1, ...g.map(r => r.n));
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Riwayat</h1><p class="meta">${ss.length} sesi tersimpan di perangkat ini.</p></div>
        <div class="acts"><button class="btn" type="button" data-act="csv-all" ${all.length ? "" : "disabled"}>${ico("doc")}Unduh semua (CSV)</button></div></div>
      ${all.length ? sumLine(tally(all)) : ""}
      ${g.length ? `<section><div class="sechead"><h2>Per wadah</h2></div><div class="bars">${g.map(r => `<div class="bar-r">${tag(r)}<span class="tr"><i class="${r.cls}" style="width:${100 * r.n / max}%"></i></span><span class="n">${r.n}</span></div>`).join("")}</div></section>` : ""}
      <section class="section"><div class="sechead"><h2>Semua sesi</h2></div>${ss.length ? `<div class="rows">${ss.map(srow).join("")}</div>` : '<p class="empty">Belum ada sesi.</p>'}</section></div>`;
  }

  function workspace(s) {
    const its = itemsOf(s.id), t = tally(its), g = byRoute(its), batch = s.type === "batch";
    const inF = (i, f) => f === "semua" || (f === "tahan" ? held(i) : f === "belum" ? isRes(i) && !i.conf : f === "b3" ? isRes(i) && route(i).b3
      : f === "gagal" ? i.state === "gagal" : isRes(i) && "r:" + route(i).key === f);
    const F = [["semua", "Semua"], ["tahan", "Ditahan"], ["belum", "Belum dicek"], ["b3", "Jalur B3"]];
    if (t.fail) F.push(["gagal", "Gagal diproses"]);
    const RF = g.filter(r => r.key !== "tahan").map(r => ["r:" + r.key, r.label]);
    if (![...F, ...RF].some(f => f[0] === filter)) filter = "semua";
    const shown = its.filter(i => inF(i, filter)).reverse();
    const last = !batch && !s.done && [...its].reverse().find(i => isRes(i) && !i.conf);
    const fbtn = ([k, l]) => `<button type="button" data-filter="${esc(k)}" aria-pressed="${filter === k}"><span>${esc(l)}</span><span class="num">${its.filter(i => inF(i, k)).length}</span></button>`;
    const open = shown.filter(i => isRes(i) && !i.conf && !i.res.ood);
    const adding = s.done || s.demo ? "" : batch
      ? `<div class="drop" data-drop="${s.id}">${ico("img")}<span>Tarik foto ke sini. Kami memproses ${CHUNK} foto sekali kirim.</span><span class="btns"><button class="btn pri sm" type="button" data-act="files">Tambah foto</button>${coarse ? `<button class="btn sm" type="button" data-act="cam">Kamera</button>` : ""}</span></div>`
      : `<div class="add"><button class="btn pri big" type="button" data-act="cam">${ico("cam")}Foto barang</button><button class="btn big" type="button" data-act="files">${ico("img")}Dari galeri</button></div>`;
    main.innerHTML = `<div class="page">
      <div class="head">
        <a class="iconbtn" href="#/" aria-label="Kembali">${ico("back")}</a>
        <div class="t"><h1>${esc(sName(s))}</h1>
          <p class="meta">${esc(s.no)} · ${batch ? "batch" : "setoran"} · ${day(s.created)}, ${clock(s.created)}${s.place ? " · " + esc(s.place) : ""}${s.demo ? " · sesi contoh" : ""}</p></div>
        <div class="acts"><a class="btn" href="#/s/${s.id}/dokumen">${ico("doc")}${batch ? "Manifest" : "Tanda terima"}</a>
          <button class="btn${s.done ? "" : " pri"}" type="button" data-act="${s.done ? "reopen" : "finish"}">${s.done ? "Buka lagi" : "Selesai"}</button></div>
      </div>
      ${its.length ? sumLine(t) : ""}
      <div class="ws">
        <div class="filters" role="group" aria-label="Saring barang">${F.map(fbtn).join("")}${RF.length ? '<div class="cap">Per wadah</div>' + RF.map(fbtn).join("") : ""}</div>
        <div>
          ${adding}
          ${t.run ? `<p class="note"><span class="spin"></span>Memproses ${t.run} foto…</p>` : ""}
          ${t.fail ? `<p class="note">${t.fail} foto belum diproses. <button class="btn sm" type="button" data-act="retry">Proses ulang</button></p>` : ""}
          ${last ? latest(last) : ""}
          ${batch && !s.done && open.length ? `<div class="bulk"><label><input type="checkbox" data-act="pickall" ${open.every(i => picked.has(i.id)) ? "checked" : ""}>Pilih ${open.length} hasil yang belum dicek</label>
            <button class="btn sm" type="button" data-act="bulk" ${picked.size ? "" : "disabled"}>${ico("check")}Benarkan ${picked.size || ""}</button></div>` : ""}
          ${shown.length ? `<div class="list">${shown.map(i => row(i, true)).join("")}</div>`
            : `<p class="empty">${its.length ? "Tidak ada barang di saringan ini." : batch ? "Batch ini belum berisi foto." : "Foto barang pertama dari penyetor ini."}</p>`}
        </div>
      </div></div>`;
  }

  function latest(it) {
    const r = route(it), h = held(it);
    return `<div class="latest" aria-live="polite"><img src="${imgURL(it)}" alt="">
      <div style="min-width:0"><div class="to">${h ? "Jangan masukkan dulu" : "Masukkan ke wadah"}</div>${tag(r, true)}
        <div class="kind">${esc(kindName(it))}${h ? " (paling mirip)" : ""}</div>
        <p>${h ? "Barang ini jauh dari semua foto yang dikenal sistem. Periksa dulu." : esc(cl(it).handling)}</p>
        <div class="acts"><button class="btn ok sm" type="button" data-conf="${it.id}">${ico("check")}${h ? "Ya, jenisnya ini" : "Benar"}</button><button class="btn sm" type="button" data-open="${it.id}">${h ? "Periksa" : "Ubah"}</button></div></div></div>`;
  }

  function detail(it) {
    const s = S.get(it.sid), r = route(it), h = held(it);
    let body = `<p class="muted">${it.state === "proses" ? "Server AI sedang memproses foto ini." : "Foto ini belum diproses. Tutup, lalu tekan Proses ulang."}</p>`;
    if (isRes(it)) {
      const R = it.res, top = Math.max(R.threshold * 1.5, R.score * 1.1), maxD = Math.max(...R.centres.map(x => x[1]));
      const same = R.nbCluster.filter(x => x === R.cluster).length;
      body = `<div><div class="k">${h ? "Jangan masukkan dulu" : "Masukkan ke wadah"}</div>${tag(r, true)}</div>
        <div><div class="k">${h ? "Paling mirip" : it.conf === "koreksi" ? "Dikoreksi petugas" : "Jenis"}</div><div class="g">${esc(kindName(it))}</div>
          <p class="hand">${h ? "Barang ini jauh dari semua foto yang dikenal sistem. Konfirmasi jenisnya atau koreksi." : typeof it.corr === "string" ? "Catat jenisnya secara manual." : esc(cl(it).handling)}</p></div>
        ${s.done ? "" : `<div class="confirm"><button class="btn ok" type="button" data-dconf>${ico("check")}${h ? "Ya, jenisnya ini" : "Benar"}</button>
          <select data-dcorr aria-label="Koreksi jenis barang">${corrOptions(it.conf === "koreksi" ? it.corr : null)}</select></div>
        <div class="fields"><label class="f">Jumlah<input type="number" min="1" step="1" value="${qty(it)}" data-dqty></label><label class="f">Berat (kg)<input type="number" min="0" step="0.1" value="${it.kg ?? ""}" data-dkg placeholder="opsional"></label></div>`}
        <details class="why"><summary>Kenapa? ${same} dari 5 foto termirip berjenis sama</summary>
          <div class="ev"><h3>Foto BDC yang paling mirip</h3><p class="h">Angka di bawah foto: cosine similarity, 1 berarti identik. Bingkai ungu: jenis yang sama.</p>
            <div class="nbg">${R.nb.map((id, k) => `<figure><img src="assets/t/${id}.webp" alt="" loading="lazy" class="${R.nbCluster[k] === R.cluster ? "same" : ""}" onerror="this.style.visibility='hidden'"><figcaption>${fmt(R.nbSim[k])}</figcaption></figure>`).join("")}</div></div>
          <div class="ev"><h3>Centroid terdekat</h3><p class="h">Sistem memilih jenis dengan jarak terpendek.</p>
            ${R.centres.map(([k, d], j) => `<div class="cb${j ? "" : " win"}"><span class="t">${esc(C[k].name.replace(/ \(.*\)/, ""))}</span><span class="tr"><i style="width:${Math.max(6, 100 * d / maxD)}%"></i></span><span class="n">${fmt(d)}</span></div>`).join("")}</div>
          <div class="ev"><h3>Dikenal atau asing?</h3>
            <div class="gauge" style="--thr:${100 * R.threshold / top}%"><span class="th" style="left:${100 * R.threshold / top}%">batas ${fmt(R.threshold)}</span><span class="mk" style="left:${Math.min(99, 100 * R.score / top)}%"></span></div>
            <div class="gl"><span>dikenal</span><span>foto ini ${fmt(R.score)}</span><span>asing</span></div></div>
        </details>`;
    }
    dlg.innerHTML = `<div class="dlg"><div class="top"><h2 id="dlgTitle">${esc(it.name)}</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <div class="det"><img class="ph" src="${imgURL(it)}" alt="Foto ${esc(it.name)}"><div class="col">${body}</div></div>
      <div class="acts">${s.done ? "" : '<button class="btn danger" type="button" data-ddel>Hapus</button>'}<button class="btn pri" type="button" data-close>Tutup</button></div></div>`;
    const q = sel => dlg.querySelector(sel);
    q("[data-dconf]")?.addEventListener("click", () => { setConf(it, "benar"); dlg.close(); render(); toast("Tersimpan."); });
    q("[data-dcorr]")?.addEventListener("change", e => { if (!e.target.value) return; setConf(it, "koreksi", parseCorr(e.target.value)); detail(it); render(); });
    q("[data-dqty]")?.addEventListener("change", e => { it.qty = Math.max(1, Math.round(+e.target.value || 1)); putI(it); render(); });
    q("[data-dkg]")?.addEventListener("change", e => { it.kg = e.target.value === "" ? null : Math.max(0, +e.target.value); putI(it); render(); });
    q("[data-ddel]")?.addEventListener("click", () => { I.delete(it.id); drop("items", it.id); dlg.close(); render(); toast("Barang dihapus."); });
    if (!dlg.open) dlg.showModal();
  }

  function docView(s) {
    const its = itemsOf(s.id).filter(isRes), g = byRoute(its), t = tally(its), u = unit(), batch = s.type === "batch";
    main.innerHTML = `<div class="page">
      <div class="head noprint"><a class="iconbtn" href="#/s/${s.id}" aria-label="Kembali ke sesi">${ico("back")}</a><div class="t"><h1>${batch ? "Manifest" : "Tanda terima"}</h1></div>
        <div class="acts"><button class="btn" type="button" data-act="csv">Unduh CSV</button><button class="btn pri" type="button" data-act="print">${ico("doc")}Cetak atau simpan PDF</button></div></div>
      <article class="doc">
        <div class="dh"><div><h1>${batch ? "Manifest Pemilahan E-Waste" : "Tanda Terima Setoran E-Waste"}</h1><p class="muted small" style="margin:4px 0 0">${esc(u.unit || "Nama unit belum diatur")}${u.officer ? " · petugas " + esc(u.officer) : ""}</p></div>
          <div class="small" style="text-align:right"><b>No. ${esc(s.no)}</b><br>${day(s.created)}, ${clock(s.created)}<br>${batch ? "Batch" : "Penyetor"}: ${esc(s.label || "-")}${s.place ? "<br>" + esc(s.place) : ""}</div></div>
        <h2>Rekap per wadah</h2>
        <div class="tw"><table><thead><tr><th>Wadah</th><th>Jenis</th><th class="n">Jumlah</th><th class="n">Berat (kg)</th></tr></thead><tbody>
          ${g.map(r => `<tr><td>${tag(r)}</td><td>${esc([...r.kinds].join(", "))}</td><td class="n">${r.n}</td><td class="n">${r.kg ? fmt(r.kg, 1) : "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">Belum ada barang.</td></tr>'}
          <tr class="tot"><td colspan="2">Total</td><td class="n">${t.n}</td><td class="n">${t.kg ? fmt(t.kg, 1) : "-"}</td></tr></tbody></table></div>
        <h2>Rincian barang</h2>
        <div class="tw"><table><thead><tr><th class="n">#</th><th>Foto</th><th>Jenis</th><th>Wadah</th><th class="n">Jml</th><th>Status</th></tr></thead><tbody>
          ${its.map((i, k) => `<tr><td class="n">${k + 1}</td><td>${esc(i.name)}</td><td>${esc(kindName(i))}</td><td>${esc(route(i).label)}</td><td class="n">${qty(i)}</td><td>${status(i)[1]}</td></tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin-top:14px">${t.held ? `${t.held} barang ditahan karena sistem belum mengenalnya dan petugas belum memeriksanya. ` : ""}${t.open ? `${t.open} barang belum dicek petugas. ` : ""}Barang jalur B3 diserahkan ke pengelola limbah B3 berizin. Dibuat dengan E-Rase (prototipe, ditenagai CMRE); sistem menentukan jenis, petugas memastikannya.</p>
        ${batch ? "" : '<div class="sign"><div>Penyetor</div><div>Petugas</div></div>'}
      </article></div>`;
  }

  // ================= Panduan jenis: the 16 clusters grouped by bin =================
  const gallery = c => `assets/c${String(c.id).padStart(2, "0")}.jpg`;
  function jenis() {
    const kd = E.scen.kdist, k16 = E.scen.k17.find(k => k.k === 16), k17 = E.scen.k17.find(k => k.k === 17);
    const top = kd.reduce((a, b) => b.n > a.n ? b : a), n16 = (kd.find(d => d.k === 16) || { n: 0 }).n, total = kd.reduce((s, d) => s + d.n, 0);
    const jrow = c => `<button class="jrow" type="button" data-jenis="${c.id}"><img src="${gallery(c)}" alt="" loading="lazy">
      <span style="min-width:0"><span class="jt">${esc(c.name)}${c.id === 15 ? " · masih campuran" : ""}</span><span class="jh" style="display:block">${esc(c.handling)}</span></span>
      <span class="jn">${tag(clusterRoute(c))}<br><span>${c.n} foto</span></span></button>`;
    const group = (title, list) => `<section class="jgroup"><div class="sechead"><h2>${title}</h2><span class="muted small">${list.length} jenis</span></div>${list.map(jrow).join("")}</section>`;
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Panduan jenis</h1><p class="meta">E-Rase mengenali 16 jenis. Sistem menemukan pengelompokan ini sendiri dari 3.792 foto tanpa label; kami memberi nama sesudahnya.</p></div></div>
      ${group("Wadah B3", C.filter(c => c.b3))}${group("Wadah non-B3", C.filter(c => !c.b3))}
      <section class="jgroup"><div class="sechead"><h2>Jenis baru di perangkat ini</h2><a href="#/baru">Kelompokkan barang ditahan</a></div>
        ${types().length ? `<div class="rows">${types().map(t => `<div class="srow"><span>${tag({ label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "" })}</span>
          <span class="r">${[...I.values()].filter(i => i.newType === t.id).length} barang · ditemukan ${short(t.created)}</span></div>`).join("")}</div>`
          : `<p class="empty">Belum ada. Barang yang tidak cocok dengan 16 jenis ditahan, lalu bisa dikelompokkan menjadi jenis baru.</p>`}</section>
      <details class="k17"><summary>Kenapa 16 jenis, bukan 17?</summary><ol>
        <li>Dari ${total} iterasi SCMax, 17 paling sering terpilih (${top.n} kali) dan 16 kedua (${n16} kali).</li>
        <li>Dengan 16, pembagian identik di 100 percobaan (ARI ${fmt(k16.ari)}). Dengan 17, ARI turun ke ${fmt(k17.ari)}.</li>
        <li>Sembilan percobaan awal juga memberi median 16 (${E.robust.scmax.join(", ")}).</li>
        <li>Jenis ke-17 memisahkan foto tumpukan menurut latarnya. Karena itu PCB dan tumpukan tetap satu jenis, dan petugas memilah tumpukan secara manual.</li></ol></details></div>`;
  }
  function jenisDialog(c) {
    dlg.innerHTML = `<div class="dlg"><div class="top"><h2 id="dlgTitle">${esc(c.name)}</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <img class="jgal" src="${gallery(c)}" alt="Contoh foto ${esc(c.name)}">
      <div>${tag(clusterRoute(c), true)}<p style="margin-top:10px">${esc(c.handling)}</p></div>
      ${c.id === 15 ? '<p class="small"><b>Masih campuran.</b> Jenis ini memuat PCB dan tumpukan e-waste. Petugas memilah foto tumpukan secara manual.</p>' : ""}
      <p class="facts"><span><b>${c.n}</b> foto di data BDC</span><span>stabilitas <b>${fmt(c.jaccard)}</b> (Jaccard, stabil jika 0,85 ke atas)</span><span><b>${Math.round(100 * c.top_share)}%</b> foto berlabel berjenis sama</span></p>
      <div class="acts"><button class="btn pri" type="button" data-close>Tutup</button></div></div>`;
    dlg.showModal();
  }

  // ================= Cara kerja: problem, the CMRE animation (from riset.html), evidence =================
  function caraKerja() {
    const ds = E.datasets;
    main.innerHTML = `<div class="page article">
      <div class="head"><div class="t"><h1>Cara kerja</h1></div></div>
      <p class="lead">Model AI umum ikut membaca latar foto. Mouse di katalog berlatar putih dan mouse yang difoto di lapangan bisa ia anggap dua barang berbeda, lalu keduanya masuk wadah berbeda. CMRE (<i>Cross-Model Residual Erasure</i>) membuang jejak latar itu sebelum E-Rase memilah.</p>
      <section class="section"><div class="sechead"><h2>CMRE dalam 8 langkah</h2></div>
        <iframe class="cmref" src="riset.html?embed&v=11#cara-kerja" title="Animasi cara kerja CMRE"></iframe></section>
      <section class="section"><div class="sechead"><h2>Empat tahap untuk tiap foto</h2></div><ol class="pipe">
        <li><i>1</i><b>Lihat</b><span>SigLIP2, PE-Core, dan DINOv3 membaca foto tanpa dilatih ulang.</span></li>
        <li><i>2</i><b>Bersihkan</b><span>DINOv3 menebak; sisa yang tak tertebak berisi jejak latar, dan CMRE menghapusnya.</span></li>
        <li><i>3</i><b>Kelompokkan</b><span>SCMax memilih 16 jenis tanpa label; tiap foto masuk centroid terdekat.</span></li>
        <li><i>4</i><b>Jaga</b><span>Foto yang jauh dari semua foto dikenal ditahan untuk petugas.</span></li></ol></section>
      <section class="section"><div class="sechead"><h2>Hasil pengujian</h2></div><div class="tw"><table class="mini">
        <thead><tr><th>Yang diukur</th><th class="n">Tanpa CMRE</th><th class="n">Dengan CMRE</th></tr></thead><tbody>
        <tr><td>Foto barang sejenis dari sumber berbeda yang masuk jenis sama (BDC)</td><td class="n">0,524</td><td class="n big">0,975</td></tr>
        <tr><td>Sama, pada data yang belum pernah dilihat (Shubha)</td><td class="n">0,356</td><td class="n big">0,956</td></tr>
        <tr><td>Jejak sumber foto yang tersisa (makin kecil makin baik)</td><td class="n">0,103</td><td class="n big">0,016</td></tr>
        <tr><td>Percobaan yang memberi pembagian identik</td><td class="n">-</td><td class="n big">100 / 100</td></tr>
        <tr><td>Ketepatan alarm barang asing (AUROC)</td><td class="n">-</td><td class="n big">0,952</td></tr></tbody></table></div>
        <p class="small muted">Sumber: karya ilmiah tim untuk BDC Satria Data 2026.</p></section>
      <section class="section"><div class="sechead"><h2>Buktikan sendiri</h2></div>
        <p>Siapkan folder foto berlabel dari dua sumber berbeda. E-Rase menghitung berapa foto sejenis yang masuk jenis yang sama, dengan dan tanpa CMRE.</p>
        <a class="btn pri" href="#/uji">Uji metode dengan foldermu</a></section>
      <section class="section"><div class="sechead"><h2>Data</h2></div><div class="tw"><table class="mini"><thead><tr><th>Dataset</th><th>Peran</th><th class="n">Foto</th></tr></thead><tbody>
        ${ds.map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.role)}</td><td class="n">${d.n.toLocaleString("id-ID")}</td></tr>`).join("")}</tbody></table></div>
        <p class="small muted">Label hanya dipakai untuk menilai hasil, tidak untuk membentuk jenis.</p></section>
      <p class="section small"><a href="riset.html">Lampiran teknis: data, pembanding, uji ketahanan, dan lisensi sumber</a></p></div>`;
  }
  addEventListener("message", e => {
    if (e.origin !== location.origin || !e.data || !e.data.eraseH) return;
    const f = main.querySelector(".cmref"); if (f) f.style.height = Math.ceil(e.data.eraseH) + "px";
  });

  // ================= Jenis baru: regroup held items into candidate new kinds (clustering, no labels) =================
  let found = null;  // last /discover answer, kept in memory: { k, silhouette, groups, ids }
  const thumb = it => `<img src="${imgURL(it)}" alt="" loading="lazy" data-open="${it.id}">`;
  function jenisBaru() {
    const P = pool(), ts = types(), demoHeld = [...I.values()].filter(i => held(i) && S.get(i.sid)?.demo).length;
    const grp = (g, k) => {
      const its = g.members.map(m => I.get(found.ids[m])).filter(Boolean);
      return `<section class="cand"><div class="sechead"><h2>Calon jenis ${String.fromCharCode(65 + k)} · ${its.length} barang</h2></div>
        <p class="small muted">Kemiripan di dalam kelompok ${fmt(g.cohesion)} · paling dekat dengan ${esc(C[g.nearest].name)} (jarak ${fmt(g.nearestDist)})</p>
        <div class="thumbs">${its.map(thumb).join("")}</div>
        <form class="name" data-group="${k}"><input type="text" name="kind" maxlength="40" placeholder="Nama jenis, mis. Setrika" required aria-label="Nama jenis baru">
          <select name="bin" aria-label="Wadah"><option value="0">Wadah non-B3</option><option value="1">Wadah B3</option></select>
          <button class="btn pri" type="submit">Simpan jenis</button><button class="btn" type="button" data-act="not-ewaste" data-group="${k}">Bukan e-waste</button></form></section>`;
    };
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Jenis baru</h1><p class="meta">Barang yang ditahan dari semua sesi. E-Rase mengelompokkannya ulang tanpa label; kamu memberi nama dan memilih wadahnya.</p></div></div>
      ${ts.length ? `<p class="sum">${ts.map(t => tag({ label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "" })).join("")}</p>` : ""}
      ${found ? found.groups.map(grp).join("") + `<p class="small muted section">${found.k > 1 ? `Agglomerative clustering (cosine) pada embedding CMRE; K = ${found.k} dipilih otomatis lewat silhouette ${fmt(found.silhouette)}.` : "Barang-barang ini belum membentuk kelompok yang jelas, jadi tampil sebagai satu kelompok."}</p>`
        : P.length >= 4 ? `<div class="sechead"><h2>${P.length} barang ditahan</h2><button class="btn pri" type="button" data-act="discover">Kelompokkan ${P.length} barang</button></div><div class="thumbs">${P.map(thumb).join("")}</div>`
        : `<p class="empty">Butuh minimal 4 barang ditahan; sekarang ada ${P.length}.${demoHeld ? " Barang ditahan dari sesi contoh tidak ikut karena embedding-nya tidak tersimpan." : ""} Unggah foto barang yang tidak ada di 16 jenis, misalnya setrika atau kipas angin.</p>`}
    </div>`;
  }
  async function discover() {
    const P = pool(), btn = main.querySelector("[data-act=discover]");
    if (btn) { btn.disabled = true; btn.textContent = "Mengelompokkan…"; }
    if (!online && !(await ping())) { toast("Server AI tidak terhubung."); return render(); }
    try {
      const r = await fetch(API + "/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ z: P.map(i => i.res.z) }), signal: AbortSignal.timeout(120000) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || r.statusText);
      found = { ...j, ids: P.map(i => i.id) };
    } catch (e) { toast("Gagal mengelompokkan: " + e.message); }
    render();
  }
  function applyGroup(k, corr, typeId) {
    found.groups[k].members.map(m => I.get(found.ids[m])).filter(Boolean)
      .forEach(it => { it.conf = "koreksi"; it.corr = corr; it.newType = typeId || null; putI(it); feedback(it); });
    found.groups.splice(k, 1);
    if (!found.groups.length) found = null;
    render();
  }

  // ================= Uji metode: the officer's (or jury's) own labelled folder, with vs without CMRE =================
  function ujiSetup() {
    main.innerHTML = `<div class="page article">
      <div class="head"><a class="iconbtn" href="#/cara-kerja" aria-label="Kembali">${ico("back")}</a><div class="t"><h1>Uji metode dengan foldermu</h1>
        <p class="meta">Buktikan sendiri: foto barang sejenis dari sumber berbeda masuk jenis yang sama, dengan dan tanpa CMRE.</p></div></div>
      <ol class="pipe three">
        <li><i>1</i><b>Satu subfolder per jenis</b><span>Nama subfolder menjadi label, mis. mouse, keyboard, baterai.</span></li>
        <li><i>2</i><b>Dua sumber (opsional)</b><span>Dua folder sumber, mis. katalog dan lapangan, dengan subfolder jenis yang sama.</span></li>
        <li><i>3</i><b>Pilih foldernya</b><span>E-Rase memproses semua foto. Label hanya dipakai untuk menilai hasil.</span></li></ol>
      <pre class="tree">folder-uji/
  katalog/          sumber 1 (opsional)
    mouse/  keyboard/  baterai/
  lapangan/         sumber 2 (opsional)
    mouse/  keyboard/  baterai/</pre>
      <p class="add"><button class="btn pri big" type="button" data-act="pick-dir">${ico("img")}Pilih folder</button></p>
      <p class="small muted">Pemilihan folder butuh browser laptop (Chrome atau Edge). Foto tidak disimpan di server.</p></div>`;
  }
  function ujiView(s) {
    const its = itemsOf(s.id), res = its.filter(isRes), t = tally(its);
    const labs = [...new Set(res.map(i => i.lab).filter(Boolean))].sort(), srcs = [...new Set(res.map(i => i.source).filter(Boolean))].sort(), ref = srcs[0];
    const maj = (list, key) => { const c = {}; list.forEach(i => { c[i.res[key]] = (c[i.res[key]] || 0) + 1; }); return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
    // the paper's cross-source consistency: share of other-source photos in the reference source's majority cluster
    const cross = key => { let hit = 0, tot = 0; const per = {};
      labs.forEach(l => { const r = res.filter(i => i.lab === l && i.source === ref), o = res.filter(i => i.lab === l && i.source && i.source !== ref);
        if (!r.length || !o.length) return; const m = maj(r, key), h = o.filter(i => i.res[key] === m).length; hit += h; tot += o.length; per[l] = [h, o.length]; });
      return { v: tot ? hit / tot : null, per }; };
    const purity = key => { let hit = 0, tot = 0; const per = {};
      labs.forEach(l => { const r = res.filter(i => i.lab === l), m = maj(r, key), h = r.filter(i => i.res[key] === m).length; hit += h; tot += r.length; per[l] = [h, r.length, m]; });
      return { v: tot ? hit / tot : null, per }; };
    const ready = !t.run && labs.length;
    const xc = ready && srcs.length > 1 ? cross("cluster") : null, xr = ready && srcs.length > 1 ? cross("rawCluster") : null;
    const pc = ready ? purity("cluster") : null, pr = ready ? purity("rawCluster") : null;
    const pct = v => v == null ? "-" : Math.round(100 * v) + "%";
    const vs = (k, a, b) => `<div><p class="k">${k}</p><div class="vs"><span><b>${pct(a)}</b>tanpa CMRE</span><span class="win"><b>${pct(b)}</b>dengan CMRE</span></div></div>`;
    main.innerHTML = `<div class="page">
      <div class="head"><a class="iconbtn" href="#/uji" aria-label="Kembali">${ico("back")}</a><div class="t"><h1>Uji: ${esc(s.label)}</h1>
        <p class="meta">${esc(s.no)} · ${its.length} foto · ${labs.length} jenis${srcs.length ? " · " + srcs.length + " sumber" : ""} · ${day(s.created)}</p></div>
        <div class="acts"><button class="btn" type="button" data-act="csv">Unduh CSV</button></div></div>
      ${t.run ? `<p class="note"><span class="spin"></span>Memproses ${t.run} dari ${its.length} foto…</p>` : ""}
      ${t.fail ? `<p class="note">${t.fail} foto belum diproses. <button class="btn sm" type="button" data-act="retry">Proses ulang</button></p>` : ""}
      ${!t.run && res.length && !labs.length ? `<p class="empty">Foto tidak berada di subfolder jenis, jadi tidak ada label untuk menilai. Susun ulang foldernya.</p>` : ""}
      ${ready ? `<div class="verdictbox">${xc && xc.v != null ? vs(`Foto dari ${esc(srcs.slice(1).join(", "))} yang masuk jenis yang sama dengan foto ${esc(ref)} sejenisnya`, xr.v, xc.v) : ""}
          ${vs("Foto berlabel sama yang berkumpul di satu jenis", pr.v, pc.v)}</div>
        <section class="section"><div class="sechead"><h2>Per jenis</h2></div><div class="tw"><table class="mini"><thead><tr><th>Label foldermu</th><th class="n">Foto</th><th>Jenis terbanyak (CMRE)</th><th class="n">Satu jenis</th>${xc ? '<th class="n">Lintas sumber tanpa CMRE</th><th class="n">Lintas sumber dengan CMRE</th>' : ""}<th class="n">Ditahan</th></tr></thead><tbody>
          ${labs.map(l => { const r = res.filter(i => i.lab === l), p = pc.per[l]; return `<tr><td>${esc(l)}</td><td class="n">${r.length}</td><td>${esc(C[p[2]].name)}</td><td class="n">${p[0]}/${p[1]}</td>
            ${xc ? `<td class="n">${xr.per[l] ? xr.per[l].join("/") : "-"}</td><td class="n">${xc.per[l] ? xc.per[l].join("/") : "-"}</td>` : ""}<td class="n">${r.filter(i => i.res.ood).length}</td></tr>`; }).join("")}</tbody></table></div>
          <p class="small muted">Tanpa CMRE: pipeline yang sama tanpa langkah pembersihan, ditempatkan ke 16 jenis yang sama.${xc ? ` Sumber rujukan: ${esc(ref)}.` : ""} Satu label bisa sah terbagi ke beberapa jenis (mis. baterai: aki, baterai laptop, baterai ponsel).</p></section>` : ""}
      <section class="section"><div class="sechead"><h2>Semua foto</h2></div><div class="list">${[...its].reverse().map(i => row(i)).join("")}</div></section></div>`;
  }

  // ================= dialogs: setoran, unit =================
  function newSetoran() {
    dlg.innerHTML = `<form class="dlg"><div class="top"><h2 id="dlgTitle">Catat setoran warga</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <label class="f">Nama penyetor<input type="text" name="label" maxlength="60" autocomplete="off" placeholder="mis. Bu Ani, RT 03" required></label>
      <label class="f">Lokasi (opsional)<input type="text" name="place" maxlength="60" autocomplete="off"></label>
      <div class="acts"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Mulai memotret</button></div></form>`;
    const f = dlg.querySelector("form");
    f.addEventListener("submit", e => {
      e.preventDefault();
      const s = makeSession("setoran", f.label.value.trim(), f.place.value.trim());
      dlg.close(); location.hash = "#/s/" + s.id;
      if (coarse) $("#pickCam").click();  // same tap opens the camera on phones
    });
    dlg.showModal(); f.label.focus();
  }
  function unitDialog() {
    const u = unit();
    dlg.innerHTML = `<form class="dlg"><div class="top"><h2 id="dlgTitle">Nama unit</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <label class="f">Nama unit<input type="text" name="unit" maxlength="60" value="${esc(u.unit || "")}" placeholder="mis. Bank Sampah Bersinar"></label>
      <label class="f">Nama petugas<input type="text" name="officer" maxlength="60" value="${esc(u.officer || "")}"></label>
      <div class="acts"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`;
    const f = dlg.querySelector("form");
    f.addEventListener("submit", e => { e.preventDefault(); try { localStorage.setItem("cmre-unit", JSON.stringify({ unit: f.unit.value.trim(), officer: f.officer.value.trim() })); } catch {} dlg.close(); render(); });
    dlg.showModal();
  }

  // ---- demo session: stored results of the same pipeline for photos from other datasets (demo.js)
  function demo() {
    const ex = [...S.values()].find(s => s.demo);
    if (ex) { location.hash = "#/s/" + ex.id; return; }
    const go = () => {
      const D = window.DEMO, pick = st => D.cards.filter(c => c.status === st), clusterOf = new Map(D.pts.map(p => [p[6], p[4]]));
      const cards = [...pick("cocok").slice(0, 7), ...pick("lapangan").slice(0, 3), ...pick("alarm").slice(0, 2)];
      const s = { id: uid(), no: "B-000", type: "batch", label: "Sesi contoh: foto dataset lain", place: "", created: Date.now(), done: false, demo: true };
      putS(s);
      cards.forEach((c, k) => putI({ id: uid(), sid: s.id, name: `${c.src}-${c.id}.webp`, t: Date.now() + k, src: `assets/c/${c.id}.webp`, state: "hasil", conf: "", corr: null, qty: 1, kg: null,
        res: { cluster: c.cluster, centres: c.centres, score: c.score, threshold: D.oodThreshold, ood: c.status === "alarm", nb: c.nb, nbSim: c.nbSim, nbCluster: c.nb.map(id => clusterOf.get(id)) } }));
      location.hash = "#/s/" + s.id;
    };
    if (window.DEMO) return go();
    const sc = Object.assign(document.createElement("script"), { src: "demo.js?v=8" });
    sc.onload = go; sc.onerror = () => toast("Data contoh tidak termuat."); document.body.appendChild(sc);
  }

  // ================= exports =================
  function csv(list, fname) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["sesi", "jenis_sesi", "tanggal", "penyetor_atau_batch", "file", "cluster", "jenis", "wadah", "b3", "ood", "skor_ood", "status", "jumlah", "berat_kg",
      "label_uji", "sumber_uji", "cluster_tanpa_cmre"];
    const body = list.filter(isRes).map(i => { const s = S.get(i.sid), r = route(i);
      return [s.no, s.type, new Date(s.created).toISOString().slice(0, 10), s.label, i.name, typeof i.corr === "string" ? "" : "C" + cl(i).id, kindName(i), r.label, r.b3 ? "ya" : "tidak",
        i.res.ood ? "ya" : "tidak", fmt(i.res.score, 3), status(i)[1], qty(i), i.kg ?? "", i.lab || "", i.source || "",
        i.res.rawCluster == null ? "" : "C" + i.res.rawCluster].map(q).join(","); });
    const url = URL.createObjectURL(new Blob(["﻿" + [head.join(","), ...body].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: fname }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3500); }

  // ================= events (delegated) =================
  let quick = false;  // a session is made only once photos are chosen, so a cancelled picker leaves nothing behind
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-new],[data-act],[data-conf],[data-open],[data-filter],[data-close],[data-pick],[data-jenis]");
    if (!el) return;
    const s = view.sid && S.get(view.sid);
    if (el.dataset.new) return newSetoran();
    if (el.dataset.jenis) return jenisDialog(C[+el.dataset.jenis]);
    if (el.dataset.close !== undefined) return dlg.close();
    if (el.dataset.filter) { filter = el.dataset.filter; return render(); }
    if (el.dataset.pick) { el.checked ? picked.add(el.dataset.pick) : picked.delete(el.dataset.pick); return render(); }
    if (el.dataset.conf) { setConf(I.get(el.dataset.conf), "benar"); render(); return toast("Tersimpan."); }
    if (el.dataset.open) return detail(I.get(el.dataset.open));
    const a = el.dataset.act;
    if (a === "quick-cam" || a === "quick-files") { quick = true; view = {}; $(a === "quick-cam" && coarse ? "#pickCam" : "#pickFiles").click(); }
    else if (a === "cam") $(coarse ? "#pickCam" : "#pickFiles").click();
    else if (a === "files") $("#pickFiles").click();
    else if (a === "pick-dir") $("#pickDir").click();
    else if (a === "discover") discover();
    else if (a === "not-ewaste") { applyGroup(+el.dataset.group, "bukan"); toast("Ditandai bukan e-waste."); }
    else if (a === "retry") retry(s.id);
    else if (a === "unit") unitDialog();
    else if (a === "demo") demo();
    else if (a === "print") print();
    else if (a === "csv") csv(itemsOf(s.id), `e-rase-${s.no}.csv`);
    else if (a === "csv-all") csv([...I.values()].sort((x, y) => x.t - y.t), `e-rase-riwayat-${new Date().toISOString().slice(0, 10)}.csv`);
    else if (a === "pickall") { const open = itemsOf(s.id).filter(i => isRes(i) && !i.conf && !i.res.ood && main.querySelector(`[data-pick="${i.id}"]`)); el.checked ? open.forEach(i => picked.add(i.id)) : picked.clear(); render(); }
    else if (a === "bulk") { const n = picked.size; picked.forEach(id => { const it = I.get(id); if (it && isRes(it) && !it.conf) setConf(it, "benar"); }); picked.clear(); render(); toast(`${n} barang dibenarkan.`); }
    else if (a === "finish") {
      const t = tally(itemsOf(s.id));
      if (t.run) return toast("Tunggu sampai semua foto selesai diproses.");
      if (t.held) { filter = "tahan"; render(); return toast(`${t.held} barang ditahan. Periksa dulu.`); }
      s.done = true; s.closedAt = Date.now(); putS(s); location.hash = "#/s/" + s.id + "/dokumen";
    } else if (a === "reopen") { s.done = false; putS(s); render(); }
  });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });  // tap on the backdrop closes
  ["#pickFiles", "#pickCam"].forEach(sel => $(sel).addEventListener("change", e => {
    const files = e.target.files;
    if (quick && files.length) {
      const s = makeSession(files.length > 1 ? "batch" : "setoran");
      view = { sid: s.id }; location.hash = "#/s/" + s.id;
    }
    quick = false;
    if (view.sid) addFiles(view.sid, files);
    e.target.value = "";
  }));
  // Uji metode: folder/<kind>/photo or folder/<source>/<kind>/photo; folder names become labels for scoring only
  $("#pickDir").addEventListener("change", e => {
    const fs = [...e.target.files].filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));
    e.target.value = "";
    if (!fs.length) return toast("Folder itu tidak berisi foto JPG, PNG, atau WEBP.");
    const parts = f => (f.webkitRelativePath || f.name).split("/");
    const meta = fs.map(f => { const p = parts(f); return p.length >= 4 ? { source: p[1], lab: p[2] } : p.length === 3 ? { lab: p[1] } : {}; });
    const s = makeSession("uji", parts(fs[0])[0]);
    view = { sid: s.id }; location.hash = "#/s/" + s.id;
    addFiles(s.id, fs, meta);
  });
  // naming a candidate group turns it into a new kind on this device
  main.addEventListener("submit", e => {
    const f = e.target.closest("form.name");
    if (!f) return;
    e.preventDefault();
    const name = f.elements.kind.value.trim();
    if (!name) return;
    const t = { id: uid(), name, b3: f.elements.bin.value === "1", created: Date.now() };
    saveTypes([...types(), t]);
    applyGroup(+f.dataset.group, "baru", t.id);
    toast(`Jenis "${name}" tersimpan.`);
  });
  // drag and drop: on the home capture surface it starts a session; inside a batch it adds to it
  ["dragenter", "dragover"].forEach(t => main.addEventListener(t, e => { const z = e.target.closest("[data-drop]"); if (z) { e.preventDefault(); z.classList.add("over"); } }));
  ["dragleave", "drop"].forEach(t => main.addEventListener(t, e => { const z = e.target.closest("[data-drop]"); if (z) { e.preventDefault(); z.classList.remove("over"); } }));
  main.addEventListener("drop", e => {
    const z = e.target.closest("[data-drop]"); if (!z || !e.dataTransfer.files.length) return;
    const sid = z.dataset.drop === "home" ? makeSession(e.dataTransfer.files.length > 1 ? "batch" : "setoran").id : z.dataset.drop;
    if (z.dataset.drop === "home") { view = { sid }; location.hash = "#/s/" + sid; }
    addFiles(sid, e.dataTransfer.files);
  });
  addEventListener("hashchange", () => { if (dlg.open) dlg.close(); render(); main.focus({ preventScroll: true }); scrollTo(0, 0); });

  // ================= start =================
  Promise.all([tx("sessions", "readonly", s => s.getAll()), tx("items", "readonly", s => s.getAll())]).then(([ss, its]) => {
    ss.forEach(s => S.set(s.id, s));
    its.forEach(i => { if (i.state === "proses") i.state = "gagal"; I.set(i.id, i); });  // uploads cut off by a reload can be retried
    render();
  }).catch(e => { main.innerHTML = `<div class="page"><p class="empty">Penyimpanan perangkat tidak tersedia (${esc(e.message)}). Buka di browser biasa, bukan mode privat.</p></div>`; });
  ping();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
