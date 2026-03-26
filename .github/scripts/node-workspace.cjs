#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const skipDirs = new Set([
  ".git",
  ".next",
  ".nx",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "tmp",
]);

function die(message) {
  console.error(`\n[node-workspace] ERROR: ${message}\n`);
  process.exit(1);
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findPackageDirs(startDir, depth = 0, found = []) {
  if (depth > 5) return found;

  let entries = [];
  try {
    entries = fs.readdirSync(startDir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || skipDirs.has(entry.name)) continue;
    const dirPath = path.join(startDir, entry.name);
    const packageJsonPath = path.join(dirPath, "package.json");

    if (fs.existsSync(packageJsonPath)) found.push(dirPath);
    findPackageDirs(dirPath, depth + 1, found);
  }

  return found;
}

function detectPackageManager(explicitManager) {
  if (explicitManager) return explicitManager;

  if (fs.existsSync(path.join(rootDir, "bun.lockb")) || fs.existsSync(path.join(rootDir, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function hasScript(packageDir, scriptName) {
  const pkg = readJsonIfExists(path.join(packageDir, "package.json"));
  return Boolean(pkg?.scripts?.[scriptName]);
}

function run(command, args, cwd, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    if (allowFailure) return false;
    die(result.error.message);
  }

  if (result.status !== 0) {
    if (allowFailure) return false;
    process.exit(result.status || 1);
  }

  return true;
}

function install(manager) {
  const rootPackageJson = path.join(rootDir, "package.json");

  if (fs.existsSync(rootPackageJson)) {
    console.log(`[node-workspace] Installing dependencies at ${rootDir}`);

    if (manager === "bun") {
      if (!run("bun", ["install", "--frozen-lockfile"], rootDir, true)) run("bun", ["install"], rootDir);
      return;
    }

    if (manager === "pnpm") {
      if (!run("pnpm", ["install", "--frozen-lockfile"], rootDir, true)) run("pnpm", ["install"], rootDir);
      return;
    }

    if (manager === "yarn") {
      if (!run("yarn", ["install", "--immutable"], rootDir, true)) run("yarn", ["install"], rootDir);
      return;
    }

    if (!run("npm", ["ci"], rootDir, true)) run("npm", ["install"], rootDir);
    return;
  }

  const packageDirs = findPackageDirs(rootDir);
  if (packageDirs.length === 0) {
    console.log("[node-workspace] No package.json found. Skipping install.");
    return;
  }

  for (const packageDir of packageDirs) {
    console.log(`[node-workspace] Installing dependencies at ${path.relative(rootDir, packageDir)}`);
    if (manager === "bun") {
      if (!run("bun", ["install", "--frozen-lockfile"], packageDir, true)) run("bun", ["install"], packageDir);
    } else if (manager === "pnpm") {
      if (!run("pnpm", ["install", "--frozen-lockfile"], packageDir, true)) run("pnpm", ["install"], packageDir);
    } else if (manager === "yarn") {
      if (!run("yarn", ["install", "--immutable"], packageDir, true)) run("yarn", ["install"], packageDir);
    } else if (!run("npm", ["ci"], packageDir, true)) {
      run("npm", ["install"], packageDir);
    }
  }
}

function runScript(scriptName, manager) {
  if (hasScript(rootDir, scriptName)) {
    console.log(`[node-workspace] Running '${scriptName}' at repository root`);
    run(manager, ["run", scriptName], rootDir);
    return;
  }

  const packageDirs = findPackageDirs(rootDir).filter((dir) => hasScript(dir, scriptName));
  if (packageDirs.length === 0) {
    console.log(`[node-workspace] No '${scriptName}' script found. Skipping.`);
    return;
  }

  for (const packageDir of packageDirs) {
    console.log(`[node-workspace] Running '${scriptName}' in ${path.relative(rootDir, packageDir)}`);
    run(manager, ["run", scriptName], packageDir);
  }
}

function main() {
  const [, , action, scriptName, explicitManager] = process.argv;
  if (!action) die("Usage: node-workspace.cjs <install|run> [script] [manager]");

  const manager = detectPackageManager(explicitManager);

  if (action === "install") {
    install(scriptName || manager);
    return;
  }

  if (action === "run") {
    if (!scriptName) die("Usage: node-workspace.cjs run <script> [manager]");
    runScript(scriptName, manager);
    return;
  }

  die(`Unknown action: ${action}`);
}

main();
