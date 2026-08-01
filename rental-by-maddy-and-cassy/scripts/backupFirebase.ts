import { spawn } from "node:child_process";

const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const bucket = process.env.FIREBASE_BACKUP_BUCKET;

if (!projectId || !bucket?.startsWith("gs://")) {
  console.error(
    "Set FIREBASE_PROJECT_ID and FIREBASE_BACKUP_BUCKET (gs://...) before running a backup.",
  );
  process.exit(1);
}

const date = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const destination = `${bucket.replace(/\/$/, "")}/firestore/${date}`;
const child = spawn(
  "gcloud",
  ["firestore", "export", destination, "--project", projectId, "--async"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
child.on("exit", (code) => process.exit(code ?? 1));
