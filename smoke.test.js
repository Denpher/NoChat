// testing the code in npm local server
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 5099;
const B = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nochat-test-"));
const env = { ...process.env, PORT: String(PORT), JWT_SECRET: "test-secret-".padEnd(64, "x"),
  DATA_DIR: path.join(tmp, "db"), UPLOADS_DIR: path.join(tmp, "up"), NODE_ENV: "development" };
let proc;
const start = () => new Promise((res) => {
  proc = spawn(process.execPath, ["server.js"], { env, stdio: "ignore" });
  const t = setInterval(() => fetch(B + "/api/health").then(() => { clearInterval(t); res(); }).catch(() => {}), 200);
});
const stop = () => new Promise((r) => { proc.once("exit", r); proc.kill(); });
let cookie = "";

before(start);
after(async () => { await stop(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("register sets a session cookie and /api/me works", async () => {
  const r = await fetch(B + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "smokeuser", password: "Passw0rd!x", displayName: "Smoke" }) });
  assert.ok(r.ok, `register status ${r.status}`);
  cookie = r.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(B + "/api/me", { headers: { cookie } })).status, 200);
  assert.equal((await fetch(B + "/api/friends/requests", { headers: { cookie } })).status, 200);
});

test("protected routes reject requests without a session", async () => {
  assert.equal((await fetch(B + "/api/me")).status, 401);
});

test("session survives a server restart", async () => {
  await stop(); await start();
  assert.equal((await fetch(B + "/api/me", { headers: { cookie } })).status, 200);
});

test("socket.io client is served as JavaScript", async () => {
  const r = await fetch(B + "/socket.io/socket.io.js");
  assert.ok(r.ok, `register status ${r.status}`);
  assert.match(r.headers.get("content-type"), /javascript/);
});

test("every audio library track is a real playable mp3", async () => {
  const { tracks } = await (await fetch(B + "/api/audio/search", { headers: { cookie } })).json();
  assert.equal(tracks.length, 8);
  for (const t of tracks) {
    const r = await fetch(B + t.url);
    assert.equal(r.status, 200, t.url);
    assert.equal(r.headers.get("content-type"), "audio/mpeg");
    assert.ok((await r.arrayBuffer()).byteLength > 100000, t.url);
  }
});
