# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-004` — Decoupled Enterprise Media Storage Contract

> **Document Title:** Decoupled Enterprise Media Storage and Direct Client Streaming  
> **Document Identifier:** `METROLMS-ADR-CORE-004`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
MetroLMS delivers hundreds of hours of high-definition video lessons for technical rail training. Routing large video binary streams through the Django application server tier causes severe thread blocking, memory consumption, and network saturation, degrading core API responsiveness.

## 2. Decision Drivers
- **API Performance:** Isolation of backend workers from multi-megabyte / gigabyte video file streaming.
- **Scalability:** Ability to support 5,000 concurrent learners streaming videos simultaneously.
- **Storage Flexibility:** Decoupling storage implementation (local NAS, S3-compatible, or enterprise SAN).

## 3. Considered Options
- **Option 1: Application Server File Streaming:** Django serves video files directly via `FileResponse`.
- **Option 2: Decoupled Media Storage with Direct Client Streaming (Chosen):** Video binaries served directly from storage tier or CDN.
- **Option 3: External Public Video Hosting (YouTube / Vimeo):** Unacceptable for proprietary internal safety training.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Decoupled Media Storage with Direct Client Streaming)**.
- **Governing Authority:** Level 1 Owner Decision [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01).

## 5. Pros and Cons of the Options
### Option 2 (Decoupled Storage — Chosen)
- **Positive:** Django application servers handle only lightweight JSON API requests and session validation.
- **Positive:** Web servers / storage tier handle byte-range video streaming (HTTP 206 Partial Content) natively.
- **Negative:** Requires separate media URL signing or dedicated storage endpoint configuration.

## 6. Implementation Notes & Consequences
- Django backend stores media metadata and generates direct signed media URLs.
- Client video player streams binary payloads directly from the media storage endpoint.
- Raw video binaries never traverse the Django application server WSGI pipeline.
