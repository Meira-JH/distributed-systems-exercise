import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const [, , targetDirArg, scriptName, ...forwardedArgs] = process.argv;

if (!targetDirArg || !scriptName) {
  console.error("Usage: node ./scripts/run-package-script.mjs <directory> <script> [...args]");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = path.resolve(rootDir, targetDirArg);
const packageJsonPath = path.join(targetDir, "package.json");

let packageJson;

try {
  packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
} catch {
  console.error(
    `The workspace package at ${targetDirArg} is not bootstrapped yet. ` +
      "Finish the corresponding story before running this command.",
  );
  process.exit(1);
}

if (!packageJson.scripts || typeof packageJson.scripts[scriptName] !== "string") {
  console.error(`The script "${scriptName}" is not defined in ${targetDirArg}/package.json yet.`);
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["--prefix", targetDir, "run", scriptName];

if (forwardedArgs.length > 0) {
  args.push("--", ...forwardedArgs);
}

const result = spawnSync(npmCommand, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
