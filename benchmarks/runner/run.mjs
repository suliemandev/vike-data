#!/usr/bin/env node
// Semi-automated benchmark runner.
//
// It automates the mechanical parts of a run — (optionally) reset the app to its baseline,
// boot it, poll the task's accept.mjs until it passes or times out, then append a report.json
// entry. The part it cannot automate is the agent itself: a human drives the AI coding agent
// against the running app in a separate terminal. That is the "semi" in semi-automated.
//
// Metric note: the headline metric is real AI minutes (agent execution time), which a generic
// script cannot observe. Pass the measured figure with --minutes; otherwise wall clock from
// start to accept-pass is recorded (an upper bound, since it includes human/idle time).
//
// Usage:
//   node benchmarks/runner/run.mjs --framework vike --task task-002-magic-link \
//     [--start-app] [--reset] [--baseurl URL] [--timeout 1800] [--poll 10] \
//     [--interventions N] [--minutes M] [--status pass|dnf]
//
// Typical loop (human drives the agent):
//   1. node run.mjs --framework vike --task task-002-magic-link --start-app --reset
//      -> resets + boots the app, then polls accept until it passes or times out.
//   2. In another terminal, run the coding agent on the task prompt against the app.
//   3. When accept passes the runner stops the clock; pass --interventions / --minutes to
//      record the human-tallied figures, or edit the emitted entry afterwards.

import { spawn } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { appendReport } from './report.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const benchRoot = resolve(here, '..') // benchmarks/
const repoRoot = resolve(benchRoot, '..') // repo root

// `clean` lists git-ignored runtime state (app-relative) to delete on --reset. `git clean -fdq`
// leaves ignored files, so without this the Next app's SQLite DB would carry notes/paid-state
// across runs while the Vike app (in-memory) starts fresh — an unfair asymmetry. The vike app
// keeps no on-disk state, so it has nothing to clean.
const FRAMEWORKS = {
  vike: { dir: 'examples/bench-app-vike', port: 3100, baseUrl: 'http://localhost:3100', clean: [] },
  next: { dir: 'examples/bench-app-next', port: 4311, baseUrl: 'http://localhost:4311', clean: ['data'] },
}

function parseArgs(argv) {
  const args = { timeout: 1800, poll: 10, interventions: 0 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const flags = new Set(['start-app', 'reset', 'skip-gates'])
    if (flags.has(key)) {
      args[key] = true
    } else {
      args[key] = argv[++i]
    }
  }
  return args
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Run a task's accept.mjs once. Resolves the exit code (0 = pass). */
function runAccept(taskName, baseUrl) {
  return runScript(resolve(benchRoot, 'tasks', taskName, 'accept.mjs'), baseUrl)
}

/** Run one script (accept- or gate-shaped) against the app once; resolve its exit code. */
function runScript(scriptPath, baseUrl) {
  return new Promise((resolveCode) => {
    const child = spawn('node', [scriptPath], {
      env: { ...process.env, BASE_URL: baseUrl },
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    child.on('exit', (code) => resolveCode(code ?? 1))
    child.on('error', () => resolveCode(1))
  })
}

/**
 * The correctness gates for a task: every `*-gate.mjs` in the task dir (methodology v2). Each is
 * a pass/fail adversarial check (e.g. an unsigned webhook must be rejected) that the happy-path
 * accept.mjs cannot see. Returns `[{ name, passed }]` (empty if a task ships no gates yet).
 */
async function runGates(taskName, baseUrl) {
  const taskDir = resolve(benchRoot, 'tasks', taskName)
  let files = []
  try {
    files = readdirSync(taskDir).filter((f) => f.endsWith('-gate.mjs')).sort()
  } catch {
    return []
  }
  const gates = []
  for (const file of files) {
    const code = await runScript(resolve(taskDir, file), baseUrl)
    gates.push({ name: file.replace(/-gate\.mjs$/, ''), passed: code === 0 })
  }
  return gates
}

/** Wait until the base URL responds (any HTTP status), or give up after `tries`. */
async function waitForServer(baseUrl, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(baseUrl)
      return true
    } catch {
      await sleep(1000)
    }
  }
  return false
}

/** Wait until the base URL STOPS responding (the port is freed after a kill), or give up. */
async function waitForServerDown(baseUrl, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(baseUrl)
      await sleep(500)
    } catch {
      return true
    }
  }
  return false
}

/** Delete a framework's git-ignored runtime state (e.g. the Next SQLite DB). Code is untouched. */
function wipeRuntimeState(appDir, fw) {
  for (const rel of fw.clean ?? []) {
    rmSync(resolve(appDir, rel), { recursive: true, force: true })
  }
}

/** Boot the app on its port (own process group). Resolve the child once it answers, else null. */
async function startApp(appDir, fw, baseUrl) {
  // detached: the app gets its own process group, so stopApp can kill the whole tree — `pnpm dev`
  // forks a dev worker (tsx / next-server) that survives a plain server.kill() and would keep
  // serving stale code on the port.
  const server = spawn('pnpm', ['dev'], {
    cwd: appDir,
    env: { ...process.env, PORT: String(fw.port) },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  const up = await waitForServer(baseUrl)
  if (!up) {
    await stopApp(server, baseUrl)
    return null
  }
  return server
}

/** Stop an app started by startApp: kill its process group, then wait until the port is freed. */
async function stopApp(server, baseUrl) {
  if (!server) return
  try {
    process.kill(-server.pid, 'SIGKILL') // negative pid -> the whole process group
  } catch {
    try {
      server.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }
  if (baseUrl) await waitForServerDown(baseUrl)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const fw = FRAMEWORKS[args.framework]
  if (!fw || !args.task) {
    console.error('usage: run.mjs --framework vike|next --task <task-name> [--start-app] [--reset] ...')
    process.exit(2)
  }
  const baseUrl = args.baseurl || fw.baseUrl
  const appDir = resolve(repoRoot, fw.dir)

  // Optional: reset the app to its committed baseline (the task's starting point).
  if (args.reset) {
    console.log(`[runner] resetting ${fw.dir} to HEAD`)
    await run('git', ['checkout', '--', appDir], repoRoot)
    await run('git', ['clean', '-fdq', appDir], repoRoot)
    // Drop git-ignored runtime state git clean -fdq leaves behind (e.g. the SQLite DB).
    wipeRuntimeState(appDir, fw)
  }

  // Optional: boot the app and tear it down at the end.
  let server = null
  if (args['start-app']) {
    console.log(`[runner] starting ${args.framework} app (${fw.dir}) on ${baseUrl}`)
    server = await startApp(appDir, fw, baseUrl)
    if (!server) {
      console.error('[runner] app did not become reachable; aborting')
      process.exit(1)
    }
  }

  console.log(`[runner] polling ${args.task} against ${baseUrl} every ${args.poll}s (timeout ${args.timeout}s)`)
  console.log('[runner] drive the coding agent now; the runner records when accept.mjs passes.')

  const startedAt = Date.now()
  const timeoutMs = Number(args.timeout) * 1000
  const pollMs = Number(args.poll) * 1000
  let status = 'dnf'

  while (Date.now() - startedAt < timeoutMs) {
    const code = await runAccept(args.task, baseUrl)
    if (code === 0) {
      status = 'pass'
      break
    }
    await sleep(pollMs)
  }

  // Correctness gates (v2): pass/fail adversarial checks the happy-path accept can't see;
  // correctness ranks above minutes in the aggregate. accept mutates app state (e.g. task-004's
  // accept pays the demo user), so a stateful gate run on the same boot gets a false FAIL (#363).
  // When the runner owns the app, restart it on clean runtime state first — no git checkout, the
  // code is unchanged since accept — so each gate runs against the baseline. When we don't own the
  // app we can't restart it; warn that gates run on accept's possibly-mutated boot.
  let gates = []
  if (status === 'pass' && !args['skip-gates']) {
    if (args['start-app']) {
      console.log('[runner] restarting app on clean state before gates (#363)')
      await stopApp(server, baseUrl)
      wipeRuntimeState(appDir, fw)
      server = await startApp(appDir, fw, baseUrl)
      if (!server) {
        console.error('[runner] app did not come back up for gates; aborting')
        process.exit(1)
      }
    } else {
      console.warn('[runner] gates run on the same boot as accept (no --start-app); accept state may leak. Run gates on a fresh boot manually (see #363).')
    }
    gates = await runGates(args.task, baseUrl)
    for (const g of gates) console.log(`[runner] gate ${g.name}: ${g.passed ? 'PASS' : 'FAIL'}`)
  }

  const wallMinutes = Math.round(((Date.now() - startedAt) / 60000) * 10) / 10
  const minutes = args.minutes != null ? Number(args.minutes) : wallMinutes
  const entry = {
    framework: args.framework,
    task: args.task,
    minutes,
    interventions: Number(args.interventions),
    status: args.status || status,
    ...(gates.length ? { gates } : {}),
    ...(args.burden != null ? { burden: Number(args.burden) } : {}),
  }

  await stopApp(server, baseUrl)

  const file = appendReport(entry)
  console.log(`[runner] ${status.toUpperCase()} in ~${wallMinutes}m`)
  console.log(`[runner] recorded ${JSON.stringify(entry)} -> ${file}`)
  process.exit(status === 'pass' ? 0 : 1)
}

/** Small promise wrapper around spawn for one-shot commands. */
function run(cmd, cmdArgs, cwd) {
  return new Promise((resolveDone, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolveDone() : reject(new Error(`${cmd} exited ${code}`))))
    child.on('error', reject)
  })
}

main().catch((err) => {
  console.error('[runner] crashed:', err)
  process.exit(2)
})
