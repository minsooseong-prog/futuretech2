import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { cleanStorage } = await import("../lib/storage");
  const result = await cleanStorage(500);
  console.log(result);
  process.exit(result.pending ? 1 : 0);
}
main().catch(() => {
  console.error("Storage cleanup failed. Check configuration and retry.");
  process.exit(1);
});
