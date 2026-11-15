/* NoChat Videos — streaming-style browser + player. Embeds only; view counts are server-side. */
(function () {
  "use strict";
  const A = window.NoChatApp; if (!A) return;
  const { api, toast, esc, icon, openModal, closeModal, confirmDialog, go, debounce, fmtCount } = A;
  const $ = (s, c = document) => c.querySelector(s);
  const S = { loaded: false, page: 1, hasMore: false, loading: false, items: [], category: "", q: "", sort: "latest", canManage: false, viewsPersistent: true, maxUpload: 900, current: null };
  const fmtDur = (s) => { if (!s) return ""; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const viewsText = (v) => v.views === null || v.views === undefined ? "" : `${fmtCount(v.views)} view${v.views === 1 ? "" : "s"}`;
  const big = (v) => v.provider === "youtube" ? `https://i.ytimg.com/vi/${v.embedId}/hqdefault.jpg` : v.thumbnail;
  const thumb = (v, cls = "") => v.thumbnail
    ? `<img class="${cls}" src="${esc(v.thumbnail)}" ${v.provider === "youtube" ? `srcset="${esc(v.thumbnail)} 320w, ${esc(big(v))} 480w" sizes="(max-width: 600px) 100vw, 320px"` : ""} alt="" loading="lazy" decoding="async" width="320" height="180">`
    : `<span class="thumb-fallback">${icon("play")}</span>`;

  // ---------- browsing ----------
  function card(v) {
    const watchUrl = v.watchUrl || (v.category === "Anime" ? "https://www.crunchyroll.com/" : "https://www.netflix.com/");
    const providerName = v.category === "Anime" ? "Crunchyroll" : "Netflix";
    return `<article class="vcard" data-video="${esc(v.id)}">
      <button type="button" class="vcard-media" data-open-video="${esc(v.id)}" aria-label="Play ${esc(v.title)}">
        ${thumb(v)}<span class="vcard-play">${icon("play")}</span>
        ${v.durationSec ? `<span class="vcard-dur">${fmtDur(v.durationSec)}</span>` : ""}
        <span class="vcard-cat">${esc(v.category)}</span>
      </button>
      <div class="vcard-body">
        <h3 class="vcard-title" title="${esc(v.title)}">${esc(v.title)}</h3>
        <p class="vcard-meta"><span>${esc(v.channel)}</span>${viewsText(v) ? ` · <span data-views="${esc(v.id)}">${viewsText(v)}</span>` : ""}</p>
        <div class="watch-actions-row">
          <a href="${esc(watchUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary sm" style="font-size:12px;padding:0 10px;height:30px">${icon("tv")} ${providerName}</a>
          <button type="button" class="btn btn-primary sm" data-discuss-video="${esc(v.id)}" style="font-size:12px;padding:0 10px;height:30px">${icon("message")} Discuss</button>
        </div>
      </div>
      ${S.canManage ? `<div class="vcard-admin" style="padding:0 14px 10px"><button type="button" class="icon-btn glass sm" data-edit-video="${esc(v.id)}" aria-label="Edit">${icon("edit")}</button><button type="button" class="icon-btn glass sm" data-delete-video="${esc(v.id)}" aria-label="Delete">${icon("trash")}</button></div>` : ""}
    </article>`;
  }
  function renderFeatured() {
    const box = $("#videoFeatured");
    const v = !S.q && !S.category && S.sort === "latest" ? (S.items.find((x) => x.category === "Movies") || S.items[0]) : null;
    box.classList.toggle("hidden", !v); if (!v) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="featured-bg" style="background-image:url('${esc(big(v) || "")}')"></div>
      <div class="featured-body">
        <span class="eyebrow">${icon("star")} Featured · ${esc(v.category)}</span>
        <h2>${esc(v.title)}</h2>
        <p>${esc(v.description)}</p>
        <div class="row-actions"><button type="button" class="btn btn-primary" data-open-video="${esc(v.id)}">${icon("play")} Watch now</button><span class="muted small">${esc(v.channel)}${viewsText(v) ? " · " + viewsText(v) : ""}</span></div>
      </div>`;
  }
  function renderGrid() {
    const grid = $("#videoGrid");
    if (!S.items.length) {
      grid.innerHTML = `<div class="empty span-all"><div class="empty-icon">${icon("tv")}</div><h3>${S.q ? "No videos match" : "No videos here yet"}</h3><p class="muted">${S.q ? `Nothing found for “${esc(S.q)}”. Try another title.` : "Check another category."}</p></div>`;
    } else grid.innerHTML = S.items.map(card).join("");
    renderFeatured();
    $("#videoNotice").classList.toggle("hidden", S.viewsPersistent);
    $("#videoAddBtn").classList.toggle("hidden", !S.canManage);
  }
  async function load(reset) {
    if (S.loading) return; S.loading = true;
    if (reset) { S.page = 1; S.items = []; $("#videoGrid").innerHTML = Array.from({ length: 8 }, () => `<div class="vcard skeleton-card"><div class="skeleton ratio"></div><div class="skeleton line"></div><div class="skeleton line short"></div></div>`).join(""); }
    $("#videoMore").classList.toggle("hidden", reset);
    try {
      const qs = new URLSearchParams({ page: S.page, limit: 12, sort: S.sort, ...(S.category ? { category: S.category } : {}), ...(S.q ? { q: S.q } : {}) });
      const d = await api("/api/videos?" + qs);
      S.items = reset ? d.videos : S.items.concat(d.videos); S.hasMore = d.hasMore; S.canManage = d.canManage; S.viewsPersistent = d.viewsPersistent; S.maxUpload = d.maxUploadSeconds;
      if (reset) renderCats(d.categories);
      renderGrid(); S.loaded = true;
    } catch (e) {
      if (!e.silent) $("#videoGrid").innerHTML = `<div class="empty span-all"><div class="empty-icon">${icon("alert")}</div><h3>Videos didn't load</h3><p class="muted">${esc(e.message)}</p><button type="button" class="btn btn-soft" id="videoRetry">Try again</button></div>`;
    } finally { S.loading = false; $("#videoMore").classList.add("hidden"); }
  }
  function renderCats(cats) {
    S.cats = cats;
    $("#videoCats").innerHTML = ["", ...cats].map((c) => `<button type="button" class="vchip ${c === S.category ? "active" : ""}" data-cat="${esc(c)}">${c || "All"}</button>`).join("");
  }
  $("#videoCats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; S.category = b.dataset.cat; renderCats(S.cats); load(true); });
  $("#videoSearch").addEventListener("input", debounce((e) => { S.q = e.target.value.trim(); load(true); }, 300));
  $("#videoSort").addEventListener("change", (e) => { S.sort = e.target.value; load(true); });
  new IntersectionObserver((entries) => { if (entries[0].isIntersecting && S.loaded && S.hasMore && !S.loading) { S.page++; load(false); } }, { root: null, rootMargin: "600px" }).observe($("#videoSentinel"));
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open-video]"); if (o) { go("videos/" + o.dataset.openVideo); return; }
    if (e.target.closest("#videoRetry")) load(true);
    const ed = e.target.closest("[data-edit-video]"); if (ed) openManage(S.items.find((v) => v.id === ed.dataset.editVideo));
    const del = e.target.closest("[data-delete-video]"); if (del) removeVideo(del.dataset.deleteVideo);
    const disc = e.target.closest("[data-discuss-video]"); if (disc) { go("messages"); }
  });

  // ---------- player ----------
  let yt = null, ytApi = null, vimeoHandler = null;
  function ytReady() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!ytApi) ytApi = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); res(); };
      const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true; s.onerror = () => { ytApi = null; rej(new Error("blocked")); };
      document.head.appendChild(s); setTimeout(() => rej(new Error("timeout")), 8000);
    });
    return ytApi;
  }
  async function countStart(v) {
    if (S.current?.id !== v.id || S.current.counted) return; S.current.counted = true;
    try {
      const r = await api(`/api/videos/${v.id}/view`, { method: "POST" });
      if (typeof r.views === "number") { v.views = r.views; document.querySelectorAll(`[data-views="${CSS.escape(v.id)}"]`).forEach((el) => { el.textContent = viewsText(v); }); $("#playerViews").textContent = viewsText(v); const it = S.items.find((x) => x.id === v.id); if (it) it.views = r.views; }
    } catch (_) { /* counting must never interrupt playback */ }
  }
  function destroyPlayer() {
    try { yt?.destroy(); } catch (_) {} yt = null;
    if (vimeoHandler) { window.removeEventListener("message", vimeoHandler); vimeoHandler = null; }
    $("#playerFrame").innerHTML = ""; S.current = null;
  }
  async function openPlayer(id) {
    if (S.current?.id === id) return;
    destroyPlayer();
    let v = S.items.find((x) => x.id === id);
    openModal("videoPlayerModal");
    $("#playerFrame").innerHTML = `<div class="player-loading"><div class="spinner"></div></div>`;
    try { if (!v) v = (await api("/api/videos/" + encodeURIComponent(id))).video; }
    catch (e) { closeModal("videoPlayerModal"); e.silent || toast("That video isn't available.", "error"); history.replaceState(null, "", "#/videos"); return; }
    S.current = { id: v.id, counted: false };
    $("#playerTitle").textContent = v.title; $("#playerChannel").textContent = v.channel; $("#playerCat").textContent = v.category;
    $("#playerViews").textContent = viewsText(v); $("#playerDesc").textContent = v.description || "";
    const watchLink = $("#playerWatchLink");
    if (watchLink) {
      const wUrl = v.watchUrl || (v.category === "Anime" ? "https://www.crunchyroll.com/" : "https://www.netflix.com/");
      watchLink.href = wUrl;
      watchLink.innerHTML = `${icon("tv")} Where to Watch (${v.category === "Anime" ? "Crunchyroll" : "Netflix"})`;
    }
    const discussBtn = $("#playerDiscussBtn");
    if (discussBtn) {
      discussBtn.onclick = () => {
        closeModal("videoPlayerModal");
        go("messages");
      };
    }
    const frame = $("#playerFrame");
    if (v.provider === "upload") {
      frame.innerHTML = `<video controls playsinline preload="metadata" ${v.thumbnail ? `poster="${esc(v.thumbnail)}"` : ""} src="${esc(v.fileUrl)}"></video>`;
      const el = frame.querySelector("video"); el.addEventListener("playing", () => countStart(v), { once: true }); el.play().catch(() => {});
    } else if (v.provider === "youtube") {
      frame.innerHTML = `<div id="ytMount"></div>`;
      try {
        await ytReady(); if (S.current?.id !== v.id) return;
        yt = new window.YT.Player("ytMount", { host: "https://www.youtube-nocookie.com", videoId: v.embedId, width: "100%", height: "100%",
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: location.origin },
          events: { onStateChange: (e) => { if (e.data === window.YT.PlayerState.PLAYING) countStart(v); } } });
      } catch (_) {
        // IFrame API blocked: still play, but do not guess a view without a real playback signal.
        frame.innerHTML = `<iframe src="${esc(v.embedUrl)}&autoplay=1" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      }
    } else if (v.provider === "vimeo") {
      frame.innerHTML = `<iframe src="${esc(v.embedUrl)}&autoplay=1" title="${esc(v.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      const ifr = frame.querySelector("iframe");
      vimeoHandler = (e) => {
        if (!/^https:\/\/player\.vimeo\.com$/.test(e.origin)) return;
        let d = e.data; try { d = typeof d === "string" ? JSON.parse(d) : d; } catch (_) { return; }
        if (d.event === "ready") ifr.contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "play" }), "https://player.vimeo.com");
        if (d.event === "play") countStart(v);
      };
      window.addEventListener("message", vimeoHandler);
    }
    renderUpNext(v);
  }
  function renderUpNext(v) {
    const next = S.items.filter((x) => x.id !== v.id && x.category === v.category).concat(S.items.filter((x) => x.id !== v.id && x.category !== v.category)).slice(0, 8);
    $("#playerNext").innerHTML = next.map((x) => `<button type="button" class="next-row" data-open-video="${esc(x.id)}">${thumb(x)}<span><strong>${esc(x.title)}</strong><small>${esc(x.channel)}${viewsText(x) ? " · " + viewsText(x) : ""}</small></span></button>`).join("") || `<p class="muted small">More videos appear here.</p>`;
  }
  $("#videoPlayerModal").addEventListener("closed", () => { destroyPlayer(); if (/^#\/videos\/./.test(location.hash)) history.replaceState(null, "", "#/videos"); });

  // ---------- founder management ----------
  let editing = null, mode = "link";
  function setMode(m) {
    mode = m; document.querySelectorAll("[data-vmode]").forEach((b) => b.classList.toggle("active", b.dataset.vmode === m));
    $("#vmLinkField").classList.toggle("hidden", m !== "link"); $("#vmFileField").classList.toggle("hidden", m !== "upload");
    $("#vmUrl").required = m === "link";
  }
  function openManage(v) {
    editing = v || null; $("#vmError").classList.add("hidden");
    $("#vmTitle").textContent = v ? "Edit video" : "Add video";
    $("#vmCategory").innerHTML = (S.cats || ["Anime", "Movies", "Trailers", "Entertainment"]).map((c) => `<option ${v?.category === c ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("#vmName").value = v?.title || ""; $("#vmDesc").value = v?.description || ""; $("#vmChannel").value = v?.channel || "";
    $("#vmUrl").value = v && v.provider === "youtube" ? `https://www.youtube.com/watch?v=${v.embedId}` : (v?.provider === "vimeo" ? `https://vimeo.com/${v.embedId}` : "");
    $("#vmWatchUrl").value = v?.watchUrl || ""; $("#vmFile").value = "";
    $("#vmModes").classList.toggle("hidden", Boolean(v)); setMode(v?.provider === "upload" ? "none" : "link");
    $("#vmProgress").classList.add("hidden");
    openModal("videoManageModal");
  }
  document.querySelectorAll("[data-vmode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.vmode)));
  $("#videoAddBtn").addEventListener("click", () => openManage(null));
  $("#vmFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 100 * 1024 * 1024) { toast("Videos must be under 100 MB.", "error"); e.target.value = ""; return; }
    const probe = document.createElement("video"); probe.preload = "metadata"; probe.src = URL.createObjectURL(f);
    probe.onloadedmetadata = () => { if (probe.duration > S.maxUpload + 0.5) { toast(`Videos can be at most ${S.maxUpload / 60} minutes.`, "error"); e.target.value = ""; } URL.revokeObjectURL(probe.src); };
  });
  $("#videoManageForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const btn = $("#vmSave"); btn.disabled = true; const err = $("#vmError"); err.classList.add("hidden");
    const meta = { title: $("#vmName").value.trim(), category: $("#vmCategory").value, description: $("#vmDesc").value.trim(), channel: $("#vmChannel").value.trim(), watchUrl: $("#vmWatchUrl").value.trim() };
    try {
      if (editing) await api("/api/videos/" + editing.id, { method: "PUT", body: { ...meta, ...(mode === "link" && $("#vmUrl").value.trim() ? { url: $("#vmUrl").value.trim() } : {}) } });
      else if (mode === "link") await api("/api/videos", { method: "POST", body: { ...meta, url: $("#vmUrl").value.trim() } });
      else {
        const f = $("#vmFile").files[0]; if (!f) throw new Error("Choose a video file.");
        const fd = new FormData(); Object.entries(meta).forEach(([k, val]) => fd.append(k, val)); fd.append("video", f);
        await new Promise((res, rej) => {
          const x = new XMLHttpRequest(); x.open("POST", "/api/videos/upload"); x.withCredentials = true;
          $("#vmProgress").value = 0; $("#vmProgress").classList.remove("hidden");
          x.upload.onprogress = (ev) => { if (ev.lengthComputable) $("#vmProgress").value = Math.round((ev.loaded / ev.total) * 100); };
          x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (_) {} x.status < 300 ? res(d) : rej(new Error(d.error || "Upload failed.")); };
          x.onerror = () => rej(new Error("Upload failed. Check your connection.")); x.send(fd);
        });
      }
      closeModal("videoManageModal"); toast(editing ? "Video updated" : "Video added", "success"); load(true);
    } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); }
    finally { btn.disabled = false; }
  });
  async function removeVideo(id) {
    const v = S.items.find((x) => x.id === id);
    if (!(await confirmDialog("Delete this video?", `“${v?.title || "Video"}” will be removed for everyone.`, "Delete"))) return;
    try { await api("/api/videos/" + id, { method: "DELETE" }); toast("Video deleted", "success"); S.items = S.items.filter((x) => x.id !== id); renderGrid(); } catch (e) { toast(e.message, "error"); }
  }

  window.NoChatVideos = {
    route(active, id, changed) {
      if (!active) { if (!$("#videoPlayerModal").classList.contains("hidden")) closeModal("videoPlayerModal"); return; }
      if (!S.loaded && changed) load(true);
      if (id) openPlayer(id); else if (!$("#videoPlayerModal").classList.contains("hidden")) closeModal("videoPlayerModal");
    }
  };
})();
