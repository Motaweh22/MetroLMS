# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-001` — Django Server-Side Sessions & Cookie Security

> **Document Title:** Django Server-Side Sessions and Browser Cookie Transport  
> **Document Identifier:** `METROLMS-ADR-CORE-001`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), Decision C (`S8 -> S7` Session Timeout Fallback)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
Early platform drafts and frontend mocks considered issuing JSON Web Tokens (JWT) stored in browser `localStorage` or `sessionStorage`. However, storing authentication tokens in browser client storage exposes session credentials to Cross-Site Scripting (XSS) extraction, prevents immediate server-side session revocation upon administrative termination, and introduces complex token refresh synchronization across browser tabs.

## 2. Decision Drivers
- **Security:** Elimination of credential theft risks via XSS.
- **Revocability:** Immediate server-side invalidation of compromised sessions across all devices.
- **Standardization:** Alignment with established Django session authentication and CSRF defense patterns.
- **Reliability:** Transparent session continuity across page reloads without client-side token renewal timers.

## 3. Considered Options
- **Option 1: Browser-Stored Bearer JWTs:** JWTs in `localStorage` or `sessionStorage` with refresh tokens.
- **Option 2: Django Server-Side Sessions with HttpOnly Cookies (Chosen):** Session state stored in server database; session identifier transported strictly via `HttpOnly`, `Secure`, `SameSite` cookies.
- **Option 3: WebCrypto In-Browser Encrypted Sessions:** Client-side cryptographic session storage.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Django Server-Side Sessions with HttpOnly Cookies)**.
- **Governing Authority:** Level 1 Owner Decision [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01).

## 5. Pros and Cons of the Options
### Option 2 (Django Server-Side Sessions — Chosen)
- **Positive:** Inaccessible to JavaScript; immune to direct token extraction via XSS.
- **Positive:** Instant server-side revocation on logout, password reset, or administrative account suspension.
- **Positive:** Built-in Django session management with SQL Server backend integration.
- **Negative:** Requires stateful session storage on the server tier (managed cleanly in SQL Server).

### Option 1 (Browser Bearer JWTs — Rejected)
- **Negative:** Vulnerable to script extraction if XSS occurs.
- **Negative:** Cannot immediately revoke JWTs before expiration without maintaining a distributed denylist.

## 6. Implementation Notes & Consequences
- Browser clients authenticate via `POST /api/v1/auth/login/` and receive `sessionid` and `csrftoken` cookies.
- All state-mutating HTTP requests must transmit `X-CSRFToken` header matching the cookie.
- Browser `localStorage` and `sessionStorage` are strictly prohibited from storing authentication credentials.
