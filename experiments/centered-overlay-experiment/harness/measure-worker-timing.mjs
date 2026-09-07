import { spawnSync } from "node:child_process"
import { writeFile } from "node:fs/promises"

const count = 20
const rows = []
for (let sample = 0; sample < count; sample += 1) {
  const child = spawnSync(process.execPath, ["harness/worker-timing-sample.mjs"], {
    cwd: process.cwd(), encoding: "utf8"
  })
  if (child.status !== 0) throw new Error(child.stderr || `sample ${sample} failed`)
  rows.push(JSON.parse(child.stdout))
}
const summarize = (key) => {
  const values = rows.map((row) => row[key]).sort((a, b) => a - b)
  const at = (p) => values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)]
  return { median: at(0.5), p90: at(0.9), min: values[0], max: values.at(-1) }
}
const result = {
  environment: "Node process harness; not Chrome/Dia service-worker timing",
  sampleCount: count,
  importMs: summarize("importMs"),
  firstActionToExecuteScriptMs: summarize("firstActionToExecuteScriptMs"),
  secondActionToExecuteScriptMs: summarize("secondActionToExecuteScriptMs"),
  firstModelRoundtripMs: summarize("firstModelRoundtripMs"),
  secondModelRoundtripMs: summarize("secondModelRoundtripMs"),
  raw: rows
}
await writeFile("harness/worker-timing-results.json", `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
