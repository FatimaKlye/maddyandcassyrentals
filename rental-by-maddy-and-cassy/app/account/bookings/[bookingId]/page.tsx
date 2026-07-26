"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getBookingDetails,
  resubmitBookingCorrections,
  type BookingDetails,
} from "@/src/services/bookingDetailService";
import BookingSummaryCard from "@/components/booking-summary/BookingSummaryCard";
import StatusBadge from "@/components/status-badge/StatusBadge";
import FileUploadField from "@/components/file-upload/FileUploadField";
import NotificationList from "@/components/notification-list/NotificationList";
import Spinner from "@/components/ui/Spinner";
import formStyles from "@/components/ui/Form.module.css";
import styles from "./bookingDetail.module.css";

const REQUIREMENTS_STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not Submitted",
  submitted: "Submitted",
  correction_required: "Correction Required",
  verified: "Verified",
};

const AGREEMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_customer_signature: "Awaiting Your Signature",
  submitted_for_review: "Submitted for Review",
  correction_required: "Correction Required",
  awaiting_admin_signature: "Awaiting Business Signature",
  completed: "Completed",
};

export default function BookingDetailPage() {
  return (
    <Suspense fallback={null}>
      <BookingDetailContent />
    </Suspense>
  );
}

function BookingDetailContent() {
  const { user } = useAuth();
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("justSubmitted") === "1";

  const [details, setDetails] = useState<BookingDetails | null | "error">(null);
  const [replacementFiles, setReplacementFiles] = useState<{
    idOneStoragePath?: File;
    idTwoStoragePath?: File;
    selfieWithIdStoragePath?: File;
  }>({});
  const [resubmitting, setResubmitting] = useState(false);

  async function loadDetails() {
    try {
      const result = await getBookingDetails(params.bookingId);
      setDetails(result ?? "error");
    } catch {
      setDetails("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bookingId]);

  if (!user || details === null) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading booking" />
      </div>
    );
  }

  if (details === "error" || details.booking.userId !== user.uid) {
    return <p className={formStyles.errorText}>We couldn&apos;t find that booking.</p>;
  }

  const { booking, requirements, agreement, documents } = details;
  const uid = user.uid;

  async function handleResubmit() {
    setResubmitting(true);
    try {
      await resubmitBookingCorrections(uid, booking.id, replacementFiles);
      await loadDetails();
      setReplacementFiles({});
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {justSubmitted ? (
        <div className={styles.confirmationBanner}>
          <h2>Your booking request has been submitted successfully.</h2>
          <p>
            The business will review your rental details, requirements, and signed agreement.
            You will receive a notification when your booking status is updated or when
            additional information is required.
          </p>
          <p className={styles.paymentNote}>
            Payment arrangements, when applicable, are handled directly by the business outside
            the website.
          </p>
        </div>
      ) : null}

      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Booking {booking.bookingRef}</h1>
        <StatusBadge status={booking.status} />
      </div>

      <BookingSummaryCard
        productName={booking.productSnapshot.name}
        brand={booking.productSnapshot.brand}
        productImage={booking.productSnapshot.image}
        pricePerDay={booking.productSnapshot.pricePerDay}
        currency={booking.productSnapshot.currency}
        startDate={booking.startDate.toDate()}
        endDate={booking.endDate.toDate()}
        dayCount={booking.dayCount}
        fulfillmentMethod={booking.fulfillmentMethod}
        customerLocation={booking.customerLocation}
      />

      <section className={styles.section}>
        <h3>Status Overview</h3>
        <dl className={styles.detailGrid}>
          <div>
            <dt>Date Submitted</dt>
            <dd>{booking.submittedAt?.toDate().toLocaleDateString() ?? "—"}</dd>
          </div>
          <div>
            <dt>Requirements Status</dt>
            <dd>{REQUIREMENTS_STATUS_LABEL[booking.requirementsStatus]}</dd>
          </div>
          <div>
            <dt>Agreement Status</dt>
            <dd>{AGREEMENT_STATUS_LABEL[booking.agreementStatus]}</dd>
          </div>
        </dl>
      </section>

      {booking.status === "correction_required" ? (
        <section className={styles.correctionSection}>
          <h3>Correction Required</h3>
          <p className={styles.remarks}>
            {booking.adminRemarks ?? "The business has requested updates to your booking. Please check your submitted information and documents."}
          </p>

          {requirements?.status === "correction_required" ? (
            <div className={styles.correctionUploads}>
              <FileUploadField
                label="Replace first valid ID (optional)"
                value={replacementFiles.idOneStoragePath ?? null}
                onChange={(file) =>
                  setReplacementFiles((current) => ({ ...current, idOneStoragePath: file ?? undefined }))
                }
              />
              <FileUploadField
                label="Replace second valid ID (optional)"
                value={replacementFiles.idTwoStoragePath ?? null}
                onChange={(file) =>
                  setReplacementFiles((current) => ({ ...current, idTwoStoragePath: file ?? undefined }))
                }
              />
              <FileUploadField
                label="Replace selfie with ID (optional)"
                value={replacementFiles.selfieWithIdStoragePath ?? null}
                onChange={(file) =>
                  setReplacementFiles((current) => ({ ...current, selfieWithIdStoragePath: file ?? undefined }))
                }
              />
            </div>
          ) : null}

          <button
            type="button"
            className={formStyles.primaryButton}
            disabled={resubmitting}
            onClick={handleResubmit}
          >
            {resubmitting ? "Resubmitting..." : "Resubmit for Review"}
          </button>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3>Documents</h3>
        {documents.length === 0 ? (
          <p className={styles.emptyDocs}>
            Documents will appear here once your booking is approved.
          </p>
        ) : (
          <ul className={styles.documentList}>
            {documents.map((document) => (
              <li key={document.id}>{document.title}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3>Notifications</h3>
        <NotificationList uid={user.uid} />
      </section>

      {agreement ? (
        <p className={styles.footnote}>
          Signed by {agreement.signature.typedFullName} on{" "}
          {agreement.signature.signedAt?.toDate().toLocaleString() ?? "—"}
        </p>
      ) : null}
    </div>
  );
}
