#!/usr/bin/env node
/**
 * Applies i18n hooks and common string replacements to batch A pages.
 * Run from web/: node scripts/apply-i18n-batch-a.mjs
 */
import fs from "fs";
import path from "path";

const pagesDir = path.join(process.cwd(), "src/pages");

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const reactI18n = 'import { useTranslation } from "react-i18next";';
  if (importLine.includes("useTranslation") && content.includes("useTranslation")) return content;
  if (importLine.includes("formatApiMessage") && content.includes("formatApiMessage")) return content;

  const lines = content.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
  }
  lines.splice(lastImport + 1, 0, importLine);
  return lines.join("\n");
}

function ensureHook(content, fnName = "export default function") {
  if (content.includes("const { t } = useTranslation()")) return content;
  const re = new RegExp(`(${fnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\{]*\\{)`);
  return content.replace(re, "$1\n  const { t } = useTranslation();");
}

function patch(file, transforms) {
  const fp = path.join(pagesDir, file);
  let c = fs.readFileSync(fp, "utf8");
  const orig = c;
  for (const t of transforms) c = t(c);
  if (c !== orig) {
    fs.writeFileSync(fp, c);
    console.log("patched", file);
  } else {
    console.log("skip (no changes)", file);
  }
}

// Shared import + hook for all remaining files
const files = [
  "WordTraining.tsx",
  "WordPractice.tsx",
  "PreTrainingCheck.tsx",
  "PostTrainingCheck.tsx",
  "ListenIdentify.tsx",
  "FlashReview.tsx",
  "ReviewCheck.tsx",
  "ReviewWordList.tsx",
  "AntiForgetting.tsx",
  "TrainingRecords.tsx",
  "CoachCenter.tsx",
  "MyStudents.tsx",
  "StudentDetail.tsx",
  "CreateStudent.tsx",
  "CreateCoachingAppointment.tsx",
  "CoachCompletedSessions.tsx",
  "CheckIn.tsx",
  "WordBookWords.tsx",
  "CreateCustomWordBook.tsx",
];

for (const f of files) {
  patch(f, [
    (c) => ensureImport(c, 'import { useTranslation } from "react-i18next";'),
    (c) => ensureHook(c),
  ]);
}

// formatApiMessage for API-heavy pages
for (const f of [
  "PreTrainingCheck.tsx",
  "PostTrainingCheck.tsx",
  "ReviewCheck.tsx",
  "ReviewWordList.tsx",
  "MyStudents.tsx",
  "StudentDetail.tsx",
  "CreateStudent.tsx",
  "CreateCoachingAppointment.tsx",
  "CheckIn.tsx",
  "WordBookWords.tsx",
  "CreateCustomWordBook.tsx",
  "TrainingRecords.tsx",
]) {
  patch(f, [
    (c) => ensureImport(c, 'import { formatApiMessage } from "../utils/apiMessage";'),
  ]);
}

console.log("Done applying hooks/imports");
