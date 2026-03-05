#!/usr/bin/env node
import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}
function shOut(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}
function die(msg) {
  console.error(`\n[setup-env-branches] ERROR: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { base: "main", envs: [], help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") out.base = argv[++i];
    else if (a === "--env") out.envs.push(argv[++i]);
    else if (a === "-h" || a === "--help") out.help = true;
    else die(`Unknown arg: ${a}`);
  }
  return out;
}

function ensureGitRepo() {
  try { shOut("git rev-parse --is-inside-work-tree"); }
  catch { die("Not inside a git repository."); }
}

function ensureClean() {
  const s = shOut("git status --porcelain");
  if (s.length > 0) die("Working tree is not clean. Commit/stash changes before running.");
}

function ensureBaseFromOrigin(base) {
  sh("git fetch origin");
  try { sh(`git checkout ${base}`); }
  catch { sh(`git checkout -b ${base} origin/${base}`); }
  sh(`git reset --hard origin/${base}`);
}

function remoteBranchExists(branch) {
  try {
    shOut(`git ls-remote --exit-code --heads origin "${branch}"`);
    return true;
  } catch {
    return false;
  }
}

function localBranchExists(branch) {
  try {
    shOut(`git show-ref --verify --quiet "refs/heads/${branch}"`);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.envs.length === 0) {
    console.log(`Usage: setup-env-branches --base main --env dev --env staging --env prod`);
    process.exit(args.help ? 0 : 1);
  }

  ensureGitRepo();
  ensureClean();
  ensureBaseFromOrigin(args.base);

  for (const env of args.envs) {
    console.log(`[setup-env-branches] Ensuring branch: ${env}`);

    if (!localBranchExists(env)) {
      sh(`git checkout -b ${env} origin/${args.base}`);
    } else {
      sh(`git checkout ${env}`);
    }

    if (remoteBranchExists(env)) {
      console.log(`  - origin/${env} exists`);
    } else {
      console.log(`  - creating origin/${env}`);
      sh(`git push -u origin ${env}`);
    }
  }

  sh(`git checkout ${args.base}`);
  console.log("[setup-env-branches] Done.");
}

main();
