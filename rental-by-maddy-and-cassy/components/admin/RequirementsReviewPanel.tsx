"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { BookingDocument, RequirementReviewStatus } from "@/src/types/booking";
import styles from "./RequirementsReviewPanel.module.css";

function formatDocumentType(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RequirementsReviewPanel({
  bookingId,
  documents,
  onUpdated,
}: {
  bookingId: string;
  documents: BookingDocument[];
  onUpdated(): Promise<void>;
}) {
  const { showToast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function saveReview(documentId: string, status: Exclude<RequirementReviewStatus, "pending">) {
    if (status === "rejected" && !reason.trim()) {
      showToast("Add a clear reason before rejecting a document.", "error");
      return;
    }
    setActiveId(documentId);
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/requirements`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, status, reason }),
      });
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
      setActiveId(null);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <strong>Individual document verification</strong>
        <span>Approve each file or reject it with a specific reason.</span>
      </div>
      <label className={styles.note}>
        <span>Reason for rejection</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain exactly what needs to be corrected."
        />
      </label>
      <div className={styles.list}>
        {documents.map((document) => (
          <div key={document.id} className={styles.row}>
            <div>
              <strong>{formatDocumentType(document.documentType)}</strong>
              <span className={`${styles.reviewStatus} ${styles[document.reviewStatus]}`}>
                {document.reviewStatus.replaceAll("_", " ")}
              </span>
              {document.reviewNotes ? <small>{document.reviewNotes}</small> : null}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => saveReview(document.id, "approved")}
                disabled={activeId !== null}
              >
                {activeId === document.id ? "Saving..." : "Approve"}
              </button>
              <button
                type="button"
                className={styles.replace}
                onClick={() => saveReview(document.id, "rejected")}
                disabled={activeId !== null}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
