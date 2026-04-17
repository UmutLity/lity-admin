import { spawnSync } from "node:child_process";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);

if (process.env.DIRECT_URL) {
  console.log("Using DIRECT_URL for prisma migrate deploy.");
  run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: process.env.DIRECT_URL });
} else {
  console.warn("DIRECT_URL is not set. Falling back to DATABASE_URL for prisma migrate deploy.");
  run("npx", ["prisma", "migrate", "deploy"]);
}

run("npx", ["next", "build"]);
