# MetroLMS — Use Case Specification
## Use Case Identifier: `UC-[ROLE]-[NNN]` — [Use Case Name]

> **Document Title:** [Use Case Title]  
> **Document Identifier:** `METROLMS-UC-[ROLE]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 4 Use Case Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Functional Analysts, UI Designers, QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Use Case Summary
- **Primary Actor:** [Trainee / Lecturer / Assistant Admin / Admin / Supervisor / Auditor].
- **Goal in Context:** [What the actor intends to accomplish].
- **Trigger:** [Direct navigation, button click, notification arrival].
- **Preconditions:**
  1. User is authenticated with an active session (`D-AUTH-01`).
  2. User holds required permission capability [e.g., `manage_courses`].
- **Postconditions (Success):**
  1. System state is mutated and persisted in SQL Server.
  2. User receives immediate UI confirmation and updated view.
- **Postconditions (Failure):**
  1. State remains unchanged (transaction rollback).
  2. Descriptive error message presented to user.

## 2. Main Success Scenario (Happy Path)
1. Actor navigates to [Target Surface].
2. System displays [Current State / Input Form].
3. Actor enters [Required Data] and clicks [Action Button].
4. System validates inputs against business rules [Rule Reference].
5. System executes transaction and records audit log.
6. System displays success state [Updated View / Notification].

## 3. Alternative & Exceptional Flows
- **3a. Validation Error:**
  - 1. System detects missing or invalid fields.
  - 2. System highlights defective fields with inline error messages.
  - 3. Actor corrects input and re-submits.
- **3b. Invariant Violation (e.g., Passing Gate Unmet):**
  - 1. System determines prerequisite lesson or quiz is incomplete.
  - 2. System blocks action and displays prerequisite explanation banner.
- **3c. Concurrency Collision:**
  - 1. Record was updated concurrently by another actor.
  - 2. System rejects write with optimistic concurrency error (`409 Conflict`).

## 4. Special Requirements & UI Considerations
- **RTL Layout:** UI components conform to Arabic right-to-left layout tokens.
- **Mobile Responsiveness:** View adapts cleanly to tablet and smartphone displays.
