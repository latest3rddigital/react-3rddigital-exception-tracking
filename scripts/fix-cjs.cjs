#!/usr/bin/env node

/**
 * Copies the CommonJS build output (dist-cjs/index.js) to dist/index.cjs
 * and removes the temporary dist-cjs directory.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const cjsSource = path.join(rootDir, "dist-cjs", "index.js");
const cjsDest = path.join(rootDir, "dist", "index.cjs");
const cjsDir = path.join(rootDir, "dist-cjs");

if (!fs.existsSync(cjsSource)) {
  console.error(`CJS build output not found: ${cjsSource}`);
  process.exit(1);
}

fs.copyFileSync(cjsSource, cjsDest);
fs.rmSync(cjsDir, { recursive: true, force: true });

console.log("CJS build copied to dist/index.cjs");
