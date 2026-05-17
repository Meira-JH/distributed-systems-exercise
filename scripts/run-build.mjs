import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function collectWorkspaceDirs(baseDir) {
  const absoluteBaseDir = path.join(rootDir, baseDir);
  const entries = await readdir(absoluteBaseDir, { withFileTypes: true }).catch(() => []);
  const packageDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(absoluteBaseDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");

    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

      if (packageJson.scripts && typeof packageJson.scripts.build === "string") {
        packageDirs.push(packageDir);
      }
    } catch {
      continue;
    }
  }

  return packageDirs;
}

const buildTargets = [
  ...(await collectWorkspaceDirs("packages")),
  ...(await collectWorkspaceDirs("apps")),
];

if (buildTargets.length === 0) {
  console.log("No workspace packages define a build script yet.");
  process.exit(0);
}

for (const buildTarget of buildTargets) {
  const result = spawnSync(npmCommand, ["--prefix", buildTarget, "run", "build"], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
