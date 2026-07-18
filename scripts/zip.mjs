import { readFileSync, createWriteStream } from "fs"
import { readdir } from "fs/promises"
import { join, relative } from "path"
import { fileURLToPath } from "url"
import { ZipArchive } from "archiver"

const DIR = fileURLToPath(new URL("..", import.meta.url))
const { version } = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"))
const DIST = join(DIR, "dist")
const OUT = join(DIR, `linkedin-comment-generator-v${version}.zip`)

const output = createWriteStream(OUT)
const archive = new ZipArchive({ zlib: { level: 9 } })

output.on("close", () => {
  console.log(`Created ${OUT} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`)
})

archive.on("warning", (err) => { if (err.code !== "ENOENT") throw err })
archive.on("error", (err) => { throw err })

archive.pipe(output)

async function addDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await addDir(fullPath)
    } else if (!entry.name.endsWith(".map")) {
      const archivePath = relative(DIST, fullPath).replace(/\\/g, "/")
      archive.file(fullPath, { name: archivePath })
    }
  }
}

await addDir(DIST)
await archive.finalize()
