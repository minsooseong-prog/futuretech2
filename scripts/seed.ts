import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { hash } from "bcryptjs";
import { users, profiles, preferences, siteSettings } from "../lib/db/schema";
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL");
  const secrets = [
    process.env.INITIAL_ADMIN_PASSWORD,
    process.env.INITIAL_NOTICE_PASSWORD,
    process.env.INITIAL_CALENDAR_PASSWORD,
  ];
  if (secrets.some((p) => !p || Buffer.byteLength(p) > 72))
    throw new Error(
      "Set all three INITIAL_*_PASSWORD variables (1–72 UTF-8 bytes)",
    );
  const [admin, notice, calendar] = await Promise.all(
    secrets.map((p) => hash(p!, 12)),
  );
  const pool = new Pool({ connectionString: url, max: 1 }),
    db = drizzle(pool);
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          studentId: "00000",
          name: "N",
          passwordHash: admin,
          role: "admin",
          mustChangePassword: true,
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        await tx
          .insert(profiles)
          .values({
            userId: created.id,
            bio: "함께 배우고, 함께 만드는 미래.",
          });
        await tx.insert(preferences).values({ userId: created.id });
      }
      await tx
        .insert(siteSettings)
        .values({
          id: 1,
          noticePasswordHash: notice,
          calendarPasswordHash: calendar,
        })
        .onConflictDoNothing();
    });
    console.log(
      "Seed complete. Existing accounts and passwords were preserved.",
    );
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
});
