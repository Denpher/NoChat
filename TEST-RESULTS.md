# Verification performed

- 13 Node regression tests passed: login, protected endpoints, restart-safe session, audio MP3s, receipts, owner/admin removal policy, file validation, size limit, daily configuration, and safe production startup.
- Two independent signed-in browsers: actual message sent, unseen then seen, sender deletion reflected for recipient, PDF uploaded/rendered, read-receipt preference saved.
- Cloud storage: actual file PUT, exact bytes read back, cleanup; unauthenticated bridge denied.
- Cloud-backed NoChat: two real quarantined reel uploads, third denied, same account cookie and exact video bytes read after process restart; ordinary user denied moderation review, founder authorized and globally deleted test reel. Test accounts/files were removed afterward.
- Visual AI request: actual sampled JPEG accepted and approved by the configured Gateway model. Frame sampling is not exhaustive moderation.
- Personal video viewer checked at 1280×1800 and 390×844; contained original video and visible actions.
- Desktop sign-in tested at 1280×720: real wheel scrolling changed scrollTop; phone transforms changed over time. Reduced-motion setting respected; mobile sign-up no horizontal overflow.
- Selected soundtrack saved as catalog ID, loaded as local MP3 and advanced in the viewer; original video audio retained when no soundtrack is selected.
- Lovable routing test passed; latest service compilation was successful.

## Not verified / required deployment checks
Render/Vercel accounts were not accessed, and no live redeploy was performed. Published Cloud URL and shared-secret Render configuration are still required. Voice offer/answer and incoming accept worked; the sandbox did not gather ICE candidates, so connected call audio is NOT verified. A configured TURN relay and two real-device/network checks are required. All-device support is not a guarantee: use current browsers; video codec and microphone permissions depend on device/browser. Authentication remains the existing hardened Express cookie login, not a Cloud Auth migration.

# v3.1 verification
- `npm test`: 33 passing (13 existing + 20 new). New: anti-spam thresholds/cooldowns, account
  restrictions, exact session revocation, founder protection, confirmation rules, soft delete,
  badge grants no privileges, moderation confidence gate; plus a live-server flow: non-admins get
  403 on all admin endpoints, search by username and ID, founder protection audited, suspend ->
  existing session rejected -> sign-in refused -> appeal -> restore -> sign-in works, delete hides
  and restore re-lists, flooding returns 429 and is logged and appealable.
- Two real Chromium browsers (fake camera/mic) on loopback: video call invite -> incoming screen ->
  accept -> ICE connected, remote video received, timer running, mute and camera toggles,
  end cleans up on both sides.
- Visual check of sign-in (desktop + phone), chats, settings, admin console and call screen.

## Not verified (v3.1)
- Calls across real networks/devices (sandbox has no external ICE). TURN is still required for
  restrictive networks. Camera switching needs a real two-camera phone.
- The Cloud `moderate` operation's confidence output: if it returns no confidence, uploads are
  quarantined for review instead of auto-removed (safe default).
- No Render deploy was performed.
