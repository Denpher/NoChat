# Security Checklist — NoChat v3.3.1

| Item | Status | Value / Notes |
|------|--------|---------------|
| og:image | Done | https://nochat.com/og-image.png (1200×630), served from `/og-image.png` |
| og:title | Done | NoChat - Humans. Not Algorithms. |
| og:description | Done | NoChat is a place for real humans. No fake likes, no ads, no algorithm deciding what you see. |
| twitter:card | Done | summary_large_image |
| HSTS | Done | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (server + helmet) |
| Force HTTPS | Done | Production redirects HTTP → HTTPS via `x-forwarded-proto` |
| X-Content-Type-Options | Done | nosniff |
| X-Frame-Options | Done | SAMEORIGIN |
| Cookie | Done | httpOnly, sameSite=lax, secure on HTTPS |
| JWT | Done | Stable `JWT_SECRET` required in production; session version for revoke |
| SPF (email) | Recommended | TXT `@` → `v=spf1 include:_spf.google.com ~all` |
| DKIM | Recommended | Publish selector TXT from your ESP (e.g. Google Workspace / Postmark); enable signing on outbound |
| SSH | Ops | PasswordAuthentication no; PermitRootLogin no; key-only |
| PWA | Done | manifest.webmanifest, icons, theme-color |
| TURN secrets | Done | Never sent to browser; temporary credentials only |
| Founder video manage | Done | Server-side fingerprint + password + role; FOUNDER_EMAIL cannot grant |
| CSP | Optional | Disabled in helmet for embed flexibility; tighten if needed |

## DNS TXT examples

```
; SPF
@  TXT  "v=spf1 include:_spf.google.com ~all"

; DKIM (example — replace with your ESP values)
google._domainkey  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
```
