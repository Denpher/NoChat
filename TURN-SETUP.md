# Calls: STUN + TURN relay setup (NoChat v3.3)

NoChat calls are real peer-to-peer WebRTC calls signalled over the existing Socket.IO connection
(`call:invite`, `call:accept`, `call:signal` with offer / answer / ICE candidates, `call:end`).
STUN lets two browsers discover their public addresses. **TURN relays the media when a direct
connection is impossible** (strict NAT, mobile carriers, corporate firewalls). Without TURN, some
calls will fail. NoChat never pretends otherwise:

* `GET /api/calls/config` (signed-in users only) returns `turn.status`: `ready`, `unavailable`
  (configured but the provider failed — the call falls back to STUN and says so) or `not-configured`.
* `GET /api/health` shows `turnMode` (`rest`, `cloudflare`, `metered`, `static`, `none`).
* During a call the screen shows the real route chosen by ICE: *Connected via TURN relay · UDP/TCP/TLS*,
  *Connected directly (STUN)* or *Connected directly (local network)*.
* Settings → **Call connectivity → Test connection** gathers relay-only candidates from the user's
  browser and reports which TURN transports are reachable from that network.

v3.2 silently added the shared public "openrelayproject" credentials and reported `turnConfigured: true`.
That has been removed: it was not your relay, not guaranteed to work, and it hid the real state.

## Choose ONE option and add its variables in Render → Environment

### Option A — your own coturn server (recommended; temporary credentials)
coturn `turnserver.conf`:
```
listening-port=3478
tls-listening-port=5349
fingerprint
use-auth-secret
static-auth-secret=<LONG_RANDOM_SECRET>
realm=turn.yourdomain.com
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
no-cli
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
```
Open UDP+TCP 3478, TCP 5349 and the relay UDP range (default 49152–65535) on the server firewall.
Render variables:
```
TURN_SECRET=<same LONG_RANDOM_SECRET>
TURN_URLS=turn:turn.yourdomain.com:3478?transport=udp,turn:turn.yourdomain.com:3478?transport=tcp,turns:turn.yourdomain.com:5349?transport=tcp
TURN_TTL_SECONDS=3600
```
NoChat signs `username = <expiry>:<hashed user id>` with HMAC-SHA1 (TURN REST API). The secret never
leaves the server; browsers get credentials that expire after `TURN_TTL_SECONDS`.

### Option B — Cloudflare Realtime TURN (managed)
Create a TURN key in the Cloudflare dashboard (Realtime → TURN Server), then set
`CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN`. NoChat calls
`POST https://rtc.live.cloudflare.com/v1/turn/keys/<id>/credentials/generate-ice-servers` for each
call and passes only the short-lived credentials to the browser. Cloudflare supports UDP, TCP and TLS (443).

### Option C — Metered.ca TURN (managed)
Set `METERED_TURN_DOMAIN` (e.g. `yourapp.metered.live`) and `METERED_TURN_API_KEY`. The API key stays on
the server; NoChat fetches the ICE server list per call.

### Legacy — static credential
`TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` still work, but the same long-lived password is sent to every
signed-in caller. NoChat labels this `credentialType: static`. Prefer A, B or C.

## Verifying across real networks (must be done by you)
1. Deploy with one option configured; open `/api/health` → `turnMode` is not `none`.
2. Settings → Call connectivity → Test connection on Wi-Fi and on mobile data: each listed transport
   should say *reachable*.
3. Temporarily set `TURN_FORCE_RELAY=true`, redeploy, call between a phone on mobile data and a laptop on
   another Wi-Fi: the call screen must say *Connected via TURN relay*. Set it back to `false` afterwards.
4. Without TURN configured, the call screen says *No relay configured — STUN only*.

No TURN provider or credentials were available while building v3.3, so **relay traffic across real
networks has not been tested here**. The credential generation, provider handling, fallback reporting
and Socket.IO signalling are covered by `tests/turn.test.js`.
