import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Set server-only Supabase environment variables");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "future-tech-private";
  const config = {
    public: false,
    fileSizeLimit: 3000000,
    allowedMimeTypes: ["image/webp"],
  };
  const { data: existing, error: readError } =
    await client.storage.getBucket(bucket);
  if (
    readError &&
    String(readError.status) !== "404" &&
    String(readError.message).toLowerCase().indexOf("not found") < 0
  )
    throw readError;
  const { error } = existing
    ? await client.storage.updateBucket(bucket, config)
    : await client.storage.createBucket(bucket, config);
  if (error) throw error;
  console.log(
    "Private Storage bucket ready. No public access policies are needed.",
  );
}
main().catch((error) => {
  console.error("Storage setup failed:", error.message);
  process.exitCode = 1;
});
