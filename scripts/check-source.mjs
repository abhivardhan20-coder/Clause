import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
let bytes = 0;
for (const path of files) {
  const stat = statSync(path);
  bytes += stat.size;
  if (
    /(?:^|\/)(?:\.dev\.vars|\.env(?:\.|$))/.test(path) &&
    path !== ".env.example"
  )
    throw new Error("Private environment file included: " + path);
  if (/\.(?:[cm]?[jt]sx?|json|md|ya?ml|sql|css|html)$/.test(path)) {
    const text = readFileSync(path, "utf8");
    if (/AIza[0-9A-Za-z_-]{35}|sk-(?:proj-)?[0-9A-Za-z_-]{40,}/.test(text))
      throw new Error("Possible credential in " + path);
  }
}
if (bytes >= 10_000_000)
  throw new Error("Source exceeds the submission's 10 MB limit.");
console.log(
  JSON.stringify({
    sourceFiles: files.length,
    sourceBytes: bytes,
    under10MB: true,
    secretScan: "passed",
  }),
);
