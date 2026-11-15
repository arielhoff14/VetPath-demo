import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = path.resolve("artifacts/video");
const manifest = JSON.parse(await readFile(root + "/manifest.json", "utf8"));
let elapsed = 0;
let metadata =
  ";FFMETADATA1\ntitle=VetPath — verified public demo\ncomment=Real public deployment recorded using isolated owner and clinic browser sessions. Fictional patient data only.\n";
for (const clip of manifest.clips) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      clip.file,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  const duration = Math.round(Number(result.stdout) * 1000);
  metadata += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${elapsed}\nEND=${elapsed + duration}\ntitle=${clip.title}\n`;
  elapsed += duration;
}
await writeFile(
  root + "/concat.txt",
  manifest.clips
    .map((c) => `file '${c.file.replaceAll("'", "'\\''")}'`)
    .join("\n"),
);
await writeFile(root + "/chapters.txt", metadata);
const ff = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    root + "/concat.txt",
    "-i",
    root + "/chapters.txt",
    "-map_metadata",
    "1",
    "-map_chapters",
    "1",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-vf",
    "fps=25",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    root + "/vetpath-demo.mp4",
  ],
  { stdio: "inherit" },
);
if (ff.status !== 0) process.exit(ff.status || 1);
console.log(
  `Rendered ${manifest.clips.length} chapters, ${(elapsed / 1000).toFixed(1)} seconds.`,
);
