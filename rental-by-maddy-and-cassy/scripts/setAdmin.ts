/**
 * Grant (or refresh) admin access for an existing Firebase Authentication
 * user — Admin SDK, server-only.
 *
 * Verifies the UID exists in Firebase Authentication, then creates or
 * updates admins/{uid} in Firestore with:
 *   { active: true, email, displayName, createdAt, updatedAt }
 * createdAt is only set the first time the doc is created; every run
 * (including re-runs) refreshes updatedAt. This script never touches
 * Firestore/Storage rules, bookings, payments, or refunds.
 *
 * Credentials come from the Admin SDK's normal resolution order (see
 * src/lib/firebase/admin.ts) — GOOGLE_APPLICATION_CREDENTIALS, ADC, or the
 * emulator. Nothing here prints or logs credential material.
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\maddy-cassy-service-account.json"
 *   npm run firebase:set-admin -- --uid <uid> --email <email> --name "<display name>"
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

interface CliArgs {
  uid: string;
  email: string;
  name: string;
}

function parseArgs(argv: string[]): CliArgs {
  const values: Partial<Record<"uid" | "email" | "name", string>> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const match = /^--(uid|email|name)$/.exec(arg);
    if (!match) continue;

    const key = match[1] as "uid" | "email" | "name";
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    values[key] = value;
    i++;
  }

  const missing = (["uid", "email", "name"] as const).filter((key) => !values[key]);
  if (missing.length) {
    throw new Error(
      `Missing required argument(s): ${missing.map((k) => `--${k}`).join(", ")}\n` +
        `Usage: tsx scripts/setAdmin.ts --uid <uid> --email <email> --name "<display name>"`
    );
  }

  return values as CliArgs;
}

async function main() {
  loadEnvLocal();
  const { uid, email, name } = parseArgs(process.argv.slice(2));

  const { adminAuth, adminDb } = await import("@/src/lib/firebase/admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  // Verify the UID exists in Firebase Authentication before writing anything.
  let userRecord;
  try {
    userRecord = await adminAuth.getUser(uid);
  } catch {
    throw new Error(`No Firebase Authentication user found for uid "${uid}".`);
  }

  const adminRef = adminDb.collection("admins").doc(uid);
  const existing = await adminRef.get();

  await adminRef.set(
    {
      active: true,
      email,
      displayName: name,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(
    `Success: admins/${uid} is now active for ${userRecord.email ?? email} (${name}).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
