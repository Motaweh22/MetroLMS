# MetroLMS — Frontend Security, XSS Prevention & Role Hardening Baseline (`D-SEC-01`)

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Frontend security baseline (`D-SEC-01`), XSS prevention across all 11 content surfaces, DOMPurify sanitization policy, Content Security Policy (`Content-Security-Policy-Report-Only`), Trusted Types assessment, session/CSRF transport security (`D-AUTH-01`), role hardening invariants (`INV-R1`–`INV-R10`), and the 11 Developer Confidentiality surfaces (`MFR-39`).
> **Last Updated:** 2026-11-07 (`CP-001`)
> **Supersedes:** Security/XSS fragments distributed across historical SUP-01 reports and ad-hoc checklist notes.

---

## 1. Security Governance Principle

Per Owner Decision **`D-SEC-01`**, MetroLMS adopts a **defense-in-depth web application security posture** tailored to a React 19 Single-Page Application backed by Django and Microsoft SQL Server:

1. **Client-Side Controls Are UX & Defense-in-Depth Only:** Frontend route guards (`RequireAuth`, `RequireRole`), role visibility filters, and capability selectors prevent accidental UI exposure, but **all authorization and data access rules are enforced server-side by Django**.
2. **Safe Rendering by Default:** React JSX auto-escaping is the mandatory default for all dynamic text, titles, names, and metadata.
3. **Strict Sanitization for Rich HTML:** Whenever rich HTML rendering is genuinely required, input must pass through a central, strictly configured **DOMPurify** utility before rendering.
4. **No Over-Engineered Browser Cryptography:** Browser-side WebCrypto session encryption (`AES-GCM`), IndexedDB key stores, and HSM/KMS lease protocols (`S8`) are permanently excluded from the active architecture (`Decision C: S8 -> S7`).

---

## 2. Eleven Content Surfaces & XSS Prevention Matrix (`D-SEC-01`)

Every content surface in `frontend/src/` must adhere to the rendering and sanitization rules below. This matrix is audited and enforced in **Remaining Frontend Phase 3 (`Security, XSS & Role Hardening`)**:

| # | Content Surface | Required Rendering Mode | Allowed Sink / Component | Mandatory Sanitization & Validation Policy |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Course descriptions** | Plain text JSX interpolation by default; sanitized rich HTML only where rich formatting is explicitly supported | Standard JSX `{course.description}` or centralized `<SanitizedHtml />` | Strip `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, SVG scripts, and all inline `on*` event attributes. |
| **2** | **Lesson content** | Structured lesson blocks (`video`, `pdf`, `quiz`, `text`, `assignment`) + sanitized rich text notes | `<LessonViewer />` / `<SanitizedHtml />` | Rich text notes sanitized via DOMPurify allowlist; media embeds restricted to validated URL schemes (`https:`, `blob:` for local preview). |
| **3** | **Discussion posts** | Safe JSX text rendering (or sanitized Markdown/HTML if enabled) | `<DiscussionThread />` JSX text nodes | Never pass raw trainee/lecturer post bodies into `dangerouslySetInnerHTML`, `innerHTML`, or `document.write`. |
| **4** | **Comments** | Safe JSX text rendering | `<CommentList />` JSX text nodes | Rendered strictly as escaped text nodes (`{comment.body}`); zero HTML tags interpreted. |
| **5** | **Announcements** | Safe JSX text rendering | Announcement cards / banners | Escaped JSX text rendering for titles and bodies. |
| **6** | **User-generated content (profiles, bios, group names, quiz answers, rejection reasons)** | Safe JSX text rendering | Standard JSX `{value}` | Strictly escaped text nodes across trainee dashboards, grading views, and admin audit tables. |
| **7** | **File names and upload metadata** | Safe JSX text rendering + attribute validation | `<FileAttachment />` / upload dropzones | Render file names via JSX `{file.name}`; strip path traversal sequences (`../`, `..\\`); validate `Content-Disposition` / download `download={safeFileName}` attributes. |
| **8** | **External links** | Validated `href` protocol allowlist | `<SafeExternalLink />` or validated `<a href>` | Reject `javascript:`, `data:`, `vbscript:`, and `file:` URLs. Allow only `https://`, `http://`, `mailto:`, `tel:`, or app-relative paths (`/`, `#`). Always enforce `rel="noopener noreferrer"` when `target="_blank"` is used. |
| **9** | **Dynamic DOM operations** | React declarative state only | React 19 refs (`useRef`) for focus/scroll/measurement only | Prohibit raw `.innerHTML`, `.outerHTML`, `insertAdjacentHTML`, `document.write`, `eval()`, `new Function()`, and string-based `setTimeout`/`setInterval`. |
| **10** | **Rich-text rendering** | Centralized sanitizer wrapper | `frontend/src/utils/sanitizeHtml.ts` (DOMPurify) | Single shared configuration; prohibit ad-hoc `dangerouslySetInnerHTML={{ __html: raw }}` anywhere else in `frontend/src/`. |
| **11** | **Third-party dependencies** | Minimal audited dependency tree | `package.json` / Vite bundle | Only trusted, maintained packages (`react`, `react-dom`, `lucide-react`, `dompurify`). No unvetted rich-text or markdown plugins that bypass sanitization. |

---

## 3. DOMPurify Sanitization Specification

When rich HTML rendering is required, it must be routed exclusively through a centralized sanitizer utility:

- **Allowed Tags:** `p`, `br`, `b`, `i`, `em`, `strong`, `u`, `s`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `a`, `span`, `div`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `hr`.
- **Allowed Attributes:** `href`, `title`, `target`, `rel`, `class`, `dir`, `lang`, `colspan`, `rowspan`.
- **Forbidden Tags (Explicitly Blocked):** `script`, `style`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `form`, `input`, `button`, `select`, `textarea`, `meta`, `link`, `base`, `svg`, `math`.
- **Forbidden Attributes:** All `on*` event handlers (`onerror`, `onload`, `onclick`, `onmouseover`, etc.), `style` (inline CSS injection), `srcdoc`, `formaction`, `xlink:href`.
- **URI Hook:** Enforce `ALLOWED_URI_REGEXP` permitting only `https?:`, `mailto:`, `tel:`, and relative URLs; force `rel="noopener noreferrer"` on all `<a>` elements with `target="_blank"`.

---

## 4. Content Security Policy (CSP) & Trusted Types Baseline (`D-SEC-01`)

### 4.1 Progressive CSP Rollout (`Report-Only` $\rightarrow$ Enforced)

MetroLMS starts with a `Content-Security-Policy-Report-Only` header delivered by Django (and mirrored in Vite development/preview configuration where applicable) before switching to enforced `Content-Security-Policy`:

```http
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  media-src 'self' blob: https:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
```

### 4.2 Trusted Types Assessment

- **Target:** Evaluate `require-trusted-types-for 'script'; trusted-types dompurify default;` compatibility with React 19 and Vite.
- **Rule:** If third-party libraries or browser dev tools require untrusted script/HTML assignments during development, keep Trusted Types in `Content-Security-Policy-Report-Only` and ensure all application code uses either standard React JSX nodes or the `dompurify` policy wrapper.

---

## 5. Session, Cookie & CSRF Security (`D-AUTH-01`)

Full protocol details are defined in [`authentication-and-session-contract.md`](authentication-and-session-contract.md). The mandatory security controls are:

1. **Zero Access/Session Tokens in Web Storage:** Session credentials are never stored in `localStorage`, `sessionStorage`, or IndexedDB.
2. **HttpOnly Session Cookie:** `sessionid` is `HttpOnly`, `Secure` (in HTTPS), and `SameSite=Lax` — completely inaccessible to `document.cookie` if an XSS vulnerability ever occurred.
3. **CSRF Token Enforcement:** Every unsafe HTTP request (`POST`, `PUT`, `PATCH`, `DELETE`) attaches `X-CSRFToken` read from the `csrftoken` cookie.
4. **Epoch-Bound Client Cache Invalidation (`S7`):** All local UI drafts and staged edits are keyed by `sessionEpoch` (`metro_lms_session_epoch_v1`) and purged deterministically on logout, `401 Unauthorized`, or role test session switches.

---

## 6. Six-Tier Role Hardening Invariants (`INV-R1` – `INV-R10`)

Implemented across **Remediation Phases 2, 3, and 4** and enforced permanently in both the frontend store and future Django backend:

| Invariant ID | Rule Specification | Remediation Reference |
| :--- | :--- | :--- |
| **`INV-R1`** | `Developer` accounts cannot be created via any UI or public API endpoint (CLI/management-command bootstrap only). | `MFR-38`, Phase 2 |
| **`INV-R2`** | No user can assign, promote, or demote any account to or from the `Developer` role via UI or API. | `MFR-38`, Phase 2 |
| **`INV-R3`** | `Developer` accounts cannot be deleted, suspended, or deactivated via UI or API. | `MFR-38`, Phase 2 |
| **`INV-R4`** | `Protected Admin` (`isProtectedAdmin: true`) cannot be deleted, demoted, or deactivated by `Developer` or peer `Admin` accounts. | `MFR-38`, Phase 2 |
| **`INV-R5`** | `Admin` can create/edit/delete regular `Admin`, `Superior`, `Assistant Admin`, `Lecturer`, and `Trainee` accounts, but is blocked from mutating `Developer` or `Protected Admin` accounts. | `MFR-38`, Phase 2 |
| **`INV-R6`** | **Super Admin / Superior Authority & Anti-Self-Dealing / Peer Read-Only (`OD-01`, `MFR-37`, `2026-11-13` Reconciliation)** | `Super Admin` (`super_admin`, also referred to as `Superior`) is **NOT** a read-only observer: per Owner Clarification (`2026-11-13`) and `OD-01`, `super_admin` inherits **all** `admin` capabilities plus exclusive non-Developer `admin` appointment authority, while peer `super_admin` visibility is read-only (`OD-01` / `INV-R2`) and anti-self-dealing invariants prevent actors from self-escalating or self-mutating protected roles. *(Reconciles earlier `INV-R6` text that erroneously generalized `OD-01` peer read-only visibility into a read-only `Superior` role.)* | `MFR-37`, `OD-01`, Owner Clarification `2026-11-13` |
| **`INV-R7`** | `Assistant Admin` has **global read visibility** across users, groups, courses, enrollments, and activity logs (`Rule A` + `D-14`), while **writes are strictly scoped** to assigned groups (`GroupAssistantAssignment`). | `MFR-05`, `MFR-06`, `D-14`, Phase 3 |
| **`INV-R8`** | `Developer` identity is **strictly invisible** to all non-Developer roles across all 11 confidentiality surfaces (`MFR-39`). | `MFR-39`, Phase 2 |
| **`INV-R9`** | By default, sensitive `Assistant Admin` mutations (`user_delete`, `group_delete`, `enrollment_remove`, `grade_override`, `certificate_revoke`, `course_unpublish`) enter `PendingApproval` (`202 Accepted`) unless an explicit per-assistant or per-group bypass flag is enabled by `Admin`. | `MFR-35`, `MFR-44`, Phase 4 |
| **`INV-R10`** | Executing an approved `PendingApprovalRequest` re-validates target existence, scope permissions, and role invariants (`INV-R1`–`INV-R8`) at execution time; stale or out-of-scope requests fail with `ExecutionFailed`. | `MFR-44`, Phase 4 |

---

## 7. Eleven Developer Confidentiality Surfaces (`MFR-39` / `INV-R8`)

When the authenticated actor's true role is anything other than `Developer` (or when a `Developer` is operating in Visual Role Preview / Isolated Role Test Session as a non-Developer role), `Developer` accounts and `Developer`-authored actions must be stripped from all **11 surfaces**:

1. **User Directory & User Management Tables** (`UsersPage`, user lists, role filters).
2. **Dashboard KPIs & Aggregate Headcounts** (total user counts, active user metrics, role breakdown charts).
3. **Group Member Lists & Assignment Pickers** (group roster modals, assistant/lecturer assignment dropdowns).
4. **Course Author / Instructor Attribution** (if a `Developer` created or edited a course, display neutral system/admin attribution to non-Developers).
5. **Audit Logs & Activity Feeds** (`ActivityLogEntry` rows where actor or target is a `Developer`).
6. **Approval Queue & Review Histories** (`PendingApprovalRequest` reviewer/requester references).
7. **Global Search & Autocomplete Results** (header search, mention pickers, user filters).
8. **Discussion Threads & Comment Lists** (author badges/profiles if authored by a `Developer` in non-isolated mode).
9. **Analytics & CSV/PDF Report Exports** (`ReportsPage` tables and downloadable exports).
10. **Notification Payloads & Senders** (`Notification` items referencing a `Developer` actor).
11. **Direct API / Store Lookup Selectors** (`getUserById(id)` returns `undefined` / `404 Not Found` — never `403 Forbidden` — when a non-Developer queries a `Developer` user ID, preventing ID enumeration).

