import { build } from "esbuild"
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const outdir = path.join(root, "dist", "unpacked")
await rm(path.join(root, "dist"), { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const result = await build({
  entryPoints: {
    background: path.join(root, "src", "background.ts"),
    popup: path.join(root, "src", "popup.ts")
  },
  outdir,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  metafile: true,
  sourcemap: false
})

for (const file of ["manifest.json", "popup.html", "popup.css"]) {
  await cp(path.join(root, file), path.join(outdir, file))
}

const files = ["manifest.json", "popup.html", "popup.css", "background.js", "popup.js"]
const sizes = Object.fromEntries(
  await Promise.all(files.map(async (file) => [file, (await stat(path.join(outdir, file))).size]))
)
const report = {
  builtAt: new Date().toISOString(),
  effectVersion: JSON.parse(await readFile(path.join(root, "node_modules", "effect", "package.json"), "utf8")).version,
  files: sizes,
  totalUnpackedBytes: Object.values(sizes).reduce((sum, size) => sum + size, 0),
  bundledJavaScriptBytes: Object.entries(result.metafile.outputs)
    .filter(([file]) => file.endsWith(".js"))
    .reduce((sum, [, output]) => sum + output.bytes, 0)
}
await writeFile(path.join(root, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
