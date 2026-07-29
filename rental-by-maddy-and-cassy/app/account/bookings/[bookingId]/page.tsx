"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import BookingPaymentPanel from "@/components/payment/BookingPaymentPanel";
import { getBookingFileUrl } from "@/src/services/bookingDetailService";
import { useToast } from "@/components/ui/ToastProvider";

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
    emergencyContactIdStoragePath?: File;
  }>({});
  const [resubmitting, setResubmitting] = useState(false);
  const { showToast } = useToast();

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

  const { booking, requirements, agreement, documents, payments } = details;
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
          <h2>Your reservation is secured and submitted successfully.</h2>
          <p>
            {booking.demoPayment
              ? "This booking completed the development payment flow. No real money was processed. The business can now test document review and confirmation."
              : "PayMongo has verified your reservation payment. The business will now review your verification documents and signed agreement, then mark the booking Confirmed."}
          </p>
          <p className={styles.paymentNote}>
            Your invoice, official receipt, verified proof of payment, and signed rental agreement
            are available under Documents. If you selected the 50% option, you can pay the
            remaining balance from this page.
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

      {booking.requirementsStatus === "not_submitted" ? (
        <section className={styles.section}>
          <h3>Finish this booking</h3>
          <p>
            Continue the guided flow to complete payment, verification documents, and the signed
            rental agreement.
          </p>
          <Link
            href={`/catalog/${booking.productId}/reserve?bookingId=${booking.id}`}
            className={formStyles.primaryButton}
          >
            Continue Booking
          </Link>
        </section>
      ) : null}

      <BookingPaymentPanel booking={booking} payments={payments} />

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
                label="Replace emergency contact ID (optional)"
                value={replacementFiles.emergencyContactIdStoragePath ?? null}
                onChange={(file) =>
                  setReplacementFiles((current) => ({ ...current, emergencyContactIdStoragePath: file ?? undefined }))
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
              <li key={document.id}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      window.open(await getBookingFileUrl(document.storagePath), "_blank", "noopener,noreferrer");
                    } catch {
                      showToast("This document could not be opened.", "error");
                    }
                  }}
                >
                  {document.title}
                </button>
              </li>
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
