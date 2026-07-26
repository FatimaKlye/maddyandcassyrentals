import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Admin SDK entry point for server-only code (seed scripts, server actions,
 * route handlers). Never import this from a "use client" file — it depends
 * on Node.js-only APIs and will break the client bundle. It is intentionally
 * NOT guarded with the "server-only" package, because scripts/seedFirebase.ts
 * imports it directly via tsx (outside of Next's webpack build), where that
 * guard throws unconditionally.
 *
 * Credentials are never hardcoded. In order of precedence:
 *  - GOOGLE_APPLICATION_CREDENTIALS env var pointing at a service-account
 *    JSON file (recommended for local scripts against a real project).
 *  - Application Default Credentials (e.g. Cloud Run/Functions runtime).
 *  - The Firebase Emulator Suite, when FIRESTORE_EMULATOR_HOST /
 *    FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_STORAGE_EMULATOR_HOST are set —
 *    in that case no real credentials are required at all.
 */
export function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  const usingEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

  // Prefer an explicit service-account key when provided as raw JSON via env
  // (useful for hosting providers that don't support file paths), otherwise
  // fall back to GOOGLE_APPLICATION_CREDENTIALS / ADC, which is what
  // firebase-admin's cert()-less initializeApp() resolves automatically.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      projectId,
      storageBucket,
    });
  }

  if (usingEmulator) {
    return initializeApp({ projectId });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Missing Admin SDK credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account " +
        "JSON file path (never commit this file), or run against the Firebase Emulator Suite " +
        "with FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set."
    );
  }

  // initializeApp() with no `credential` resolves Application Default
  // Credentials, which includes GOOGLE_APPLICATION_CREDENTIALS.
  return initializeApp({ projectId, storageBucket });
}

/**
 * Keep Admin SDK initialization lazy. Next.js imports route modules while
 * collecting build metadata, when local service-account credentials may not
 * be available. Credentials are required only when a server operation
 * actually calls one of these accessors.
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
