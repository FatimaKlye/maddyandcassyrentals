"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getBookingDetails,
  getBookingFileUrl,
  type BookingDetails,
} from "@/src/services/bookingDetailService";
import {
  ADMIN_BOOKING_ACTIONS,
  downloadAdminBookingPdf,
  updateAdminBookingStatus,
} from "@/src/services/adminBookingService";
import { getUserProfile } from "@/src/services/userService";
import type { BookingStatus, UserProfile } from "@/src/types/firebase";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/status-badge/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./bookingDetail.module.css";
import RequirementsReviewPanel from "@/components/admin/RequirementsReviewPanel";

const REQUIREMENTS_STATUS_LABELS: Record<string, string> = {
  not_submitted: "Not Submitted",
  submitted: "Submitted",
  correction_required: "Correction Required",
  verified: "Verified",
};

const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_customer_signature: "Awaiting Customer Signature",
  submitted_for_review: "Submitted for Review",
  correction_required: "Correction Required",
  awaiting_admin_signature: "Awaiting Admin Signature",
  completed: "Completed",
};

function formatDate(value: { toDate?: () => Date } | null | undefined, includeTime = false) {
  const date = value?.toDate?.();
  if (!date) return "-";
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : {}),
  });
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yesNo(value: boolean | undefined) {
  return value ? "Confirmed" : "Not confirmed";
}

function safeExternalLink(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

interface DetailState {
  details: BookingDetails;
  profile: UserProfile | null;
}

export default function AdminBookingDetail({ bookingId }: { bookingId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [state, setState] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"" | BookingStatus>("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadDetails = useCallback(async () => {
    try {
      const details = await getBookingDetails(bookingId);
      if (!details) {
        setError("The selected booking could not be found.");
        return;
      }
      const profile = await getUserProfile(details.booking.userId);
      setState({ details, profile });
      setError(null);
    } catch {
      setError("The booking details could not be loaded. Please refresh and try again.");
    }
  }, [bookingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetails();
  }, [loadDetails]);

  const actions = useMemo(
    () => (state ? ADMIN_BOOKING_ACTIONS[state.details.booking.status] : []),
    [state],
  );

  const selectedAction = actions.find((action) => action.status === selectedStatus);

  async function openPrivateFile(path: string) {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.title = "Loading private document...";
      previewWindow.document.body.textContent = "Loading private document...";
    }

    try {
      const url = await getBookingFileUrl(path);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      previewWindow?.close();
      showToast("This private document could not be opened.", "error");
    }
  }

  async function handleStatusAction() {
    if (!user || !state || !selectedStatus || !selectedAction) return;
    if (selectedAction.requiresNote && !note.trim()) {
      showToast("Please add administrator notes for this action.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Apply "${selectedAction.label}" to booking ${state.details.booking.bookingRef}?`,
    );
    if (!confirmed) return;

    setUpdating(true);
    try {
      const idToken = await user.getIdToken();
      await updateAdminBookingStatus(bookingId, selectedStatus, note, idToken);
      await loadDetails();
      setSelectedStatus("");
      setNote("");
      showToast(`Booking updated: ${selectedAction.label}.`, "success");
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : "The booking status could not be updated.",
        "error",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handlePdfExport() {
    if (!user || !state) return;
    setExporting(true);
    try {
      const idToken = await user.getIdToken();
      await downloadAdminBookingPdf(
        bookingId,
        state.details.booking.bookingRef,
        idToken,
      );
      showToast("The private booking PDF was downloaded.", "success");
    } catch (exportError) {
      showToast(
        exportError instanceof Error
          ? exportError.message
          : "The booking PDF could not be generated.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Link href="/admin/bookings" className={styles.backLink}>Back to Bookings</Link>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={styles.loading}>
        <Spinner size={30} label="Loading booking details" />
      </div>
    );
  }

  const {
    booking,
    requirements,
    agreement,
    statusHistory,
    payments,
    invoices,
    receipts,
    documents: customerDocuments,
  } = state.details;
  const { profile } = state;
  const customer = booking.customerSnapshot;
  const fullName = customer?.fullName || profile?.displayName || "Customer";
  const email = customer?.email || profile?.email || "-";
  const phone = customer?.phone || profile?.phoneNumber || "-";
  const address = customer?.address || profile?.fullAddress || "-";
  const facebook = safeExternalLink(customer?.facebookLink || profile?.facebookLink);
  const instagram = safeExternalLink(customer?.instagramLink || profile?.instagramLink);
  const estimatedAmount = `${booking.productSnapshot.currency || "PHP"}${booking.estimatedRentalAmount.toLocaleString("en-PH")}`;

  const documentItems = requirements
    ? [
        { label: "First valid ID", path: requirements.idOneStoragePath },
        { label: "Second valid ID", path: requirements.idTwoStoragePath },
        { label: "Selfie holding valid ID", path: requirements.selfieWithIdStoragePath },
        { label: "Emergency contact ID", path: requirements.emergencyContact.idStoragePath },
      ].filter((item) => item.path)
    : [];

  return (
    <div className={styles.page}>
      <Link href="/admin/bookings" className={styles.backLink}>Back to Bookings</Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>BOOKING REVIEW</p>
          <h1>{booking.bookingRef}</h1>
          <p>{booking.productSnapshot.name} for {fullName}</p>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge status={booking.status} />
          <button
            type="button"
            className={styles.exportButton}
            onClick={handlePdfExport}
            disabled={exporting}
          >
            {exporting ? "Preparing PDF..." : "Export to PDF"}
          </button>
        </div>
      </header>

      <section className={styles.actionPanel} aria-labelledby="booking-action-heading">
        <div>
          <h2 id="booking-action-heading">Booking Action</h2>
          <p>Choose the next status. Every action is recorded and notifies the customer.</p>
        </div>
        {actions.length ? (
          <div className={styles.actionControls}>
            <label>
              <span>Action</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as "" | BookingStatus)}
                disabled={updating}
              >
                <option value="">Select an action</option>
                {actions.map((action) => (
                  <option key={action.status} value={action.status}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.noteField}>
              <span>
                Administrator notes
                {selectedAction?.requiresNote ? " (required)" : " (optional)"}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Add a clear note for the customer and status history."
                disabled={updating}
              />
            </label>
            <button
              type="button"
              className={`${styles.applyButton} ${
                selectedAction?.tone === "danger" ? styles.dangerButton : ""
              }`}
              onClick={handleStatusAction}
              disabled={!selectedStatus || updating}
            >
              {updating ? "Applying..." : "Apply Action"}
            </button>
          </div>
        ) : (
          <p className={styles.terminalNotice}>
            This booking is in a final status. No further actions are available.
          </p>
        )}
      </section>

      <div className={styles.statusGrid}>
        <article>
          <span>Booking Status</span>
          <strong>{formatStatus(booking.status)}</strong>
        </article>
        <article>
          <span>Requirements</span>
          <strong>{REQUIREMENTS_STATUS_LABELS[booking.requirementsStatus] ?? formatStatus(booking.requirementsStatus)}</strong>
        </article>
        <article>
          <span>Agreement</span>
          <strong>{AGREEMENT_STATUS_LABELS[booking.agreementStatus] ?? formatStatus(booking.agreementStatus)}</strong>
        </article>
        <article>
          <span>Submitted</span>
          <strong>{formatDate(booking.submittedAt, true)}</strong>
        </article>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>01</p>
            <h2>Customer Information</h2>
          </div>
          <Link href={`/admin/users/${booking.userId}`}>View Customer Account</Link>
        </div>
        <dl className={styles.detailGrid}>
          <div><dt>Full name</dt><dd>{fullName}</dd></div>
          <div><dt>Email address</dt><dd>{email}</dd></div>
          <div><dt>Phone number</dt><dd>{phone}</dd></div>
          <div className={styles.wideDetail}><dt>Complete address</dt><dd>{address}</dd></div>
          <div>
            <dt>Facebook profile</dt>
            <dd>{facebook ? <a href={facebook} target="_blank" rel="noopener noreferrer">Open Facebook</a> : "-"}</dd>
          </div>
          <div>
            <dt>Instagram profile</dt>
            <dd>{instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer">Open Instagram</a> : "-"}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p>02</p><h2>Rental Details</h2></div>
        </div>
        <dl className={styles.detailGrid}>
          <div><dt>Rental item</dt><dd>{booking.productSnapshot.name}</dd></div>
          <div><dt>Brand / Category</dt><dd>{booking.productSnapshot.brand} / {booking.productSnapshot.category}</dd></div>
          <div><dt>Start date</dt><dd>{formatDate(booking.startDate)}</dd></div>
          <div><dt>End date</dt><dd>{formatDate(booking.endDate)}</dd></div>
          <div><dt>Duration</dt><dd>{booking.dayCount} day(s)</dd></div>
          <div><dt>Estimated amount</dt><dd>{estimatedAmount}</dd></div>
          <div><dt>Handover method</dt><dd>{formatStatus(booking.fulfillmentMethod)}</dd></div>
          <div><dt>Assigned unit</dt><dd>{booking.assignedUnitId || "Not assigned"}</dd></div>
          <div className={styles.wideDetail}><dt>Customer location</dt><dd>{booking.customerLocation}</dd></div>
          <div className={styles.wideDetail}>
            <dt>Included accessories</dt>
            <dd>{booking.productSnapshot.included?.length ? booking.productSnapshot.included.join(", ") : "None listed"}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p>03</p><h2>Rental Requirements</h2></div>
        </div>
        {requirements ? (
          <>
            <dl className={styles.detailGrid}>
              <div>
                <dt>Customer Facebook</dt>
                <dd>
                  {safeExternalLink(requirements.facebookLink) ? (
                    <a href={requirements.facebookLink} target="_blank" rel="noopener noreferrer">Open Facebook</a>
                  ) : "-"}
                </dd>
              </div>
              <div>
                <dt>Customer Instagram</dt>
                <dd>
                  {safeExternalLink(requirements.instagramLink) ? (
                    <a href={requirements.instagramLink} target="_blank" rel="noopener noreferrer">Open Instagram</a>
                  ) : "-"}
                </dd>
              </div>
              <div><dt>Emergency contact</dt><dd>{requirements.emergencyContact.fullName}</dd></div>
              <div><dt>Relationship</dt><dd>{requirements.emergencyContact.relationship}</dd></div>
              <div><dt>Emergency phone</dt><dd>{requirements.emergencyContact.phone}</dd></div>
              <div>
                <dt>Emergency Facebook</dt>
                <dd>
                  {safeExternalLink(requirements.emergencyContact.facebookLink) ? (
                    <a href={requirements.emergencyContact.facebookLink} target="_blank" rel="noopener noreferrer">Open Facebook</a>
                  ) : "-"}
                </dd>
              </div>
            </dl>
            <div className={styles.documents}>
              {documentItems.map((document) => (
                <button
                  key={document.label}
                  type="button"
                  onClick={() => openPrivateFile(document.path)}
                >
                  <span>{document.label}</span>
                  <strong>View private file</strong>
                </button>
              ))}
            </div>
            <RequirementsReviewPanel
              bookingId={bookingId}
              requirements={requirements}
              onUpdated={loadDetails}
            />
          </>
        ) : (
          <p className={styles.empty}>Requirements have not been submitted for this booking.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p>04</p><h2>Rental Agreement</h2></div>
        </div>
        {agreement ? (
          <>
            <dl className={styles.detailGrid}>
              <div><dt>Signed name</dt><dd>{agreement.signature.typedFullName}</dd></div>
              <div><dt>Signed at</dt><dd>{formatDate(agreement.signature.signedAt, true)}</dd></div>
              <div><dt>Signature method</dt><dd>{formatStatus(agreement.signature.method)}</dd></div>
              <div><dt>Terms version</dt><dd>{agreement.generatedTermsVersion}</dd></div>
            </dl>
            <div className={styles.confirmationGrid}>
              <span>{yesNo(agreement.acknowledgements.infoAccurate)}: Information is accurate</span>
              <span>{yesNo(agreement.acknowledgements.agreedToTerms)}: Terms accepted</span>
              <span>{yesNo(agreement.acknowledgements.understoodRentalRules)}: Rental rules understood</span>
              <span>{yesNo(agreement.acknowledgements.authorizedESignature)}: E-signature authorized</span>
              <span>{yesNo(agreement.acknowledgements.readPrivacyNotice)}: Privacy notice read</span>
              <span>{yesNo(agreement.acknowledgements.emergencyContactAuthorized)}: Emergency contact authorized</span>
            </div>
            <button
              type="button"
              className={styles.signatureButton}
              onClick={() => openPrivateFile(agreement.signature.storagePath)}
            >
              View customer signature
            </button>
          </>
        ) : (
          <p className={styles.empty}>The rental agreement has not been submitted.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p>05</p><h2>Payment &amp; Customer Documents</h2></div>
        </div>
        <dl className={styles.detailGrid}>
          <div><dt>Payment status</dt><dd>{formatStatus(booking.paymentStatus ?? "unpaid")}</dd></div>
          <div><dt>Payment attempts</dt><dd>{payments.length}</dd></div>
          <div><dt>Invoices</dt><dd>{invoices.length}</dd></div>
          <div><dt>Receipts</dt><dd>{receipts.length}</dd></div>
        </dl>
        {customerDocuments.length ? (
          <div className={styles.documents}>
            {customerDocuments.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => openPrivateFile(document.storagePath)}
              >
                <span>{document.title}</span>
                <strong>View private PDF</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No customer-facing financial documents have been issued yet.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p>06</p><h2>Status History</h2></div>
        </div>
        {statusHistory.length ? (
          <ol className={styles.timeline}>
            {statusHistory.map((entry) => (
              <li key={entry.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>
                    {entry.previousStatus ? `${formatStatus(entry.previousStatus)} to ` : ""}
                    {formatStatus(entry.newStatus)}
                  </strong>
                  <p>{entry.message || "Status updated."}</p>
                  <small>{formatDate(entry.createdAt, true)} - {formatStatus(entry.changedBy)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No status history is available.</p>
        )}
      </section>
    </div>
  );
}
