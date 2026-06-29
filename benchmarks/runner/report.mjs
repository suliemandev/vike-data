// report.json read/append helpers, shared by the runner (and, later, the Phase 4 aggregator).
// Each entry: { framework, task, minutes, interventions, status, at }.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const REPORT_PATH = resolve(here, 'report.json')

export function readReport() {
  if (!existsSync(REPORT_PATH)) return []
  try {
    const data = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function appendReport(entry) {
  const all = readReport()
  all.push({ ...entry, at: new Date().toISOString() })
  writeFileSync(REPORT_PATH, `${JSON.stringify(all, null, 2)}\n`)
  return REPORT_PATH
}
