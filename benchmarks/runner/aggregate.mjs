#!/usr/bin/env node
// Phase 4 aggregator (#344).
//
// Reads benchmark run entries and renders one comparison table: time + interventions, per task,
// per framework, side by side, with the vike-vs-next delta that is the headline of the write-up.
//
// Source precedence: --input <file> overrides everything; otherwise the committed baseline.json
// is used if it exists, falling back to the ad-hoc (git-ignored) report.json. Pass --report to
// force report.json.
//
// Multiple entries for the same (framework, task) are aggregated: minutes/interventions are
// averaged across runs, and the status column shows how many of those runs passed.
//
// Usage:
//   node benchmarks/runner/aggregate.mjs                 # markdown table from baseline/report
//   node benchmarks/runner/aggregate.mjs --json          # machine-readable aggregate
//   node benchmarks/runner/aggregate.mjs --report        # force report.json as the source
//   node benchmarks/runner/aggregate.mjs --input f.json  # aggregate an explicit file
//   node benchmarks/runner/aggregate.mjs --save-baseline # promote report.json -> baseline.json
//
// --save-baseline copies the current report.json verbatim into the committed baseline.json so a
// measurement session ends in one command; commit baseline.json to track the numbers over time.

import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BASELINE_PATH, REPORT_PATH, readBaseline, readReport } from './report.mjs'

// Display order + label for the frameworks; anything else falls in after these, alphabetically.
const FRAMEWORK_ORDER = ['vike', 'next']
const FRAMEWORK_LABEL = { vike: 'vike', next: 'next' }

// task number -> extension under test (mirrors spec/task-set.md).
const EXTENSION_BY_NUM = {
  '001': 'data (guard)',
  '002': 'auth',
  '003': 'notifications',
  '004': 'stripe',
  '005': 'ai',
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const flags = new Set(['json', 'report', 'save-baseline'])
    if (flags.has(key)) args[key] = true
    else args[key] = argv[++i]
  }
  return args
}

function extensionFor(task) {
  const m = String(task).match(/(\d{3})/)
  return (m && EXTENSION_BY_NUM[m[1]]) || ''
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (n) => Math.round(n * 10) / 10
// Integers print clean; averaged fractions keep one decimal.
const num = (n) => (Number.isInteger(n) ? String(n) : String(round1(n)))

/** Group entries into task -> framework -> aggregate, preserving first-seen task order. */
function aggregate(entries) {
  const tasks = new Map()
  for (const e of entries) {
    if (!e || !e.task || !e.framework) continue
    if (!tasks.has(e.task)) tasks.set(e.task, new Map())
    const byFw = tasks.get(e.task)
    if (!byFw.has(e.framework)) byFw.set(e.framework, [])
    byFw.get(e.framework).push(e)
  }

  const result = []
  for (const [task, byFw] of tasks) {
    const frameworks = {}
    for (const [fw, runs] of byFw) {
      const passes = runs.filter((r) => r.status === 'pass').length
      // v2 correctness gates, summed across this (framework, task)'s runs.
      const allGates = runs.flatMap((r) => (Array.isArray(r.gates) ? r.gates : []))
      // v2 burden: bespoke security/correctness decisions made unaided (a latent-bug proxy).
      const burdens = runs.map((r) => r.burden).filter((b) => b != null).map(Number)
      frameworks[fw] = {
        runs: runs.length,
        passes,
        minutes: round1(mean(runs.map((r) => Number(r.minutes) || 0))),
        interventions: round1(mean(runs.map((r) => Number(r.interventions) || 0))),
        status: passes === runs.length ? 'pass' : passes === 0 ? 'dnf' : `${passes}/${runs.length}`,
        gatesPassed: allGates.filter((g) => g && g.passed).length,
        gatesTotal: allGates.length,
        burden: burdens.length ? round1(mean(burdens)) : null,
      }
    }
    result.push({ task, extension: extensionFor(task), frameworks })
  }
  return result
}

/** Order the framework keys present across the aggregate: known ones first, then the rest. */
function frameworkColumns(rows) {
  const present = new Set()
  for (const r of rows) for (const fw of Object.keys(r.frameworks)) present.add(fw)
  const known = FRAMEWORK_ORDER.filter((fw) => present.has(fw))
  const extra = [...present].filter((fw) => !FRAMEWORK_ORDER.includes(fw)).sort()
  return [...known, ...extra]
}

function cell(agg) {
  if (!agg) return '–'
  const status = agg.status === 'pass' ? '' : ` (${agg.status})`
  // Correctness gates lead (the v2 primary axis), then minutes / interventions, then burden
  // (bespoke security decisions made unaided — the latent-bug proxy).
  const gates = agg.gatesTotal ? `${agg.gatesPassed}/${agg.gatesTotal} gates · ` : ''
  const burden = agg.burden != null ? ` · ${num(agg.burden)} burden` : ''
  return `${gates}${num(agg.minutes)}m / ${num(agg.interventions)}${burden}${status}`
}

/** Render the markdown comparison table. Delta columns are vike − next when both are present. */
function renderMarkdown(rows) {
  const cols = frameworkColumns(rows)
  const showDelta = cols.includes('vike') && cols.includes('next')

  const head = ['Task', 'Extension', ...cols.map((fw) => `${FRAMEWORK_LABEL[fw] || fw} (min / intv)`)]
  if (showDelta) head.push('Δ min', 'Δ intv')

  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`]

  const totals = Object.fromEntries(cols.map((fw) => [fw, { minutes: 0, interventions: 0, has: false }]))
  for (const r of rows) {
    const row = [r.task, r.extension, ...cols.map((fw) => cell(r.frameworks[fw]))]
    for (const fw of cols) {
      const a = r.frameworks[fw]
      if (a) {
        totals[fw].minutes += a.minutes
        totals[fw].interventions += a.interventions
        totals[fw].has = true
      }
    }
    if (showDelta) {
      const v = r.frameworks.vike
      const n = r.frameworks.next
      if (v && n) {
        row.push(signed(v.minutes - n.minutes, 'm'), signed(v.interventions - n.interventions, ''))
      } else {
        row.push('–', '–')
      }
    }
    lines.push(`| ${row.join(' | ')} |`)
  }

  const totalRow = [
    '**Total**',
    '',
    ...cols.map((fw) =>
      totals[fw].has ? `**${num(round1(totals[fw].minutes))}m / ${num(round1(totals[fw].interventions))}**` : '–',
    ),
  ]
  if (showDelta && totals.vike.has && totals.next.has) {
    totalRow.push(
      `**${signed(round1(totals.vike.minutes - totals.next.minutes), 'm')}**`,
      `**${signed(round1(totals.vike.interventions - totals.next.interventions), '')}**`,
    )
  } else if (showDelta) {
    totalRow.push('–', '–')
  }
  lines.push(`| ${totalRow.join(' | ')} |`)

  return lines.join('\n')
}

// Signed delta: a negative number is the vike advantage (faster / fewer interventions).
function signed(n, suffix) {
  const r = round1(n)
  return `${r > 0 ? '+' : ''}${num(r)}${suffix}`
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args['save-baseline']) {
    if (!existsSync(REPORT_PATH)) {
      console.error(`[aggregate] no report.json at ${REPORT_PATH}; run the benchmark first`)
      process.exit(1)
    }
    copyFileSync(REPORT_PATH, BASELINE_PATH)
    console.log(`[aggregate] promoted report.json -> ${BASELINE_PATH} (commit it to track the baseline)`)
    return
  }

  let entries
  let source
  if (args.input) {
    source = args.input
    entries = readEntriesFrom(resolve(process.cwd(), args.input))
  } else if (args.report) {
    source = 'report.json'
    entries = readReport()
  } else if (existsSync(BASELINE_PATH)) {
    source = 'baseline.json'
    entries = readBaseline()
  } else {
    source = 'report.json'
    entries = readReport()
  }

  const rows = aggregate(entries)

  if (args.json) {
    console.log(JSON.stringify({ source, tasks: rows }, null, 2))
    return
  }

  if (rows.length === 0) {
    console.log(`No benchmark entries found (source: ${source}). Run benchmarks/runner/run.mjs first.`)
    return
  }

  console.log(`# Benchmark results (source: ${source})\n`)
  console.log(renderMarkdown(rows))
  console.log(
    '\n_gates = v2 correctness gates passed/total (the primary axis: fewer gates passed loses on' +
      ' correctness regardless of minutes); min = real AI minutes; intv = human interventions;' +
      ' burden = bespoke security/correctness decisions made unaided (a latent-bug proxy);' +
      ' Δ is vike − next minutes/intv (negative favours vike)._',
  )
}

// Read an arbitrary entries file (used by --input); same tolerant parse as report.mjs.
function readEntriesFrom(path) {
  if (!existsSync(path)) {
    console.error(`[aggregate] input not found: ${path}`)
    process.exit(1)
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

main()
