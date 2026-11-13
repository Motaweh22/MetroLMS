# MetroLMS — REST API Contract Specification
## Domain / Resource: [Resource Name]

> **Document Title:** [API Spec Title]  
> **Document Identifier:** `METROLMS-API-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 5 API Integration Contract  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend DRF Developers, Frontend React Integrators, QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Endpoint Overview
- **Base Path:** `/api/v1/[resource]`
- **Authentication:** Session Cookie (`sessionid`, `D-AUTH-01`).
- **CSRF Protection:** Required on state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).

## 2. Endpoint Definitions
### 2.1 `GET /api/v1/[resource]/`
- **Description:** [List resources with optional filtering and pagination].
- **Required Capabilities:** `[capability_name]`
- **Query Parameters:**
  | Parameter | Type | Required? | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | Integer | No | Page number (default: 1) |
  | `page_size` | Integer | No | Page size (default: 20, max: 100) |
- **Response Headers:** `Content-Type: application/json; charset=utf-8`
- **Response Body (`200 OK`):**
  ```json
  {
    "count": 1,
    "next": null,
    "previous": null,
    "results": [
      {
        "id": "res_001",
        "title": "Sample Resource",
        "status": "active",
        "createdAt": "2026-11-12T00:00:00Z"
      }
    ]
  }
  ```

### 2.2 `POST /api/v1/[resource]/`
- **Description:** [Create a new resource].
- **Required Capabilities:** `[capability_name]`
- **Request Body:**
  ```json
  {
    "title": "New Resource",
    "status": "draft"
  }
  ```
- **Responses:**
  - `201 Created`: Returns newly created resource representation.
  - `400 Bad Request`: Validation failure details.
  - `401 Unauthorized`: Missing or invalid session cookie.
  - `403 Forbidden`: Insufficient role permissions.
