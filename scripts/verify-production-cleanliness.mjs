#!/usr/bin/env node
/**
 * Production Artifact Cleanliness Scanner (MFR-45 / Gate B)
 *
 * GOVERNANCE DIRECTIVE:
 * This script verifies that the compiled production distribution directory
 * (default: frontend/dist) contains zero synthetic Developer or Super Admin
 * fixture fingerprints, test credentials, or prohibited synthetic identifiers.
 *
 * PROHIBITED FIXTURE FINGERPRINTS:
 * 1. USR_DEV_001 (Synthetic Developer User ID)
 * 2. developer.metro@internal.local (Synthetic Developer Email)
 * 3. مطور النظام (Synthetic Developer Persona Name)
 * 4. USR_SUPER_001 (Synthetic Super Admin User ID)
 * 5. superadmin@cairo-metro.com (Synthetic Super Admin Email)
 *
 * NOTE ON LEGITIMATE DOMAIN STRINGS:
 * This scanner explicitly targets exact synthetic fixture identifiers.
 * Legitimate generic strings such as the role names "developer" and "super_admin",
 * capability keys, or policy definitions are NOT flagged as violations.
 *
 * EXECUTION DIRECTIVE:
 * Per Owner Directive Part A, this script is to be executed ONLY after the
 * production build in Phase 13 / Gate B verification.
 * DO NOT execute during development or Phase 2 increments.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PROHIBITED_FINGERPRINTS = [
  // ── Developer Persona Distinctive Fixture Fingerprints ──────────────────────
  { pattern: /USR_DEV_001/i, name: 'Developer Fixture ID / Alias (USR_DEV_001 / usr_dev_001)' },
  { pattern: /developer_internal/i, name: 'Developer Fixture Username (developer_internal)' },
  { pattern: /developer\.metro@internal\.local/i, name: 'Developer Fixture Email (developer.metro@internal.local)' },
  { pattern: /مطور النظام/u, name: 'Developer Fixture Name (مطور النظام)' },
  { pattern: /(?<!2)01000000000(?!\d)/, name: 'Developer Fixture Phone Number (01000000000)' },
  { pattern: /كبير مهندسي النظام/u, name: 'Developer Fixture Job Title (كبير مهندسي النظام)' },
  { pattern: /هندسة البرمجيات والتطوير/u, name: 'Developer Fixture Department (هندسة البرمجيات والتطوير)' },

  // ── Super Admin Persona Distinctive Fixture Fingerprints ───────────────────
  { pattern: /USR_SUPER_001/i, name: 'Super Admin Fixture ID / Alias (USR_SUPER_001 / usr_super_001)' },
  { pattern: /super_admin_demo/i, name: 'Super Admin Fixture Username (super_admin_demo)' },
  { pattern: /superadmin@cairo-metro\.com/i, name: 'Super Admin Fixture Email (superadmin@cairo-metro.com)' },
  { pattern: /ياسين رضوان/u, name: 'Super Admin Fixture Persona Name (م. ياسين رضوان)' },
  { pattern: /(?<!\d)01000000001(?!\d)/, name: 'Super Admin Fixture Phone Number (01000000001)' },
  { pattern: /المسؤول الأعلى للأنظمة/u, name: 'Super Admin Fixture Job Title (المسؤول الأعلى للأنظمة)' },
];

/**
 * Recursively scans a directory for files.
 * @param {string} dir 
 * @param {string[]} [fileList] 
 * @returns {string[]}
 */
export function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Scans a target directory for prohibited fixture fingerprints.
 * @param {string} targetDir 
 * @param {object} [options]
 * @returns {{ clean: boolean, scannedCount: number, violations: Array<{ file: string, rule: string, line: number, snippet: string }> }}
 */
export function scanDirectory(targetDir, options = {}) {
  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    return {
      clean: false,
      scannedCount: 0,
      violations: [
        {
          file: resolvedDir,
          rule: 'Target Directory Not Found',
          line: 0,
          snippet: `Directory does not exist: ${resolvedDir}. Ensure production build has executed.`,
        },
      ],
    };
  }

  const files = getAllFiles(resolvedDir);
  const violations = [];
  let scannedCount = 0;

  for (const filePath of files) {
    // Only inspect text/web assets: js, mjs, cjs, css, html, map, txt, json
    const ext = path.extname(filePath).toLowerCase();
    if (!['.js', '.mjs', '.cjs', '.css', '.html', '.map', '.txt', '.json'].includes(ext)) {
      continue;
    }

    scannedCount++;
    const content = fs.readFileSync(filePath, 'utf8');

    for (const { pattern, name } of PROHIBITED_FINGERPRINTS) {
      if (pattern.test(content)) {
        // Find line number and excerpt
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            violations.push({
              file: path.relative(resolvedDir, filePath),
              rule: name,
              line: i + 1,
              snippet: lines[i].trim().slice(0, 120),
            });
            break;
          }
        }
      }
    }
  }

  return {
    clean: violations.length === 0,
    scannedCount,
    violations,
  };
}

// CLI entry point
const isDirectCli = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

if (isDirectCli) {
  const target = process.argv[2] || path.resolve(process.cwd(), 'frontend/dist');
  console.log(`\n============================================================`);
  console.log(`MetroLMS — Production Bundle Cleanliness Scanner (MFR-45)`);
  console.log(`Scanning target: ${target}`);
  console.log(`============================================================\n`);

  const result = scanDirectory(target);

  console.log(`Scanned ${result.scannedCount} production asset(s).`);

  if (result.clean) {
    console.log(`\x1b[32m✔ SUCCESS: Zero prohibited fixture fingerprints found.\x1b[0m\n`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m✖ FAILURE: Prohibited fixture fingerprint(s) detected in production bundle!\x1b[0m\n`);
    for (const v of result.violations) {
      console.error(`  [!] ${v.rule}`);
      console.error(`      File: ${v.file}:${v.line}`);
      console.error(`      Snippet: ${v.snippet}\n`);
    }
    process.exit(1);
  }
}

