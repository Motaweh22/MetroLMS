# Metro Courses LMS

Modern Learning Management System (LMS) designed for the Cairo Metro Training Institute, featuring role-based workspaces for Students, Lecturers, Supervisors, and Administrators.

---

## 1. Project Overview & Architecture

Metro Courses LMS has transitioned from its original Vanilla JavaScript proof-of-concept into a modern, enterprise-ready React application.

### Active Application (`frontend/`)
The primary active codebase is located in [`frontend/`](./frontend/). It is built with:
- **Framework & Tooling:** [React 19](https://react.dev/), [Vite 6](https://vitejs.dev/), [TypeScript 5.7](https://www.typescriptlang.org/)
- **UI & Design System:** Custom vanilla CSS design system with CSS custom properties, responsive navigation, glassmorphic surfaces, and accessible tokens
- **Icons & Visuals:** [Lucide React](https://lucide.dev/)
- **State Management & Routing:** Modular feature-driven architecture with in-memory mock stores, RBAC guards, and client-side routing
- **Testing:** [Vitest](https://vitest.dev/), React Testing Library, and `@testing-library/user-event` (1,174 tests across 66 test suites)

### Current Status
- **Frontend:** Feature-complete through Increment 11 (including Student Portal, Lecturer Workspace, Course Builder, Admin & Supervisor Reviews, Analytics, Attendance, User Directory, RBAC guards, and Course Performance tracking).
- **Backend & Database:** The production relational database schema and architecture have been designed and validated (3NF relational schema, comprehensive Chen & Crow's Foot ER diagrams, and security architecture). **Backend implementation and database migration have not yet commenced** (planned for future increments).

---

## 2. Directory Structure

```text
D:\LMS MEtro Project\
├── .git/                  # Git repository history, tracking, and refs
├── .gitignore             # Root ignore rules (node_modules, dist, caches)
├── README.md              # Project entry point and developer guide (this file)
├── frontend/              # ACTIVE: Modern React application
│   ├── public/            # Static assets and media fixtures
│   ├── src/               # Application source code
│   │   ├── app/           # App root, providers, and layout shells
│   │   ├── core/          # Authentication, RBAC, routing, navigation guards
│   │   ├── features/      # Feature slices (courses, builder, review, admin, etc.)
│   │   ├── mocks/         # InMemoryStore and mock handlers
│   │   ├── pages/         # Route page components
│   │   ├── shared/        # Reusable UI components, hooks, config, utilities
│   │   └── test/          # Vitest suites and testing utilities
│   ├── eslint.config.js   # ESLint 9 flat configuration
│   ├── index.html         # Application HTML template
│   ├── package.json       # Dependencies, scripts, and project metadata
│   ├── package-lock.json  # Deterministic dependency lockfile
│   ├── tsconfig*.json     # TypeScript project configurations
│   └── vite.config.ts     # Vite bundler and path alias configuration
├── docs/                  # ARCHITECTURE & SPECIFICATIONS
│   ├── frontend/          # Frontend architecture, design system, audits, roadmaps
│   │   ├── checklists/    # Increment-by-increment test checklists
│   │   └── ...            # Audit reports, parity logs, performance analysis
│   └── backend/           # Database schema, ERDs, and architecture specifications
│       ├── database-schema.md # Complete relational schema (3NF, 42 tables, data dictionary)
│       ├── erd.md             # Crow's Foot ERDs and domain relationship diagrams
│       ├── erd-chen.md        # Classic Chen-notation ERD deliverable
│       └── diagrams/          # Diagram sources (.drawio, .mmd) and vector/raster exports (.svg, .png)
└── legacy-reference/      # READ-ONLY: Original Vanilla JS prototype files
    ├── app.html           # Prototype application entry point
    ├── index.html         # Prototype landing page
    ├── js/                # Legacy JavaScript modules
    ├── css/               # Legacy stylesheet
    ├── data/              # Legacy JSON fixtures
    ├── assets/            # Legacy logos and graphics
    ├── course-library/    # Static course demo media
    └── README.md          # Reference notice and directory documentation
```

---

## 3. Getting Started with the Frontend

All development activities are performed from the `frontend/` directory.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` (bundled with Node.js)

### Installation
Restore dependencies deterministically using the repository's lockfile:

```powershell
cd "D:\LMS MEtro Project\frontend"
npm ci
```

### Development Server
Start the local Vite development server with hot-module replacement (HMR):

```powershell
npm run dev
```

### Running Tests
Execute the full Vitest suite (1,174 tests across 66 test suites):

```powershell
# Run the complete test suite once
npm test -- --run

# Run in watch mode during development
npm test
```

### Linting
Validate TypeScript code quality and style using ESLint:

```powershell
npm run lint
```

### Production Build
Type-check and bundle the application for production deployment:

```powershell
npm run build
```

The compiled output will be generated into `frontend/dist/`.

---

## 4. Documentation Guide

Comprehensive specifications and architecture documentation are located in [`docs/`](./docs/):

- **Frontend Specifications (`docs/frontend/`):**
  - Architecture and UI component roadmaps.
  - Increment-by-increment verification checklists and audit logs.
  - RBAC permission matrices and route authorization rules.
- **Backend Architecture & Database Design (`docs/backend/`):**
  - [`database-schema.md`](./docs/backend/database-schema.md): Complete relational database specification with 42 tables in 3NF, data dictionary, indexing strategy, audit logging, and foreign key constraints.
  - [`erd.md`](./docs/backend/erd.md): Crow's Foot ERDs for all 5 functional domains.
  - [`erd-chen.md`](./docs/backend/erd-chen.md): Formal Chen-notation ER diagrams with entities, attributes, relationships, and cardinalities.
  - [`diagrams/`](./docs/backend/diagrams/): Standalone, editable Draw.io files (`.drawio`), Mermaid definitions (`.mmd`), high-resolution vector SVGs, and full-system poster exports (`erd-chen-full-system.png`).

---

## 5. Legacy Reference Directory

The [`legacy-reference/`](./legacy-reference/) directory contains the original Vanilla JavaScript, HTML, and Python prototype of Metro Courses LMS.

- **Purpose:** Retained strictly as a read-only historical reference for feature parity audits, business rule verification, and UI comparison.
- **Strict Constraint:** Do not add new features, fix bugs, or build upon legacy files. All current and future development is centered in `frontend/` and future backend directories.

---

## 6. Next Steps & Roadmap

- **Completed:** Increments 1 through 11 (complete React frontend, full test coverage, database schema design, and standalone ERD deliverables).
- **Relocation:** Successfully organized into `D:\LMS MEtro Project`.
- **Pending (Increment 12+):** Production backend development, REST/GraphQL API implementation, PostgreSQL/MySQL database migrations, and real-time media/session management.
