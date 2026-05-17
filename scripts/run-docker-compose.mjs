import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const composeArgs = process.argv.slice(2);

if (composeArgs.length === 0) {
  console.error("Usage: node ./scripts/run-docker-compose.mjs <docker compose args...>");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";
const envFileNames = [".env.example", ".env", ".env.docker.example", ".env.docker"];

function parseEnvFile(source) {
  const parsed = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7) : line;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

const composedEnv = {};

for (const envFileName of envFileNames) {
  const envFilePath = path.join(rootDir, envFileName);

  try {
    const envFileSource = await readFile(envFilePath, "utf8");
    Object.assign(composedEnv, parseEnvFile(envFileSource));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      continue;
    }

    throw error;
  }
}

const result = spawnSync(dockerCommand, ["compose", ...composeArgs], {
  cwd: rootDir,
  env: {
    ...process.env,
    ...composedEnv,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
