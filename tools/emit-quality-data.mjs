#!/usr/bin/env node
/* Emits the expected theme counts from the content records, so check:quality can
   verify the filter bar against the data rather than against itself. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const src = await readFile(join(root, "site", "assets", "js", "bx-data.js"), "utf8");
const sandbox = {};
new Function("window", src)(sandbox);
const D = sandbox.BX_DATA;
const themeCounts = {};
for (const p of D.projects) for (const t of p.themes || []) themeCounts[t] = (themeCounts[t] || 0) + 1;
themeCounts.all = D.projects.length;
await mkdir(join(root, "evidence"), { recursive: true });
await writeFile(join(root, "evidence", "quality-data.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), projects: D.projects.length, themeCounts }, null, 2));
console.log(`wrote evidence/quality-data.json — ${D.projects.length} projects, ${Object.keys(themeCounts).length - 1} themes`);
