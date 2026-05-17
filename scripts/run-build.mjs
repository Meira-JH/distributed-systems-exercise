import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function collectWorkspacePackages(baseDir) {
  const absoluteBaseDir = path.join(rootDir, baseDir);
  const entries = await readdir(absoluteBaseDir, { withFileTypes: true }).catch(() => []);
  const workspacePackages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(absoluteBaseDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    let packageJsonSource;

    try {
      packageJsonSource = await readFile(packageJsonPath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    let packageJson;

    try {
      packageJson = JSON.parse(packageJsonSource);
    } catch {
      console.error(`The workspace package at ${path.join(baseDir, entry.name)} has an invalid package.json.`);
      process.exit(1);
    }

    workspacePackages.push({
      absoluteDir: packageDir,
      relativeDir: path.join(baseDir, entry.name),
      packageJson,
    });
  }

  return workspacePackages;
}

const workspacePackages = [
  ...(await collectWorkspacePackages("packages")),
  ...(await collectWorkspacePackages("apps")),
];

if (workspacePackages.length === 0) {
  console.log("No workspace packages are bootstrapped yet.");
  process.exit(0);
}

const packagesMissingBuildScript = workspacePackages.filter(
  ({ packageJson }) => typeof packageJson.scripts?.build !== "string",
);

if (packagesMissingBuildScript.length > 0) {
  console.error("The following workspace packages are missing a build script:");

  for (const workspacePackage of packagesMissingBuildScript) {
    console.error(`- ${workspacePackage.relativeDir}`);
  }

  process.exit(1);
}

for (const workspacePackage of workspacePackages) {
  const result = spawnSync(npmCommand, ["--prefix", workspacePackage.absoluteDir, "run", "build"], {
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
