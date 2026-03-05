#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const COPY_FOLDERS = [
  { from: ".github", to: ".github" },
  { from: "docs", to: "docs/standards" },
  { from: "templates/pre-commit", to: "templates/pre-commit" },
];

const COPY_FILES = [];
const AUTO_APPLY_PRECOMMIT = true;
const AUTO_APPLY_CI = true;

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function shOut(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}

function die(msg) {
  console.error(`\n[gitsync] ERROR: ${msg}\n`);
  process.exit(1);
}

function ensureGitRepo() {
  try {
    shOut("git rev-parse --is-inside-work-tree");
  } catch {
    die("Not inside a git repository.");
  }
}

function ensureClean() {
  const s = shOut("git status --porcelain");
  if (s.length > 0) die("Working tree is not clean. Commit/stash changes before running.");
}

function ensureGhAuth() {
  try {
    shOut("gh auth status");
  } catch {
    die("GitHub CLI not authenticated. Run: gh auth login");
  }
}

function ensureBaseFromOrigin(base) {
  sh("git fetch origin");
  try {
    sh(`git checkout ${base}`);
  } catch {
    sh(`git checkout -b ${base} origin/${base}`);
  }
  sh(`git reset --hard origin/${base}`);
}

function ensureOriginRemote() {
  let url = "";
  try {
    url = shOut("git remote get-url origin");
  } catch {
    die(
      "Remote 'origin' is not configured in this target repository.\n" +
      "Run: git remote add origin <repo-url> && git fetch origin"
    );
  }

  if (!url) {
    die(
      "Remote 'origin' is empty in this target repository.\n" +
      "Run: git remote set-url origin <repo-url> && git fetch origin"
    );
  }

  try {
    sh("git ls-remote --exit-code origin HEAD > /dev/null");
  } catch {
    die(
      "Remote 'origin' is unreachable or invalid.\n" +
      "Check access and URL with: git remote -v\n" +
      "Then run: git fetch origin"
    );
  }
}

function removeIfExists(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function getCfg(key, global = false) {
  try {
    return shOut(`git config ${global ? "--global " : ""}${key}`);
  } catch {
    return "";
  }
}

function setCfg(key, value, global = false) {
  sh(`git config ${global ? "--global " : ""}${key} "${value}"`);
}

function getOriginRepoSlug() {
  try {
    const url = shOut("git remote get-url origin");
    const ssh = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (ssh) return `${ssh[1]}/${ssh[2]}`;

    const https = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (https) return `${https[1]}/${https[2]}`;
  } catch {
    return "";
  }
  return "";
}

function syncIssueTemplateConfigLinks(targetRoot) {
  const repo = getOriginRepoSlug();
  if (!repo) {
    console.log("[gitsync] Skipping ISSUE_TEMPLATE/config.yml link sync (origin not configured).");
    return;
  }

  const configPath = path.join(targetRoot, ".github", "ISSUE_TEMPLATE", "config.yml");
  if (!fs.existsSync(configPath)) return;

  const content =
`blank_issues_enabled: false
contact_links:
  - name: Questions and Discussions
    url: https://github.com/${repo}/discussions
    about: Use Discussions for questions, ideas, and non-actionable topics.
  - name: Security Report
    url: https://github.com/${repo}/security/advisories/new
    about: Report vulnerabilities privately.
  - name: Standards and Workflow Docs
    url: https://github.com/${repo}/blob/main/README.md
    about: Check branch, commit, release, and automation standards before opening an issue.
`;

  fs.writeFileSync(configPath, content, "utf8");
  console.log(`[gitsync] Synced ISSUE_TEMPLATE contact links for ${repo}.`);
}

function parseArgs(argv) {
  const out = {
    mode: "help",
    base: "main",
    branch: "chore/sync-standards",
    source: "",
    ref: "main",
    global: false,
    help: false,
  };

  if (argv.length === 0) return out;

  if (argv[0] === "config") {
    const sub = argv[1];
    if (sub === "set") out.mode = "config-set";
    else if (sub === "get") out.mode = "config-get";
    else out.mode = "help";

    for (let i = 2; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--source") out.source = argv[++i];
      else if (a === "--ref") out.ref = argv[++i];
      else if (a === "--global") out.global = true;
      else if (a === "-h" || a === "--help") out.help = true;
      else die(`Unknown arg: ${a}`);
    }
    return out;
  }

  out.mode = "sync";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sync") out.mode = "sync";
    else if (a === "--base") out.base = argv[++i];
    else if (a === "--branch") out.branch = argv[++i];
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--ref") out.ref = argv[++i];
    else if (a === "-h" || a === "--help") out.help = true;
    else die(`Unknown arg: ${a}`);
  }
  return out;
}

function help() {
  console.log(`
gitsync

Config:
  gitsync config set --source <owner>/.github [--ref main] [--global]
  gitsync config get [--global]

Sync:
  gitsync --sync [--base main] [--branch chore/sync-standards] [--source <owner>/.github] [--ref main]

Examples:
  gitsync config set --global --source OWNER/.github --ref main
  gitsync --sync
  gitsync config set --global --source MYORG/.github --ref main
`);
}

function resolveSource(args) {
  const src = args.source || getCfg("gitsync.source") || getCfg("gitsync.source", true);
  const ref = args.ref || getCfg("gitsync.ref") || getCfg("gitsync.ref", true) || "main";
  if (!src) die("Missing source. Set once: gitsync config set --source <owner>/.github [--global]");
  return { src, ref };
}

function detectStack(targetRoot) {
  const has = (f) => fs.existsSync(path.join(targetRoot, f));

  if (has("mix.exs")) return { stack: "elixir", template: "elixir" };
  if (has("pom.xml")) return { stack: "java (maven)", template: "java-maven" };
  if (has("build.gradle") || has("build.gradle.kts")) return { stack: "java (gradle)", template: "java-gradle" };

  if (has("package.json")) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(targetRoot, "package.json"), "utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const hasDep = (name) => Boolean(deps[name]);

      if (hasDep("@angular/core")) return { stack: "node (angular)", template: "angular" };
      if (hasDep("react-native")) return { stack: "node (react-native)", template: "react-native" };
      if (hasDep("next")) return { stack: "node (nextjs)", template: "nextjs" };
      if (hasDep("react")) return { stack: "node (react)", template: "react" };
      return { stack: "node", template: "node" };
    } catch {
      return { stack: "node", template: "node" };
    }
  }

  return { stack: "unknown", template: "" };
}

function applyPreCommitTemplate(sourceDir, targetRoot, templateName, srcRepo, ref) {
  if (!templateName) return;

  const from = path.join(sourceDir, "templates", "pre-commit", templateName, ".pre-commit-config.yaml");
  const to = path.join(targetRoot, ".pre-commit-config.yaml");

  if (!fs.existsSync(from)) {
    console.log(`[gitsync] pre-commit template not found for "${templateName}". Skipping.`);
    return;
  }

  fs.copyFileSync(from, to);
  console.log(`[gitsync] Applied pre-commit template: ${templateName} -> .pre-commit-config.yaml`);
  console.log(`[gitsync] Other templates live at: ${srcRepo}/tree/${ref}/templates/pre-commit`);
}

function buildTestSteps(templateName) {
  if (templateName === "elixir") {
    return [
      "      - uses: erlef/setup-beam@v1",
      "        with:",
      "          otp-version: '27.0'",
      "          elixir-version: '1.17.3'",
      "      - run: mix local.hex --force",
      "      - run: mix local.rebar --force",
      "      - run: mix deps.get",
      "      - run: MIX_ENV=test mix test",
    ];
  }

  if (templateName === "java-maven") {
    return [
      "      - uses: actions/setup-java@v4",
      "        with:",
      "          distribution: temurin",
      "          java-version: '21'",
      "          cache: maven",
      "      - run: chmod +x mvnw",
      "      - run: ./mvnw -B clean verify",
    ];
  }

  if (templateName === "java-gradle") {
    return [
      "      - uses: actions/setup-java@v4",
      "        with:",
      "          distribution: temurin",
      "          java-version: '21'",
      "          cache: gradle",
      "      - run: chmod +x gradlew",
      "      - run: ./gradlew clean test build",
    ];
  }

  return [
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    "          cache: npm",
    "      - run: npm ci || npm install",
    "      - run: npm run lint --if-present",
    "      - run: npm test --if-present",
    "      - run: npm run build --if-present",
  ];
}

function buildCiWorkflow(templateName) {
  const steps = buildTestSteps(templateName || "node");
  const lines = [
    "name: CI",
    "",
    "on:",
    "  push:",
    "  pull_request:",
    "",
    "jobs:",
    "  test:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 20",
    "    steps:",
    "      - uses: actions/checkout@v4",
    ...steps,
    "",
    "  docker-build:",
    "    runs-on: ubuntu-latest",
    "    needs: [test]",
    "    if: ${{ hashFiles('Dockerfile') != '' }}",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: docker build -t app-ci -f Dockerfile .",
    "",
    "  docker-compose-validate:",
    "    runs-on: ubuntu-latest",
    "    needs: [test]",
    "    if: ${{ hashFiles('docker-compose.yml') != '' || hashFiles('compose.yml') != '' }}",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: |",
    "          if [ -f docker-compose.yml ]; then docker compose -f docker-compose.yml config >/dev/null; fi",
    "          if [ -f compose.yml ]; then docker compose -f compose.yml config >/dev/null; fi",
    "",
    "  k8s-validate:",
    "    runs-on: ubuntu-latest",
    "    needs: [test]",
    "    if: ${{ hashFiles('k8s/**/*.yml', 'k8s/**/*.yaml', 'infra/k8s/**/*.yml', 'infra/k8s/**/*.yaml') != '' }}",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: |",
    "          FILES=$(find k8s infra/k8s -type f \\( -name '*.yml' -o -name '*.yaml' \\) 2>/dev/null || true)",
    "          if [ -z \"$FILES\" ]; then exit 0; fi",
    "          curl -sSL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz",
    "          chmod +x kubeconform",
    "          ./kubeconform -strict -summary $FILES",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function applyCiWorkflow(targetRoot, templateName) {
  const to = path.join(targetRoot, ".github", "workflows", "ci.yml");
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buildCiWorkflow(templateName), "utf8");
  console.log(`[gitsync] Applied CI workflow template: ${templateName || "node"} -> .github/workflows/ci.yml`);
}

function sync(args) {
  ensureGitRepo();
  ensureClean();
  ensureOriginRemote();
  ensureGhAuth();

  const { src, ref } = resolveSource(args);
  ensureBaseFromOrigin(args.base);
  sh(`git checkout -b ${args.branch}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gitsync-"));
  const sourceDir = path.join(tmp, "source");
  sh(`gh repo clone ${src} "${sourceDir}"`);
  sh(`git -C "${sourceDir}" checkout ${ref}`);

  for (const item of COPY_FOLDERS) {
    const fromAbs = path.join(sourceDir, item.from);
    const toAbs = path.join(process.cwd(), item.to);
    if (!fs.existsSync(fromAbs)) continue;
    removeIfExists(toAbs);
    copyDir(fromAbs, toAbs);
  }

  for (const item of COPY_FILES) {
    const fromAbs = path.join(sourceDir, item.from);
    const toAbs = path.join(process.cwd(), item.to);
    if (!fs.existsSync(fromAbs)) continue;
    removeIfExists(toAbs);
    copyFile(fromAbs, toAbs);
  }

  const detected = detectStack(process.cwd());
  console.log(`[gitsync] Detected stack: ${detected.stack}`);

  if (AUTO_APPLY_PRECOMMIT) {
    if (detected.template) applyPreCommitTemplate(sourceDir, process.cwd(), detected.template, src, ref);
    else {
      console.log("[gitsync] No pre-commit template applied (unknown stack).");
      console.log(`[gitsync] Templates: ${src}/tree/${ref}/templates/pre-commit`);
    }
  }

  if (AUTO_APPLY_CI) {
    applyCiWorkflow(process.cwd(), detected.template || "node");
  }

  syncIssueTemplateConfigLinks(process.cwd());

  const porcelain = shOut("git status --porcelain");
  if (!porcelain) {
    console.log("[gitsync] No changes detected. Exiting (no PR created).");
    process.exit(0);
  }

  sh("git add -A .github docs templates");
  if (fs.existsSync(path.join(process.cwd(), ".pre-commit-config.yaml"))) {
    sh("git add .pre-commit-config.yaml");
  }
  sh(`git commit -m "chore: sync standards (templates + docs + pre-commit + ci)"`);
  sh(`git push -u origin ${args.branch}`);
  sh(`gh pr create --base ${args.base} --head ${args.branch} --title "chore: sync standards" --body "Automated sync from ${src}@${ref}."`);
  console.log("[gitsync] Done.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.mode === "help") return help();

  if (args.mode === "config-get") {
    const src = getCfg("gitsync.source", args.global);
    const ref = getCfg("gitsync.ref", args.global);
    console.log(JSON.stringify({ source: src || "", ref: ref || "" }, null, 2));
    return;
  }

  if (args.mode === "config-set") {
    if (!args.source) die("config set requires --source <owner>/.github");
    setCfg("gitsync.source", args.source, args.global);
    setCfg("gitsync.ref", args.ref || "main", args.global);
    console.log(`[gitsync] Set ${args.global ? "global" : "local"} source=${args.source} ref=${args.ref || "main"}`);
    return;
  }

  if (args.mode === "sync") return sync(args);
  help();
}

main();
