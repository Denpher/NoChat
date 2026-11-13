/* NoChat group chats — create, manage members/roles, leave. Server enforces every rule. */
(function () {
  "use strict";
  const A = window.NoChatApp; if (!A) return;
  const { api, toast, esc, icon, avatar, verified, groupAvatar, openModal, closeModal, confirmDialog, go } = A;
  const $ = (s, c = document) => c.querySelector(s);

  document.body.insertAdjacentHTML("beforeend", `
  <div class="modal hidden" id="groupCreateModal" role="dialog" aria-modal="true" aria-labelledby="groupCreateTitle">
    <form class="modal-card" id="groupCreateForm" autocomplete="off">
      <header class="modal-head"><h2 id="groupCreateTitle">${icon("group")} New group</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></header>
      <div class="group-photo-row">
        <button type="button" class="group-photo-pick" id="groupPhotoPick" aria-label="Choose group photo"><span id="groupPhotoPreview">${icon("camera")}</span></button>
        <label class="field grow"><span>Group name</span><input type="text" id="groupName" maxlength="60" required placeholder="e.g. Weekend crew"></label>
      </div>
      <input type="file" id="groupPhotoInput" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      <label class="search">${icon("search")}<input type="search" id="groupPickSearch" placeholder="Search friends"></label>
      <p class="section-label">Add friends <span class="count" id="groupPickCount">0</span></p>
      <div class="pick-list" id="groupPickList"></div>
      <p class="form-error hidden" id="groupCreateError" role="alert"></p>
      <div class="row-actions end"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-primary" id="groupCreateBtn" disabled>Create group</button></div>
    </form>
  </div>
  <div class="modal hidden" id="groupInfoModal" role="dialog" aria-modal="true" aria-labelledby="groupInfoTitle">
    <div class="modal-card" id="groupInfoBody"></div>
  </div>
  <div class="modal hidden" id="groupAddModal" role="dialog" aria-modal="true" aria-labelledby="groupAddTitle">
    <form class="modal-card" id="groupAddForm">
      <header class="modal-head"><h2 id="groupAddTitle">${icon("user-plus")} Add members</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></header>
      <div class="pick-list" id="groupAddList"></div>
      <div class="row-actions end"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-primary" id="groupAddBtn" disabled>Add</button></div>
    </form>
  </div>`);

  // "New group" button beside "New message"
  const head = $("#newChatBtn");
  head.insertAdjacentHTML("beforebegin", `<button type="button" class="icon-btn" id="newGroupBtn" aria-label="New group" title="New group">${icon("group")}</button>`);
  $("#newGroupBtn").addEventListener("click", openCreate);

  let friends = [], picked = new Set(), photo = null;
  const pickRow = (u, on) => `<label class="pick-row check-row"><input type="checkbox" value="${esc(u.id)}" ${on ? "checked" : ""}>${avatar(u, "md", u.isOnline)}<span class="person-text"><strong>${esc(u.displayName)}${verified(u)}</strong><small>@${esc(u.username)}</small></span><span class="check-mark">${icon("check")}</span></label>`;
  async function loadFriends() { const d = await api("/api/friends"); friends = d.friends || []; return friends; }
  function renderPick() {
    const q = $("#groupPickSearch").value.trim().toLowerCase();
    const list = friends.filter((u) => !q || (u.displayName || "").toLowerCase().includes(q) || u.username.includes(q));
    $("#groupPickList").innerHTML = friends.length ? (list.map((u) => pickRow(u, picked.has(u.id))).join("") || `<p class="muted pad">No friends match.</p>`) : `<div class="empty compact"><p class="muted">Groups are made of friends. Add friends on the People page first.</p></div>`;
    $("#groupPickCount").textContent = picked.size;
    $("#groupCreateBtn").disabled = !picked.size || !$("#groupName").value.trim();
  }
  async function openCreate() {
    picked = new Set(); photo = null; $("#groupName").value = ""; $("#groupPickSearch").value = "";
    $("#groupPhotoPreview").innerHTML = icon("camera"); $("#groupCreateError").classList.add("hidden");
    $("#groupPickList").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    openModal("groupCreateModal");
    try { await loadFriends(); renderPick(); } catch (e) { $("#groupPickList").innerHTML = `<p class="muted pad">${e.silent ? "" : esc(e.message)}</p>`; }
  }
  $("#groupPickSearch").addEventListener("input", renderPick);
  $("#groupName").addEventListener("input", renderPick);
  $("#groupPickList").addEventListener("change", (e) => { const c = e.target.closest("input[type=checkbox]"); if (!c) return; c.checked ? picked.add(c.value) : picked.delete(c.value); renderPick(); });
  $("#groupPhotoPick").addEventListener("click", () => $("#groupPhotoInput").click());
  $("#groupPhotoInput").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast("Choose an image under 10 MB.", "error"); return; }
    photo = f; $("#groupPhotoPreview").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`;
  });
  async function uploadPhoto(id, file) { const fd = new FormData(); fd.append("avatar", file); return api(`/api/groups/${id}/avatar`, { method: "POST", body: fd }); }
  $("#groupCreateForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const btn = $("#groupCreateBtn"); btn.disabled = true; btn.textContent = "Creating…";
    try {
      const { group } = await api("/api/groups", { method: "POST", body: { name: $("#groupName").value.trim(), memberIds: [...picked] } });
      if (photo) await uploadPhoto(group.id, photo).catch((err) => toast("Group created, but the photo didn't upload: " + err.message, "error"));
      closeModal("groupCreateModal"); toast("Group created", "success");
      await A.loadConversations(true); go("messages/" + group.id);
    } catch (err) { $("#groupCreateError").textContent = err.message; $("#groupCreateError").classList.remove("hidden"); }
    finally { btn.textContent = "Create group"; renderPick(); }
  });

  // ---------- group info ----------
  let info = null;
  const roleLabel = { owner: "Owner", admin: "Admin", member: "" };
  function renderInfo() {
    const g = info, me = A.me().id, mine = g.myRole, manage = mine === "owner" || mine === "admin";
    const memberRow = (m) => {
      const canRemove = m.id !== me && (mine === "owner" || (mine === "admin" && m.groupRole === "member"));
      const actions = [
        mine === "owner" && m.id !== me ? `<button type="button" class="btn btn-ghost sm" data-admin="${esc(m.id)}" data-on="${m.groupRole === "admin" ? "0" : "1"}">${m.groupRole === "admin" ? "Remove admin" : "Make admin"}</button>` : "",
        canRemove ? `<button type="button" class="btn btn-ghost sm danger-text" data-remove="${esc(m.id)}">Remove</button>` : ""
      ].join("");
      return `<div class="member-row">${avatar(m, "md", m.isOnline)}<span class="person-text"><strong>${esc(m.displayName)}${verified(m)}${m.id === me ? ' <small class="muted">(you)</small>' : ""}</strong><small>@${esc(m.username)}</small></span>${roleLabel[m.groupRole] ? `<span class="role-pill ${m.groupRole}">${m.groupRole === "owner" ? icon("crown") : icon("shield")}${roleLabel[m.groupRole]}</span>` : ""}<span class="member-actions">${actions}</span></div>`;
    };
    $("#groupInfoBody").innerHTML = `
      <header class="modal-head"><h2 id="groupInfoTitle">Group info</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></header>
      <div class="group-hero">
        <button type="button" class="group-photo-pick lg" id="groupInfoPhoto" ${manage ? "" : "disabled"} aria-label="Change group photo">${groupAvatar(g, "xl")}${manage ? `<span class="avatar-cam">${icon("camera")}</span>` : ""}</button>
        ${manage ? `<form id="groupRenameForm" class="rename-row"><input type="text" id="groupRename" maxlength="60" value="${esc(g.name)}" aria-label="Group name"><button type="submit" class="btn btn-soft sm">Save</button></form>` : `<h3 class="group-title">${esc(g.name)}</h3>`}
        <p class="muted small">${g.memberCount} members · created ${new Date(g.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
      </div>
      <input type="file" id="groupInfoPhotoInput" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      <div class="section-head"><p class="section-label">Members</p>${manage ? `<button type="button" class="btn btn-soft sm" id="groupAddOpen">${icon("user-plus")} Add</button>` : ""}</div>
      <div class="member-list">${g.members.map(memberRow).join("")}</div>
      <div class="row-actions"><button type="button" class="btn btn-danger" id="groupLeave">${icon("log-out")} Leave group</button></div>`;
  }
  async function openInfo(id) {
    $("#groupInfoBody").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    openModal("groupInfoModal");
    try { info = (await api(`/api/groups/${id}`)).group; renderInfo(); }
    catch (e) { closeModal("groupInfoModal"); e.silent || toast(e.message, "error"); }
  }
  const apply = (g) => { info = g; renderInfo(); A.loadConversations(true); };
  $("#groupInfoBody").addEventListener("click", async (e) => {
    if (!info) return; const t = e.target;
    try {
      if (t.closest("#groupInfoPhoto")) $("#groupInfoPhotoInput").click();
      else if (t.closest("#groupAddOpen")) openAdd();
      else if (t.closest("[data-admin]")) { const b = t.closest("[data-admin]"); apply((await api(`/api/groups/${info.id}/admins/${b.dataset.admin}`, { method: "POST", body: { admin: b.dataset.on === "1" } })).group); }
      else if (t.closest("[data-remove]")) {
        const id = t.closest("[data-remove]").dataset.remove; const m = info.members.find((x) => x.id === id);
        if (!(await confirmDialog(`Remove ${m?.displayName || "member"}?`, "They will no longer see new messages in this group.", "Remove"))) return;
        openModal("groupInfoModal"); apply((await api(`/api/groups/${info.id}/members/${id}`, { method: "DELETE" })).group);
      } else if (t.closest("#groupLeave")) {
        const owner = info.myRole === "owner";
        if (!(await confirmDialog("Leave this group?", owner ? "Ownership passes to an admin (or the longest-standing member)." : "You can be added back by a group admin.", "Leave"))) return;
        await api(`/api/groups/${info.id}/leave`, { method: "POST" }); info = null;
        closeModal("groupInfoModal"); toast("You left the group"); await A.loadConversations(true); A.closeChat();
      }
    } catch (err) { err.silent || toast(err.message, "error"); }
  });
  $("#groupInfoBody").addEventListener("submit", async (e) => {
    if (e.target.id !== "groupRenameForm") return; e.preventDefault();
    try { apply((await api(`/api/groups/${info.id}`, { method: "PUT", body: { name: $("#groupRename").value.trim() } })).group); toast("Group renamed", "success"); } catch (err) { toast(err.message, "error"); }
  });
  $("#groupInfoBody").addEventListener("change", async (e) => {
    if (e.target.id !== "groupInfoPhotoInput") return; const f = e.target.files[0]; if (!f) return;
    try { apply((await uploadPhoto(info.id, f)).group); toast("Group photo updated", "success"); } catch (err) { toast(err.message, "error"); }
  });

  let addPicked = new Set();
  async function openAdd() {
    addPicked = new Set(); openModal("groupAddModal"); $("#groupAddBtn").disabled = true;
    $("#groupAddList").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    try {
      await loadFriends(); const inGroup = new Set(info.members.map((m) => m.id));
      const list = friends.filter((u) => !inGroup.has(u.id));
      $("#groupAddList").innerHTML = list.length ? list.map((u) => pickRow(u, false)).join("") : `<p class="muted pad">All your friends are already in this group.</p>`;
    } catch (e) { $("#groupAddList").innerHTML = `<p class="muted pad">${esc(e.message)}</p>`; }
  }
  $("#groupAddList").addEventListener("change", (e) => { const c = e.target.closest("input[type=checkbox]"); if (!c) return; c.checked ? addPicked.add(c.value) : addPicked.delete(c.value); $("#groupAddBtn").disabled = !addPicked.size; });
  $("#groupAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { apply((await api(`/api/groups/${info.id}/members`, { method: "POST", body: { userIds: [...addPicked] } })).group); closeModal("groupAddModal"); toast("Members added", "success"); }
    catch (err) { toast(err.message, "error"); }
  });

  window.NoChatGroups = {
    openInfo, openCreate,
    bindSocket(s) {
      s.on("group:update", async ({ groupId }) => {
        await A.loadConversations(true);
        const st = A.state;
        if (st.activeConvoId === groupId) { const c = st.conversations.find((x) => x.id === groupId); if (c?.group) { st.activeGroup = { ...c.group }; A.renderChatHeader(); } }
        if (info && info.id === groupId && !$("#groupInfoModal").classList.contains("hidden")) { try { info = (await api(`/api/groups/${groupId}`)).group; renderInfo(); } catch (_) { closeModal("groupInfoModal"); } }
      });
      s.on("group:removed", async ({ groupId, name }) => {
        toast(`You were removed from ${name || "a group"}`);
        if (info && info.id === groupId) closeModal("groupInfoModal");
        await A.loadConversations(true);
        if (A.state.activeConvoId === groupId) A.closeChat();
      });
    }
  };
})();
