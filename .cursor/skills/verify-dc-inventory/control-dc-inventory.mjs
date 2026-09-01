#!/usr/bin/env node
/**
 * Agent CLI for verify-dc-inventory.
 * Run from the repo root. Stdout is one JSON object per command (except --help).
 * Never prints PHASE1_* password values.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SKILL_DIR, "../../..");
const RUN_DIR = join(SKILL_DIR, ".run");
const STATE_PATH = join(RUN_DIR, "state.json");
const EVIDENCE_DIR = join(SKILL_DIR, "evidence");
const CHROME_PROFILE = join(RUN_DIR, "chrome-profile");
const CDP_PORT = 9333;

const DEFAULTS = {
  // Next 16 blocks /_next/* from 127.0.0.1 when the dev server prints localhost.
  internalUrl: "http://localhost:3000",
  apiUrl: "http://localhost:3001",
  wholesaleUrl: "http://localhost:3002",
  postgresHost: "127.0.0.1",
  postgresPort: 5432,
};

const STAFF_EMAIL = "staff@local.test";
const WHOLESALE_EMAIL = "wholesale@local.test";
const ORG_SLUG = "acme";

const PORT_BY_SURFACE = {
  internal: 3000,
  api: 3001,
  wholesale: 3002,
};

const USAGE = `control-dc-inventory — drive DC Inventory for verification

Usage:
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs <command> [flags]
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs <command> --help

Commands:
  doctor              Read-only: is this instance worth driving?
  launch              Start Compose (if needed), migrate, seed, API, staff app
  attach              Record URLs for an already-running stack; do not kill it later
  teardown            Stop PIDs this CLI started (not evidence/). --dry-run first
  goto                Open a path on staff or wholesale
  click               Click by role+name, data-testid, or selector
  fill                Fill a field (--value or --value-from-env)
  type                Type into the focused or targeted field
  press               Send a key (Enter, Escape, Tab, …)
  login-staff         Fill acme / staff@local.test / PHASE1_STAFF_PASSWORD and Continue
  login-wholesale     Fill acme / wholesale@local.test / PHASE1_WHOLESALE_PASSWORD
  wait-settle         Wait for network idle and sign-in spinner to clear
  snapshot            Accessibility tree (--aria). Writes a file when --path is set
  screenshot          PNG. Writes a file when --path is set
  state               URL, title, cookie presence (no cookie values)

Global flags:
  --json              Always on for commands. Kept so agents can pass it safely
  --dry-run           launch / teardown only: print the plan, change nothing
  --help, -h          This text, or per-command help

Examples:
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs doctor
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch --seed phase1
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs login-staff
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs goto --path /catalog
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs click --role link --name Catalog --within-role navigation --within-name "Main navigation"
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.aria.yml
  node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs teardown --dry-run

Passwords: read PHASE1_STAFF_PASSWORD / PHASE1_WHOLESALE_PASSWORD from the
environment or apps/api/.env. Do not pass them on the argv line.
`;

const COMMAND_HELP = {
  doctor: `doctor — read-only health

Usage:
  control-dc-inventory.mjs doctor

Checks API /health + /ready, staff HTTP, recorded PIDs, password resolvability
(not the value), and Playwright. Prints JSON. Exit 1 if not worth driving.
`,
  launch: `launch — start the local verification stack

Usage:
  control-dc-inventory.mjs launch [--seed phase1|demo|none] [--surfaces api,internal[,wholesale]] [--dry-run]

Default seed is phase1. Default surfaces are api,internal.
Refuses ports this skill did not start. Copies env examples when missing.
`,
  attach: `attach — use a stack someone else started

Usage:
  control-dc-inventory.mjs attach [--internal-url URL] [--api-url URL] [--wholesale-url URL]

Records URLs in .run/state.json with attach:true. teardown will not kill those servers.
`,
  teardown: `teardown — stop what this CLI started

Usage:
  control-dc-inventory.mjs teardown [--dry-run] [--keep-compose]

Kills recorded PIDs only. Leaves evidence/ in place. --dry-run prints the plan.
`,
  goto: `goto — navigate

Usage:
  control-dc-inventory.mjs goto --path /catalog [--surface internal|wholesale]
`,
  click: `click — one click

Usage:
  control-dc-inventory.mjs click --role link --name Catalog [--exact]
  control-dc-inventory.mjs click --role link --name Catalog --within-role navigation --within-name "Main navigation"
  control-dc-inventory.mjs click --testid auth-sign-in-dialog
  control-dc-inventory.mjs click --selector "css"
  control-dc-inventory.mjs click --x 12 --y 40 --force-coords
`,
  fill: `fill — replace field value

Usage:
  control-dc-inventory.mjs fill --label Email --value staff@local.test
  control-dc-inventory.mjs fill --role textbox --name "Search SKU or name" --value HEX
  control-dc-inventory.mjs fill --label Password --value-from-env PHASE1_STAFF_PASSWORD
`,
  type: `type — append text

Usage:
  control-dc-inventory.mjs type --label Email --text staff
  control-dc-inventory.mjs type --text {Enter}
`,
  press: `press — key

Usage:
  control-dc-inventory.mjs press --key Escape
`,
  "login-staff": `login-staff — staff form login

Usage:
  control-dc-inventory.mjs login-staff [--org acme] [--email staff@local.test]

Reads PHASE1_STAFF_PASSWORD. Never prints it. Opens /catalog first.
`,
  "login-wholesale": `login-wholesale — wholesale form login

Usage:
  control-dc-inventory.mjs login-wholesale [--org acme] [--email wholesale@local.test]

Reads PHASE1_WHOLESALE_PASSWORD. Opens wholesale /login.
`,
  "wait-settle": `wait-settle — wait until the page is quiet

Usage:
  control-dc-inventory.mjs wait-settle [--timeout-ms 30000]
`,
  snapshot: `snapshot — accessibility tree

Usage:
  control-dc-inventory.mjs snapshot --aria [--path FILE]
`,
  screenshot: `screenshot — PNG

Usage:
  control-dc-inventory.mjs screenshot [--path FILE] [--full-page]
`,
  state: `state — current page

Usage:
  control-dc-inventory.mjs state

Cookie fields are booleans. Values are never printed.
`,
};

function fail(command, code, message, doInstead, extra = {}) {
  const error = { code, message, doInstead, ...extra };
  writeJson({ ok: false, command, error });
  process.exit(1);
}

function succeed(command, data) {
  writeJson({ ok: true, command, data });
  process.exit(0);
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function parseArgs(argv) {
  const flags = Object.create(null);
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
        continue;
      }
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    if (token === "-h") {
      flags.help = true;
      continue;
    }
    positionals.push(token);
  }
  return { flags, positionals };
}

function flagString(flags, name) {
  const value = flags[name];
  if (value === true || value === undefined) {
    return undefined;
  }
  return String(value);
}

function flagBool(flags, name) {
  return flags[name] === true || flags[name] === "true" || flags[name] === "1";
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readState() {
  if (!existsSync(STATE_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  ensureDir(RUN_DIR);
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const out = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function resolveSecret(name) {
  const fromEnv = process.env[name]?.trim() ?? "";
  if (fromEnv.length > 0) {
    return { value: fromEnv, source: `env:${name}` };
  }
  const apiEnv = loadDotEnv(join(REPO_ROOT, "apps/api/.env"));
  if ((apiEnv[name] ?? "").trim().length > 0) {
    return { value: apiEnv[name].trim(), source: "apps/api/.env" };
  }
  const rootEnv = loadDotEnv(join(REPO_ROOT, ".env"));
  if ((rootEnv[name] ?? "").trim().length > 0) {
    return { value: rootEnv[name].trim(), source: ".env" };
  }
  const apiExample = loadDotEnv(join(REPO_ROOT, "apps/api/.env.example"));
  if ((apiExample[name] ?? "").trim().length > 0) {
    return { value: apiExample[name].trim(), source: "apps/api/.env.example" };
  }
  return { value: "", source: null };
}

function tcpOpen(host, port, timeoutMs = 400) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveOpen(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function httpProbe(url, timeoutMs = 2000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ac.signal, redirect: "manual" });
    const text = await response.text();
    return { ok: true, status: response.status, bytes: text.length };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHttp(url, { timeoutMs, accept } = {}) {
  const deadline = Date.now() + (timeoutMs ?? 90_000);
  let last = { ok: false, status: 0 };
  while (Date.now() < deadline) {
    last = await httpProbe(url, 3000);
    if (last.ok && (accept ? accept(last.status) : last.status < 500)) {
      return last;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url} (last status ${String(last.status)})`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function which(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function runCommand(command, args, { cwd = REPO_ROOT, env, timeoutMs } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? result.error.message : null,
  };
}

function spawnLogged(command, args, logPath, extraEnv = {}) {
  ensureDir(dirname(logPath));
  const logFd = openSync(logPath, "a");
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  return child.pid;
}

function killPid(pid) {
  if (!pidAlive(pid)) {
    return { pid, killed: false, reason: "already-dead" };
  }
  try {
    process.kill(-pid, "SIGTERM");
    return { pid, killed: true, reason: "SIGTERM-group" };
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      return { pid, killed: true, reason: "SIGTERM" };
    } catch (error) {
      return { pid, killed: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
}

function copyEnvIfMissing() {
  const copied = [];
  const pairs = [
    [join(REPO_ROOT, ".env.example"), join(REPO_ROOT, ".env")],
    [join(REPO_ROOT, "apps/api/.env.example"), join(REPO_ROOT, "apps/api/.env")],
    [join(REPO_ROOT, "apps/internal/.env.example"), join(REPO_ROOT, "apps/internal/.env")],
    [join(REPO_ROOT, "apps/wholesale/.env.example"), join(REPO_ROOT, "apps/wholesale/.env")],
  ];
  for (const [from, to] of pairs) {
    if (existsSync(from) && !existsSync(to)) {
      copyFileSync(from, to);
      copied.push(to.replace(`${REPO_ROOT}/`, ""));
    }
  }
  return copied;
}

function parseSurfaces(flags) {
  const raw = flagString(flags, "surfaces") ?? "api,internal";
  const surfaces = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const allowed = new Set(["api", "internal", "wholesale"]);
  for (const surface of surfaces) {
    if (!allowed.has(surface)) {
      throw new Error(`Unknown surface "${surface}". Use api, internal, wholesale.`);
    }
  }
  if (!surfaces.includes("api")) {
    surfaces.unshift("api");
  }
  return [...new Set(surfaces)];
}

function originFor(surface, state) {
  if (surface === "wholesale") {
    return state?.urls?.wholesale ?? DEFAULTS.wholesaleUrl;
  }
  if (surface === "api") {
    return state?.urls?.api ?? DEFAULTS.apiUrl;
  }
  return state?.urls?.internal ?? DEFAULTS.internalUrl;
}

function listenerOnPort(port) {
  const result = runCommand("ss", ["-lntp"], {});
  const text = `${result.stdout}\n${result.stderr}`;
  const match = text.match(new RegExp(`:${port}\\b.*pid=(\\d+)`, "m"));
  if (!match) {
    return { listening: /LISTEN/.test(text) && text.includes(`:${port}`), pid: null, raw: null };
  }
  return { listening: true, pid: Number(match[1]), raw: match[0] };
}

function chromeBin() {
  return (
    which("google-chrome") ||
    which("google-chrome-stable") ||
    which("chromium") ||
    which("chromium-browser")
  );
}

async function ensurePlaywright() {
  const modulePath = join(SKILL_DIR, "node_modules/playwright/index.mjs");
  if (!existsSync(modulePath)) {
    const install = runCommand("npm", ["install", "--omit=dev"], {
      cwd: SKILL_DIR,
      timeoutMs: 180_000,
    });
    if (install.status !== 0) {
      throw new Error(
        `Playwright install failed. Run: npm install --prefix .cursor/skills/verify-dc-inventory\n${install.stderr}`,
      );
    }
  }
  return import(pathToFileURL(join(SKILL_DIR, "node_modules/playwright/index.mjs")).href);
}

async function ensureBrowser(state) {
  const chrome = chromeBin();
  if (!chrome) {
    throw new Error(
      "google-chrome not on PATH. Install Chrome or Chromium, then rerun the drive command.",
    );
  }
  const existing = state.browser;
  if (existing?.pid && pidAlive(existing.pid) && existing.cdpUrl) {
    return state;
  }
  ensureDir(CHROME_PROFILE);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${CHROME_PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-extensions",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--headless=new",
    "about:blank",
  ];
  const logPath = join(RUN_DIR, "chrome.log");
  const pid = spawnLogged(chrome, args, logPath);
  const deadline = Date.now() + 20_000;
  let version = null;
  while (Date.now() < deadline) {
    const probe = await httpProbe(`http://127.0.0.1:${CDP_PORT}/json/version`, 500);
    if (probe.ok) {
      version = probe;
      break;
    }
    await sleep(200);
  }
  if (!version?.ok) {
    throw new Error(
      `Chrome CDP did not come up on :${CDP_PORT}. Check ${logPath.replace(`${REPO_ROOT}/`, "")}.`,
    );
  }
  state.browser = {
    pid,
    cdpUrl: `http://127.0.0.1:${CDP_PORT}`,
    log: logPath.replace(`${REPO_ROOT}/`, ""),
  };
  writeState(state);
  return state;
}

async function withPage(state, fn) {
  const playwright = await ensurePlaywright();
  const browser = await playwright.chromium.connectOverCDP(state.browser.cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const pages = context.pages();
  const page =
    pages.find((candidate) => candidate.url() !== "about:blank") ??
    pages[0] ??
    (await context.newPage());
  const viewport = page.viewportSize();
  if (!viewport || viewport.width < 1280) {
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  return fn(page, context);
}

function locatorFromFlags(scope, flags) {
  const testid = flagString(flags, "testid");
  if (testid) {
    return scope.getByTestId(testid);
  }
  const selector = flagString(flags, "selector");
  if (selector) {
    return scope.locator(selector);
  }
  const label = flagString(flags, "label");
  if (label) {
    return scope.getByLabel(label, { exact: flagBool(flags, "exact") });
  }
  const role = flagString(flags, "role");
  const name = flagString(flags, "name");
  if (role) {
    return scope.getByRole(role, {
      name: name === undefined ? undefined : name,
      exact: flagBool(flags, "exact"),
    });
  }
  return null;
}

function scopedLocator(page, flags) {
  const withinRole = flagString(flags, "within-role");
  const withinName = flagString(flags, "within-name");
  const scope =
    withinRole !== undefined
      ? page.getByRole(withinRole, { name: withinName, exact: flagBool(flags, "exact-within") })
      : page;
  const locator = locatorFromFlags(scope, flags);
  return { scope, locator };
}

function resolveOutPath(raw) {
  if (!raw) {
    return null;
  }
  return isAbsolute(raw) ? raw : resolve(REPO_ROOT, raw);
}

async function cmdDoctor(flags) {
  void flags;
  const state = readState();
  const apiUrl = state?.urls?.api ?? DEFAULTS.apiUrl;
  const internalUrl = state?.urls?.internal ?? DEFAULTS.internalUrl;
  const wholesaleUrl = state?.urls?.wholesale ?? DEFAULTS.wholesaleUrl;
  const health = await httpProbe(`${apiUrl}/health`);
  const ready = await httpProbe(`${apiUrl}/ready`);
  const internal = await httpProbe(internalUrl);
  const wholesale = await httpProbe(wholesaleUrl);
  const staffSecret = resolveSecret("PHASE1_STAFF_PASSWORD");
  const wholesaleSecret = resolveSecret("PHASE1_WHOLESALE_PASSWORD");
  const playwrightPresent = existsSync(join(SKILL_DIR, "node_modules/playwright/index.mjs"));
  const docker = which("docker");
  const postgres = await tcpOpen(DEFAULTS.postgresHost, DEFAULTS.postgresPort);
  const ports = {};
  for (const [surface, port] of Object.entries(PORT_BY_SURFACE)) {
    const listener = listenerOnPort(port);
    const recorded = state?.pids?.[surface] ?? null;
    ports[surface] = {
      port,
      listening: listener.listening || listener.pid !== null,
      listenerPid: listener.pid,
      recordedPid: recorded,
      ownedByUs: recorded !== null && listener.pid === recorded,
      stranger:
        listener.pid !== null &&
        recorded !== null &&
        listener.pid !== recorded &&
        !pidAlive(recorded),
    };
  }
  const recordedPids = {};
  if (state?.pids) {
    for (const [name, pid] of Object.entries(state.pids)) {
      recordedPids[name] = { pid, alive: pidAlive(pid) };
    }
  }
  if (state?.browser?.pid) {
    recordedPids.browser = { pid: state.browser.pid, alive: pidAlive(state.browser.pid) };
  }
  const blocking = [];
  if (!health.ok || health.status !== 200) {
    blocking.push("API /health is not 200");
  }
  if (!ready.ok || ready.status !== 200) {
    blocking.push("API /ready is not 200 (Postgres missing or migrate not applied)");
  }
  if (!internal.ok) {
    blocking.push("staff app is not reachable on :3000");
  }
  if (!staffSecret.source) {
    blocking.push("PHASE1_STAFF_PASSWORD is missing");
  }
  const ok = blocking.length === 0;
  const data = {
    ok,
    blocking,
    urls: { api: apiUrl, internal: internalUrl, wholesale: wholesaleUrl },
    api: { health, ready },
    http: { internal, wholesale },
    postgresListening: postgres,
    docker: docker !== null,
    attach: state?.attach === true,
    recordedPids,
    ports,
    passwordResolvable: {
      PHASE1_STAFF_PASSWORD: staffSecret.source,
      PHASE1_WHOLESALE_PASSWORD: wholesaleSecret.source,
    },
    playwrightPresent,
    evidenceDir: EVIDENCE_DIR.replace(`${REPO_ROOT}/`, ""),
    doInstead: ok
      ? null
      : "node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch --seed phase1",
  };
  if (!ok) {
    fail("doctor", "UNHEALTHY", blocking.join("; "), data.doInstead, { data });
    return;
  }
  succeed("doctor", data);
}

async function cmdLaunch(flags) {
  const dryRun = flagBool(flags, "dry-run");
  const seed = flagString(flags, "seed") ?? "phase1";
  if (!["phase1", "demo", "none"].includes(seed)) {
    fail(
      "launch",
      "BAD_SEED",
      `Unknown --seed ${seed}`,
      "Use --seed phase1 (default), --seed demo, or --seed none",
    );
    return;
  }
  let surfaces;
  try {
    surfaces = parseSurfaces(flags);
  } catch (error) {
    fail("launch", "BAD_SURFACE", error instanceof Error ? error.message : String(error), "Pass --surfaces api,internal");
    return;
  }

  const existing = readState();
  if (existing && !existing.attach) {
    const live = Object.entries(existing.pids ?? {}).filter(([, pid]) => pidAlive(pid));
    if (live.length > 0) {
      fail(
        "launch",
        "ALREADY_RUNNING",
        `This CLI already started: ${live.map(([name, pid]) => `${name}=${pid}`).join(", ")}`,
        "node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs attach   or   ... teardown --dry-run",
      );
      return;
    }
  }

  const plan = [];
  const copied = dryRun ? [] : copyEnvIfMissing();
  if (copied.length > 0) {
    plan.push({ step: "copy-env", copied });
  } else {
    plan.push({ step: "copy-env", copied: dryRun ? ["would copy missing .env files from *.example"] : [] });
  }

  const docker = which("docker");
  const postgresUpBeforeLaunch = await tcpOpen(DEFAULTS.postgresHost, DEFAULTS.postgresPort);
  let postgresMode = "existing";
  if (docker) {
    postgresMode = "compose";
    if (postgresUpBeforeLaunch) {
      plan.push({
        step: "compose",
        mode: "already-up",
        note: "Postgres already listening; skip docker compose up; teardown will not stop Compose",
      });
    } else {
      plan.push({ step: "compose", command: "docker compose up -d --wait" });
    }
  } else if (postgresUpBeforeLaunch) {
    plan.push({ step: "postgres", mode: "existing", host: "127.0.0.1:5432" });
  } else {
    const noPostgres = {
      code: "NO_POSTGRES",
      message: "Docker is not installed and nothing is listening on 127.0.0.1:5432.",
      doInstead:
        "Install Docker Engine, then rerun launch. Repo command: docker compose up -d --wait. Or start Postgres 18 locally (user/password/db postgres/postgres/dc_inventory) and rerun.",
    };
    plan.push({ step: "postgres", blocker: noPostgres });
    if (dryRun) {
      succeed("launch", { dryRun: true, seed, surfaces, wouldFail: noPostgres, plan, started: false });
      return;
    }
    fail("launch", noPostgres.code, noPostgres.message, noPostgres.doInstead);
    return;
  }

  plan.push({ step: "migrate", command: "pnpm db:migrate" });
  if (seed === "phase1") {
    plan.push({ step: "seed", command: "pnpm db:seed:phase1" });
  } else if (seed === "demo") {
    plan.push({ step: "seed", command: "pnpm seed:demo" });
  }

  const pids = {};
  if (surfaces.includes("api")) {
    plan.push({ step: "start", name: "api", command: "pnpm dev:api", port: 3001 });
  }
  if (surfaces.includes("internal")) {
    plan.push({ step: "start", name: "internal", command: "pnpm dev:internal", port: 3000 });
  }
  if (surfaces.includes("wholesale")) {
    plan.push({ step: "start", name: "wholesale", command: "pnpm dev:wholesale", port: 3002 });
  }

  if (dryRun) {
    succeed("launch", { dryRun: true, seed, surfaces, postgresMode, plan, started: false });
    return;
  }

  for (const surface of surfaces) {
    const port = PORT_BY_SURFACE[surface];
    if (!(await tcpOpen("127.0.0.1", port))) {
      continue;
    }
    const ours = existing?.pids?.[surface];
    if (ours && pidAlive(ours)) {
      continue;
    }
    fail(
      "launch",
      "PORT_IN_USE",
      `Port ${port} (${surface}) is already taken.`,
      "node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs attach   or stop the other process by its PID, then launch",
      { port, surface },
    );
    return;
  }

  let startedCompose = false;
  if (postgresMode === "compose" && !postgresUpBeforeLaunch) {
    const compose = runCommand("docker", ["compose", "up", "-d", "--wait"], { timeoutMs: 180_000 });
    if (compose.status !== 0) {
      fail(
        "launch",
        "COMPOSE_FAILED",
        compose.stderr || compose.stdout || compose.error || "docker compose up failed",
        "Fix Docker, then rerun launch. Check docker compose ps.",
      );
      return;
    }
    startedCompose = true;
  }

  const migrate = runCommand("pnpm", ["db:migrate"], { timeoutMs: 120_000 });
  if (migrate.status !== 0) {
    const tables = runCommand(
      "psql",
      [
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "dc_inventory",
        "-tAc",
        "SELECT to_regclass('identity.staff_users')",
      ],
      { env: { PGPASSWORD: "postgres" }, timeoutMs: 10_000 },
    );
    const staffTable = (tables.stdout || "").trim();
    if (staffTable !== "identity.staff_users") {
      fail(
        "launch",
        "MIGRATE_FAILED",
        migrate.stderr || migrate.stdout || "pnpm db:migrate failed",
        "Confirm DATABASE_URL in apps/api/.env points at local Postgres, then rerun launch",
      );
      return;
    }
    plan.push({
      step: "migrate",
      warning:
        "pnpm db:migrate exited 1 but identity.staff_users exists. Continuing. drizzle-kit often prints IF EXISTS notices and still exits 1 in this environment.",
    });
  }

  if (seed === "phase1") {
    const seeded = runCommand("pnpm", ["db:seed:phase1"], { timeoutMs: 60_000 });
    if (seeded.status !== 0) {
      fail(
        "launch",
        "SEED_FAILED",
        seeded.stderr || seeded.stdout || "pnpm db:seed:phase1 failed",
        "Copy apps/api/.env.example to apps/api/.env so PHASE1_STAFF_PASSWORD is set, then rerun",
      );
      return;
    }
  } else if (seed === "demo") {
    const seeded = runCommand("pnpm", ["seed:demo"], { timeoutMs: 30 * 60_000 });
    if (seeded.status !== 0) {
      fail(
        "launch",
        "SEED_FAILED",
        seeded.stderr || seeded.stdout || "pnpm seed:demo failed",
        "Demo seed allows only localhost. A dirty book needs DEMO_SEED_RESET=1. Catalog stays empty either way.",
      );
      return;
    }
  }

  ensureDir(RUN_DIR);

  if (surfaces.includes("api") && !(await tcpOpen("127.0.0.1", 3001))) {
    pids.api = spawnLogged("pnpm", ["dev:api"], join(RUN_DIR, "api.log"));
  }
  if (surfaces.includes("internal") && !(await tcpOpen("127.0.0.1", 3000))) {
    pids.internal = spawnLogged("pnpm", ["dev:internal"], join(RUN_DIR, "internal.log"));
  }
  if (surfaces.includes("wholesale") && !(await tcpOpen("127.0.0.1", 3002))) {
    pids.wholesale = spawnLogged("pnpm", ["dev:wholesale"], join(RUN_DIR, "wholesale.log"));
  }

  const urls = {
    api: DEFAULTS.apiUrl,
    internal: DEFAULTS.internalUrl,
    wholesale: surfaces.includes("wholesale") ? DEFAULTS.wholesaleUrl : undefined,
  };

  try {
    await waitForHttp(`${urls.api}/health`, { timeoutMs: 90_000, accept: (s) => s === 200 });
    await waitForHttp(`${urls.api}/ready`, { timeoutMs: 90_000, accept: (s) => s === 200 });
    if (surfaces.includes("internal")) {
      await waitForHttp(urls.internal, { timeoutMs: 120_000, accept: (s) => s > 0 && s < 500 });
    }
    if (surfaces.includes("wholesale")) {
      await waitForHttp(urls.wholesale, { timeoutMs: 120_000, accept: (s) => s > 0 && s < 500 });
    }
  } catch (error) {
    const state = {
      startedBy: "control-dc-inventory",
      attach: false,
      startedCompose,
      seed,
      surfaces,
      pids,
      urls,
      logs: {
        api: " .cursor/skills/verify-dc-inventory/.run/api.log".trim(),
        internal: ".cursor/skills/verify-dc-inventory/.run/internal.log",
      },
    };
    writeState(state);
    fail(
      "launch",
      "NOT_READY",
      error instanceof Error ? error.message : String(error),
      "Read .cursor/skills/verify-dc-inventory/.run/api.log and internal.log, then teardown and launch again",
    );
    return;
  }

  const state = {
    startedBy: "control-dc-inventory",
    startedAt: new Date().toISOString(),
    attach: false,
    startedCompose,
    postgresMode,
    seed,
    surfaces,
    pids,
    urls,
    logs: {
      api: ".cursor/skills/verify-dc-inventory/.run/api.log",
      internal: ".cursor/skills/verify-dc-inventory/.run/internal.log",
      wholesale: ".cursor/skills/verify-dc-inventory/.run/wholesale.log",
      chrome: ".cursor/skills/verify-dc-inventory/.run/chrome.log",
    },
  };
  writeState(state);
  succeed("launch", {
    dryRun: false,
    seed,
    surfaces,
    postgresMode,
    pids,
    urls,
    copiedEnv: copied,
    note: "Catalog stays empty after phase1/demo seed until Product Browser import.",
  });
}

async function cmdAttach(flags) {
  const state = {
    startedBy: "control-dc-inventory",
    startedAt: new Date().toISOString(),
    attach: true,
    startedCompose: false,
    pids: {},
    urls: {
      internal: flagString(flags, "internal-url") ?? DEFAULTS.internalUrl,
      api: flagString(flags, "api-url") ?? DEFAULTS.apiUrl,
      wholesale: flagString(flags, "wholesale-url") ?? DEFAULTS.wholesaleUrl,
    },
  };
  writeState(state);
  succeed("attach", { urls: state.urls, attach: true, note: "teardown will not kill these servers" });
}

async function cmdTeardown(flags) {
  const dryRun = flagBool(flags, "dry-run");
  const keepCompose = flagBool(flags, "keep-compose");
  const state = readState();
  if (!state) {
    succeed("teardown", {
      dryRun,
      stopped: [],
      note: "No .run/state.json. Nothing to kill. evidence/ was not touched.",
    });
    return;
  }
  const plan = [];
  if (!state.attach) {
    for (const [name, pid] of Object.entries(state.pids ?? {})) {
      plan.push({ name, pid, alive: pidAlive(pid) });
    }
  }
  if (state.browser?.pid) {
    plan.push({ name: "browser", pid: state.browser.pid, alive: pidAlive(state.browser.pid) });
  }
  if (state.startedCompose && !keepCompose) {
    plan.push({ name: "compose", command: "docker compose stop" });
  }
  if (dryRun) {
    succeed("teardown", {
      dryRun: true,
      plan,
      wouldRemoveState: true,
      wouldKeepEvidence: true,
      evidenceDir: EVIDENCE_DIR.replace(`${REPO_ROOT}/`, ""),
    });
    return;
  }
  const stopped = [];
  if (!state.attach) {
    for (const [name, pid] of Object.entries(state.pids ?? {})) {
      stopped.push({ name, ...killPid(pid) });
    }
  }
  if (state.browser?.pid) {
    stopped.push({ name: "browser", ...killPid(state.browser.pid) });
  }
  if (state.startedCompose && !keepCompose && which("docker")) {
    runCommand("docker", ["compose", "stop"], { timeoutMs: 60_000 });
    stopped.push({ name: "compose", killed: true, reason: "docker compose stop" });
  }
  rmSync(CHROME_PROFILE, { recursive: true, force: true });
  rmSync(STATE_PATH, { force: true });
  succeed("teardown", {
    dryRun: false,
    stopped,
    evidencePreserved: existsSync(EVIDENCE_DIR),
    evidenceDir: EVIDENCE_DIR.replace(`${REPO_ROOT}/`, ""),
  });
}

async function prepareDrive(flags) {
  let state = readState();
  if (!state) {
    state = {
      startedBy: "control-dc-inventory",
      attach: true,
      pids: {},
      urls: {
        internal: DEFAULTS.internalUrl,
        api: DEFAULTS.apiUrl,
        wholesale: DEFAULTS.wholesaleUrl,
      },
    };
    writeState(state);
  }
  state = await ensureBrowser(state);
  return state;
}

async function cmdGoto(flags) {
  const path = flagString(flags, "path");
  if (!path) {
    fail("goto", "MISSING_PATH", "--path is required", "Pass --path /catalog");
    return;
  }
  const surface = flagString(flags, "surface") ?? "internal";
  const state = await prepareDrive(flags);
  const base = originFor(surface, state);
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const result = await withPage(state, async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return { url: page.url(), title: await page.title() };
  });
  succeed("goto", { surface, ...result });
}

async function cmdClick(flags) {
  const state = await prepareDrive(flags);
  if (flagString(flags, "x") !== undefined || flagString(flags, "y") !== undefined) {
    if (!flagBool(flags, "force-coords")) {
      fail(
        "click",
        "COORDS_BLOCKED",
        "Coordinate clicks need --force-coords.",
        "Use --role/--name, --label, --testid, or --selector instead",
      );
      return;
    }
    const x = Number(flagString(flags, "x"));
    const y = Number(flagString(flags, "y"));
    await withPage(state, async (page) => {
      await page.mouse.click(x, y);
    });
    succeed("click", { method: "coords", x, y });
    return;
  }
  try {
    await withPage(state, async (page) => {
      const { locator } = scopedLocator(page, flags);
      if (!locator) {
        throw new Error("Need --role/--name, --label, --testid, or --selector");
      }
      await locator.first().click({ timeout: 15_000 });
    });
  } catch (error) {
    fail(
      "click",
      "CLICK_FAILED",
      error instanceof Error ? error.message : String(error),
      "Run snapshot --aria, then click a role+name from that tree",
    );
    return;
  }
  succeed("click", {
    role: flagString(flags, "role") ?? null,
    name: flagString(flags, "name") ?? null,
    testid: flagString(flags, "testid") ?? null,
  });
}

function fillValue(flags, command) {
  const fromEnv = flagString(flags, "value-from-env");
  if (fromEnv) {
    const secret = resolveSecret(fromEnv);
    if (!secret.value) {
      fail(
        command,
        "SECRET_MISSING",
        `${fromEnv} is not set.`,
        "Copy apps/api/.env.example to apps/api/.env, or export the variable. Do not invent a password.",
      );
      return null;
    }
    return { value: secret.value, passwordSource: secret.source };
  }
  const value = flagString(flags, "value");
  if (value === undefined) {
    fail(
      command,
      "MISSING_VALUE",
      "Pass --value or --value-from-env NAME",
      "For passwords use --value-from-env PHASE1_STAFF_PASSWORD",
    );
    return null;
  }
  return { value, passwordSource: null };
}

async function cmdFill(flags) {
  const parsed = fillValue(flags, "fill");
  if (!parsed) {
    return;
  }
  const state = await prepareDrive(flags);
  try {
    await withPage(state, async (page) => {
      const { locator } = scopedLocator(page, flags);
      if (!locator) {
        throw new Error("Need --role/--name, --label, --testid, or --selector");
      }
      await locator.first().fill(parsed.value, { timeout: 15_000 });
    });
  } catch (error) {
    fail(
      "fill",
      "FILL_FAILED",
      error instanceof Error ? error.message : String(error),
      "Run snapshot --aria and target a textbox by its accessible name",
    );
    return;
  }
  succeed("fill", {
    role: flagString(flags, "role") ?? null,
    name: flagString(flags, "name") ?? flagString(flags, "label") ?? null,
    usedEnv: flagString(flags, "value-from-env") ?? null,
    passwordSource: parsed.passwordSource,
    valueLength: parsed.value.length,
  });
}

async function cmdType(flags) {
  const text = flagString(flags, "text");
  if (text === undefined) {
    fail("type", "MISSING_TEXT", "--text is required", "Pass --text {Enter} or visible characters");
    return;
  }
  const state = await prepareDrive(flags);
  try {
    await withPage(state, async (page) => {
      const { locator } = scopedLocator(page, flags);
      if (locator) {
        await locator.first().pressSequentially(text, { timeout: 15_000 });
        return;
      }
      await page.keyboard.type(text);
    });
  } catch (error) {
    fail("type", "TYPE_FAILED", error instanceof Error ? error.message : String(error), "Focus a field first or pass --label");
    return;
  }
  succeed("type", { length: text.length });
}

async function cmdPress(flags) {
  const key = flagString(flags, "key");
  if (!key) {
    fail("press", "MISSING_KEY", "--key is required", "Pass --key Escape or --key Enter");
    return;
  }
  const state = await prepareDrive(flags);
  await withPage(state, async (page) => {
    await page.keyboard.press(key);
  });
  succeed("press", { key });
}

async function cmdLoginStaff(flags) {
  const org = flagString(flags, "org") ?? ORG_SLUG;
  const email = flagString(flags, "email") ?? STAFF_EMAIL;
  const secret = resolveSecret("PHASE1_STAFF_PASSWORD");
  if (!secret.value) {
    fail(
      "login-staff",
      "SECRET_MISSING",
      "PHASE1_STAFF_PASSWORD is not set.",
      "Copy apps/api/.env.example to apps/api/.env and rerun login-staff. Do not invent a password.",
    );
    return;
  }
  const state = await prepareDrive(flags);
  try {
    const result = await withPage(state, async (page) => {
      await page.goto(`${originFor("internal", state)}/catalog`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const heading = page.getByRole("heading", { name: "Catalog" });
      const emailField = page.getByLabel("Email");
      if (await heading.isVisible().catch(() => false) && !(await emailField.isVisible().catch(() => false))) {
        return { alreadySignedIn: true, url: page.url() };
      }
      await emailField.waitFor({ state: "visible", timeout: 20_000 });
      await page.getByLabel("Organization").fill(org);
      await emailField.fill(email);
      await page.getByLabel("Password").fill(secret.value);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("heading", { name: "Catalog" }).waitFor({ state: "visible", timeout: 30_000 });
      await page.getByLabel("Email").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
      return { alreadySignedIn: false, url: page.url() };
    });
    succeed("login-staff", {
      ...result,
      org,
      email,
      passwordSource: secret.source,
    });
  } catch (error) {
    fail(
      "login-staff",
      "LOGIN_FAILED",
      error instanceof Error ? error.message : String(error),
      "Run doctor. If API /ready is down, launch again. If the form shows Sign-in failed, the password in apps/api/.env does not match the seeded hash.",
    );
  }
}

async function cmdLoginWholesale(flags) {
  const org = flagString(flags, "org") ?? ORG_SLUG;
  const email = flagString(flags, "email") ?? WHOLESALE_EMAIL;
  const secret = resolveSecret("PHASE1_WHOLESALE_PASSWORD");
  if (!secret.value) {
    fail(
      "login-wholesale",
      "SECRET_MISSING",
      "PHASE1_WHOLESALE_PASSWORD is not set.",
      "Copy apps/api/.env.example to apps/api/.env and rerun. Do not invent a password.",
    );
    return;
  }
  const state = await prepareDrive(flags);
  try {
    const result = await withPage(state, async (page) => {
      await page.goto(`${originFor("wholesale", state)}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.getByLabel("Email").waitFor({ state: "visible", timeout: 20_000 });
      await page.getByLabel("Organization").fill(org);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(secret.value);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL(/\/products/, { timeout: 30_000 });
      return { url: page.url() };
    });
    succeed("login-wholesale", { ...result, org, email, passwordSource: secret.source });
  } catch (error) {
    fail(
      "login-wholesale",
      "LOGIN_FAILED",
      error instanceof Error ? error.message : String(error),
      "Launch with --surfaces wholesale and confirm the API is up. Seed must have created wholesale@local.test.",
    );
  }
}

async function cmdWaitSettle(flags) {
  const timeoutMs = Number(flagString(flags, "timeout-ms") ?? 30_000);
  const state = await prepareDrive(flags);
  await withPage(state, async (page) => {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => undefined);
    await page.getByRole("button", { name: "Signing in…" }).waitFor({ state: "hidden", timeout: 5_000 }).catch(
      () => undefined,
    );
    await sleep(300);
  });
  succeed("wait-settle", { timeoutMs });
}

async function cmdSnapshot(flags) {
  if (!flagBool(flags, "aria") && flagString(flags, "aria") === undefined) {
    fail(
      "snapshot",
      "NEED_ARIA",
      "Pass --aria (the only snapshot format this CLI ships).",
      "control-dc-inventory.mjs snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.aria.yml",
    );
    return;
  }
  const state = await prepareDrive(flags);
  const outPath = resolveOutPath(flagString(flags, "path"));
  const tree = await withPage(state, async (page) => {
    if (typeof page.locator("body").ariaSnapshot === "function") {
      return page.locator("body").ariaSnapshot();
    }
    const ax = await page.accessibility.snapshot({ interestingOnly: false });
    return JSON.stringify(ax, null, 2);
  });
  if (outPath) {
    ensureDir(dirname(outPath));
    writeFileSync(outPath, `${tree}\n`);
  }
  succeed("snapshot", {
    format: "aria",
    path: outPath ? outPath.replace(`${REPO_ROOT}/`, "") : null,
    preview: String(tree).slice(0, 4000),
  });
}

async function cmdScreenshot(flags) {
  const state = await prepareDrive(flags);
  const outPath =
    resolveOutPath(flagString(flags, "path")) ??
    join(EVIDENCE_DIR, "scratch", `screenshot-${Date.now()}.png`);
  ensureDir(dirname(outPath));
  await withPage(state, async (page) => {
    await page.screenshot({ path: outPath, fullPage: flagBool(flags, "full-page") });
  });
  succeed("screenshot", {
    path: outPath.replace(`${REPO_ROOT}/`, ""),
    fullPage: flagBool(flags, "full-page"),
  });
}

async function cmdState(flags) {
  void flags;
  const state = await prepareDrive(flags);
  const info = await withPage(state, async (page, context) => {
    const cookies = await context.cookies();
    const names = new Set(cookies.map((cookie) => cookie.name));
    return {
      url: page.url(),
      title: await page.title(),
      staffSessionCookie: names.has("staff_session"),
      wholesaleSessionCookie: names.has("wholesale_session"),
      cookieNames: [...names].filter((name) => name !== "staff_session" && name !== "wholesale_session"),
    };
  });
  succeed("state", info);
}

const COMMANDS = {
  doctor: cmdDoctor,
  launch: cmdLaunch,
  attach: cmdAttach,
  teardown: cmdTeardown,
  goto: cmdGoto,
  click: cmdClick,
  fill: cmdFill,
  type: cmdType,
  press: cmdPress,
  "login-staff": cmdLoginStaff,
  "login-wholesale": cmdLoginWholesale,
  "wait-settle": cmdWaitSettle,
  snapshot: cmdSnapshot,
  screenshot: cmdScreenshot,
  state: cmdState,
};

async function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const command = positionals[0];
  if (!command || flagBool(flags, "help") || command === "help") {
    if (command && command !== "help" && COMMAND_HELP[command]) {
      process.stdout.write(COMMAND_HELP[command]);
      return;
    }
    process.stdout.write(USAGE);
    return;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    fail(
      command,
      "UNKNOWN_COMMAND",
      `Unknown command "${command}".`,
      "node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs --help",
    );
    return;
  }
  if (flagBool(flags, "help")) {
    process.stdout.write(COMMAND_HELP[command] ?? USAGE);
    return;
  }
  try {
    await handler(flags);
  } catch (error) {
    fail(
      command,
      "CRASH",
      error instanceof Error ? error.message : String(error),
      "Read the error, run doctor, then teardown --dry-run if you started a broken stack",
    );
  }
}

await main();
chmodSync(fileURLToPath(import.meta.url), 0o755);
