#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}
function shOut(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}
function die(msg) {
  console.error(`\n[release] ERROR: ${msg}\n`);
  process.exit(1);
}

function ensureGitRepo() {
  try { shOut("git rev-parse --is-inside-work-tree"); }
  catch { die("Not inside a git repository."); }
}
function ensureClean() {
  const s = shOut("git status --porcelain");
  if (s.length > 0) die("Working tree is not clean. Commit/stash changes before running.");
}
function ensureGhAuth() {
  try { shOut("gh auth status"); }
  catch { die("GitHub CLI not authenticated. Run: gh auth login"); }
}
function ensureBaseFromOrigin(base) {
  sh("git fetch origin");
  try { sh(`git checkout ${base}`); }
  catch { sh(`git checkout -b ${base} origin/${base}`); }
  sh(`git reset --hard origin/${base}`);
}

function parseArgs(argv) {
  const out = { cmd: "help", type: "auto", base: "main", help: false };
  if (argv.length === 0) return out;
  out.cmd = argv[0];

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") out.type = argv[++i];
    else if (a === "--base") out.base = argv[++i];
    else if (a === "-h" || a === "--help") out.help = true;
    else die(`Unknown arg: ${a}`);
  }
  return out;
}

function help() {
  console.log(`
release

Usage:
  release prepare --type auto|major|minor|patch --base main
  release publish --type auto|major|minor|patch --base main

Examples:
  release prepare --type auto
  release publish --type auto
`);
}

function getLastTag() {
  try {
    return shOut("git describe --tags --abbrev=0");
  } catch {
    return "";
  }
}

function readCommitMessagesSince(tag) {

  const range = tag ? `${tag}..HEAD` : "HEAD";

  const raw = shOut(`git log ${range} --pretty=format:%s%n%b%n---END---`);
  return raw.split("\n---END---\n").map(s => s.trim()).filter(Boolean);
}

function detectBumpTypeFromCommits(commits) {

  let major = false, minor = false, patch = false;

  for (const msg of commits) {
    const lines = msg.split("\n");
    const subject = (lines[0] || "").trim();
    const body = lines.slice(1).join("\n");

    if (/BREAKING CHANGE:/i.test(body)) major = true;
    if (/^[a-z]+(\(.+\))?!:/.test(subject)) major = true;

    if (/^feat(\(.+\))?:/i.test(subject)) minor = true;
    if (/^fix(\(.+\))?:/i.test(subject)) patch = true;
  }

  if (major) return "major";
  if (minor) return "minor";
  if (patch) return "patch";
  return "none";
}

function parseSemver(v) {
  const m = v.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bumpVersion(current, bumpType) {
  const v = parseSemver(current);
  if (!v) die(`Invalid current version: ${current}`);
  if (bumpType === "major") return `${v.major + 1}.0.0`;
  if (bumpType === "minor") return `${v.major}.${v.minor + 1}.0`;
  if (bumpType === "patch") return `${v.major}.${v.minor}.${v.patch + 1}`;
  die(`Unknown bump type: ${bumpType}`);
}

function detectProjectFile() {
  const candidates = [
    "package.json",
    "mix.exs",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
  ];
  for (const f of candidates) {
    if (fs.existsSync(path.join(process.cwd(), f))) return f;
  }
  die("Could not detect project file (package.json | mix.exs | pom.xml | build.gradle*).");
}

function getCurrentVersion(file) {
  if (file === "package.json") {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!pkg.version) die("package.json missing version field.");
    return String(pkg.version);
  }

  if (file === "mix.exs") {
    const txt = fs.readFileSync(file, "utf8");

    const m = txt.match(/version:\s*"(\d+\.\d+\.\d+)"/);
    if (!m) die('mix.exs: could not find version: "x.y.z"');
    return m[1];
  }

  if (file === "pom.xml") {
    const txt = fs.readFileSync(file, "utf8");

    const mProject = txt.match(/<project[^>]*>[\s\S]*?<version>(\d+\.\d+\.\d+)<\/version>/);
    if (mProject) return mProject[1];
    const mAny = txt.match(/<version>(\d+\.\d+\.\d+)<\/version>/);
    if (!mAny) die("pom.xml: could not find a SemVer <version>x.y.z</version>.");
    return mAny[1];
  }

  if (file === "build.gradle" || file === "build.gradle.kts") {
    const txt = fs.readFileSync(file, "utf8");

    const m = txt.match(/version\s*=\s*["'](\d+\.\d+\.\d+)["']/);
    if (!m) die("build.gradle*: could not find version = \"x.y.z\".");
    return m[1];
  }

  die(`Unsupported project file: ${file}`);
}

function setVersion(file, next) {
  if (file === "package.json") {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.version = next;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
    return;
  }

  if (file === "mix.exs") {
    const txt = fs.readFileSync(file, "utf8");
    const out = txt.replace(/version:\s*"\d+\.\d+\.\d+"/, `version: "${next}"`);
    fs.writeFileSync(file, out);
    return;
  }

  if (file === "pom.xml") {
    const txt = fs.readFileSync(file, "utf8");

    const out = txt.replace(
      /(<project[^>]*>[\s\S]*?<version>)(\d+\.\d+\.\d+)(<\/version>)/,
      `$1${next}$3`
    );
    if (out === txt) {

      const out2 = txt.replace(/<version>(\d+\.\d+\.\d+)<\/version>/, `<version>${next}</version>`);
      fs.writeFileSync(file, out2);
    } else {
      fs.writeFileSync(file, out);
    }
    return;
  }

  if (file === "build.gradle" || file === "build.gradle.kts") {
    const txt = fs.readFileSync(file, "utf8");
    const out = txt.replace(/version\s*=\s*["']\d+\.\d+\.\d+["']/, `version = "${next}"`);
    fs.writeFileSync(file, out);
    return;
  }

  die(`Unsupported project file: ${file}`);
}

function computeNextVersion(bumpType, base) {
  const lastTag = getLastTag();
  const currentTagVersion = lastTag ? lastTag.replace(/^v/, "") : "0.0.0";

  const commits = readCommitMessagesSince(lastTag);
  const autoType = detectBumpTypeFromCommits(commits);

  if (bumpType === "auto") {
    if (autoType === "none") die("No feat/fix/breaking commits since last tag. Cannot auto-bump.");
    return bumpVersion(currentTagVersion, autoType);
  }

  if (!["major", "minor", "patch"].includes(bumpType)) die(`Invalid --type: ${bumpType}`);
  return bumpVersion(currentTagVersion, bumpType);
}

function prepare({ type, base }) {
  ensureGitRepo();
  ensureClean();
  ensureGhAuth();

  ensureBaseFromOrigin(base);

  const projectFile = detectProjectFile();
  const currentFileVersion = getCurrentVersion(projectFile);

  const next = computeNextVersion(type, base);

  const branch = `chore/release-v${next}`;
  sh(`git checkout -b ${branch}`);

  setVersion(projectFile, next);

  const porcelain = shOut("git status --porcelain");
  if (!porcelain) die("No changes after bump. Something is off.");

  sh(`git add "${projectFile}"`);
  sh(`git commit -m "chore(release): bump version to ${next}"`);

  sh(`git push -u origin ${branch}`);

  sh(`gh pr create --base ${base} --head ${branch} --title "chore(release): v${next}" --body "Bump version to ${next} and prepare release."`);

  console.log(`[release] Prepared PR for v${next} (file: ${projectFile}, was: ${currentFileVersion})`);
}

function publish({ type, base }) {
  ensureGitRepo();
  ensureClean();
  ensureGhAuth();

  sh(`git checkout ${base}`);
  sh(`git pull --ff-only`);

  const next = computeNextVersion(type, base);
  const tag = `v${next}`;

  try {
    shOut(`git rev-parse "${tag}"`);
    die(`Tag already exists: ${tag}`);
  } catch {

  }

  sh(`git tag -a ${tag} -m "Release ${tag}"`);
  sh(`git push origin ${tag}`);

  sh(`gh release create ${tag} --generate-notes`);

  console.log(`[release] Published ${tag}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.cmd === "help") return help();

  if (args.cmd === "prepare") return prepare(args);
  if (args.cmd === "publish") return publish(args);

  help();
  process.exit(1);
}

main();
