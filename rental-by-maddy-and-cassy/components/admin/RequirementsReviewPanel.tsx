"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/ToastProvider";
import type {
  RequirementDocumentKey,
  RequirementReviewStatus,
  RequirementsDoc,
} from "@/src/types/booking";
import styles from "./RequirementsReviewPanel.module.css";

const DOCUMENTS: Array<{ key: RequirementDocumentKey; label: string }> = [
  { key: "idOneStoragePath", label: "First valid ID" },
  { key: "idTwoStoragePath", label: "Second valid ID" },
  { key: "selfieWithIdStoragePath", label: "Selfie holding ID" },
  { key: "emergencyContactIdStoragePath", label: "Emergency contact ID" },
];

export default function RequirementsReviewPanel({
  bookingId,
  requirements,
  onUpdated,
}: {
  bookingId: string;
  requirements: RequirementsDoc;
  onUpdated(): Promise<void>;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeKey, setActiveKey] = useState<RequirementDocumentKey | null>(null);
  const [reason, setReason] = useState("");

  async function saveReview(documentKey: RequirementDocumentKey, status: RequirementReviewStatus) {
    if (!user) return;
    if (["rejected", "replacement_requested"].includes(status) && !reason.trim()) {
      showToast("Add a clear reason before requesting a replacement.", "error");
      return;
    }
    setActiveKey(documentKey);
    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/requirements`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documentKey, status, reason }),
        },
      );
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "The review could not be saved.");
      }
      setReason("");
      await onUpdated();
      showToast("Document review saved.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The review could not be saved.", "error");
    } finally {
      setActiveKey(null);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <strong>Individual document verification</strong>
        <span>Approve each file or request a replacement with a specific reason.</span>
      </div>
      <label className={styles.note}>
        <span>Reason for rejection or replacement</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain exactly what needs to be corrected."
        />
      </label>
      <div className={styles.list}>
        {DOCUMENTS.map((document) => {
          const currentReview = requirements.reviews?.[document.key];
          return (
            <div key={document.key} className={styles.row}>
              <div>
                <strong>{document.label}</strong>
                <span className={`${styles.reviewStatus} ${currentReview ? styles[currentReview.status] : ""}`}>
                  {currentReview?.status?.replaceAll("_", " ") ?? "pending review"}
                </span>
                {currentReview?.reason ? <small>{currentReview.reason}</small> : null}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => saveReview(document.key, "approved")}
                  disabled={activeKey !== null}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={styles.replace}
                  onClick={() => saveReview(document.key, "rejected")}
                  disabled={activeKey !== null}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className={styles.replace}
                  onClick={() => saveReview(document.key, "replacement_requested")}
                  disabled={activeKey !== null}
                >
                  {activeKey === document.key ? "Saving..." : "Request replacement"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
