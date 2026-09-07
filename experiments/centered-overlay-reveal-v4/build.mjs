import { build } from "esbuild"
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const outdir = path.join(root, "dist", "unpacked")
await rm(path.join(root, "dist"), { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const common = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  sourcemap: false,
  metafile: true
}
const background = await build({
  ...common,
  entryPoints: [path.join(root, "src", "background.ts")],
  outfile: path.join(outdir, "background.js"),
  format: "esm"
})
const overlay = await build({
  ...common,
  entryPoints: [path.join(root, "src", "overlay.ts")],
  outfile: path.join(outdir, "overlay.js"),
  format: "iife"
})
await cp(path.join(root, "manifest.json"), path.join(outdir, "manifest.json"))

const files = ["manifest.json", "background.js", "overlay.js"]
const sizes = Object.fromEntries(
  await Promise.all(files.map(async (file) => [file, (await stat(path.join(outdir, file))).size]))
)
const outputs = { ...background.metafile.outputs, ...overlay.metafile.outputs }
const report = {
  builtAt: new Date().toISOString(),
  effectVersion: JSON.parse(await readFile(path.join(root, "node_modules", "effect", "package.json"), "utf8")).version,
  files: sizes,
  totalUnpackedBytes: Object.values(sizes).reduce((sum, size) => sum + size, 0),
  bundledJavaScriptBytes: Object.values(outputs).reduce((sum, output) => sum + output.bytes, 0)
}
await writeFile(path.join(root, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
