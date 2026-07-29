"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import type { PaymentStatus } from "@/src/types/payment";
import { useAuth } from "@/hooks/useAuth";
import RequireAuth from "@/components/route-guards/RequireAuth";
import ReservationStepper from "@/components/reservation/ReservationStepper";
import StepRentalDetails from "@/components/reservation/StepRentalDetails";
import StepCustomerInfo from "@/components/reservation/StepCustomerInfo";
import StepRequirements from "@/components/reservation/StepRequirements";
import StepAgreement from "@/components/reservation/StepAgreement";
import StepPaymentSubmission from "@/components/reservation/StepPaymentSubmission";
import StepBookingConfirmation from "@/components/reservation/StepBookingConfirmation";
import { useToast } from "@/components/ui/ToastProvider";
import { createEmptyDraft, getDayCount, type ReservationDraft } from "@/src/types/reservationDraft";
import {
  createBookingReservation,
  submitBookingDocuments,
} from "@/src/services/bookingSubmissionService";
import { createPaymentCheckout } from "@/src/services/paymentService";
import { getBookingById } from "@/src/services/bookingService";
import styles from "./reserve.module.css";

const STEP_LABELS = [
  "Rental Details",
  "Reservation",
  "Payment Submission",
  "Verification Documents",
  "Rental Agreement",
  "Booking Confirmation",
];

interface ReserveFlowClientProps {
  product: Product;
  units: UnitCounts;
}

function ReserveFlowInner({ product, units }: ReserveFlowClientProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ReservationDraft>(createEmptyDraft());
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [isDemoPayment, setIsDemoPayment] = useState(false);
  const [openingPayment, setOpeningPayment] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submittingDocuments, setSubmittingDocuments] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !user) return;
    // One-time hydration of the locally editable booking form from async auth/profile data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((current) => ({
      ...current,
      customerInfo: {
        fullName: profile?.displayName ?? user.displayName ?? "",
        email: profile?.email ?? user.email ?? "",
        phone: profile?.phoneNumber ?? "",
        address: profile?.fullAddress ?? "",
        facebookLink: profile?.facebookLink ?? "",
        instagramLink: profile?.instagramLink ?? "",
      },
      requirements: {
        ...current.requirements,
        facebookLink: profile?.facebookLink ?? "",
        instagramLink: profile?.instagramLink ?? "",
      },
    }));
    setPrefilled(true);
  }, [user, profile, prefilled]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const resumedBookingId = params.get("bookingId");
    if (!resumedBookingId) return;
    const activeUser = user;
    const activeBookingId = resumedBookingId;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const returnedFromPayment = params.get("payment") === "success";
    const paymentCancelled = params.get("payment") === "cancelled";
    const demoPreviewCompleted = params.get("payment") === "demo-preview";
    let attempts = 0;

    async function refreshBooking() {
      const booking = await getBookingById(activeBookingId);
      if (
        !booking ||
        booking.userId !== activeUser.uid ||
        booking.productId !== product.id ||
        cancelled
      ) {
        setPaymentError("This reservation could not be resumed.");
        return;
      }

      setBookingId(booking.id);
      setBookingNumber(booking.bookingRef);
      setPaymentStatus(booking.paymentStatus ?? "unpaid");
      setIsDemoPayment(booking.demoPayment === true);
      setDraft((current) => ({
        ...current,
        startDate: booking.startDate.toDate(),
        endDate: booking.endDate.toDate(),
        fulfillmentMethod: booking.fulfillmentMethod,
        customerLocation: booking.customerLocation,
        paymentOption:
          booking.paymentChoice === "full" || booking.paymentChoice === "deposit_50"
            ? booking.paymentChoice
            : current.paymentOption,
        customerInfo: booking.customerSnapshot ?? current.customerInfo,
      }));
      setStep(3);

      const verified =
        booking.paymentStatus === "paid" || booking.paymentStatus === "partially_paid";
      if (verified) {
        setCheckingPayment(false);
        setPaymentError(null);
        return;
      }

      if (returnedFromPayment && attempts < 15) {
        attempts += 1;
        setCheckingPayment(true);
        timer = setTimeout(refreshBooking, 2000);
      } else {
        setCheckingPayment(false);
        if (returnedFromPayment) {
          setPaymentError(
            "PayMongo is still confirming the transaction. Please wait a moment, then refresh this page.",
          );
        } else if (paymentCancelled) {
          setPaymentError("Payment was cancelled. Your reservation can still be paid from here.");
        } else if (demoPreviewCompleted) {
          setPaymentError(
            "Demo preview completed. No payment was charged or recorded, so verification remains locked until PayMongo confirms a real payment.",
          );
        }
      }
    }

    void refreshBooking();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, product.id]);

  function updateDraft(patch: Partial<ReservationDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function goToStep(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePayment() {
    if (!user) return;
    setOpeningPayment(true);
    setPaymentError(null);

    try {
      let activeBookingId = bookingId;
      let activeBookingNumber = bookingNumber;
      if (!activeBookingId) {
        const reservation = await createBookingReservation(product, draft);
        activeBookingId = reservation.bookingId;
        activeBookingNumber = reservation.bookingNumber ?? reservation.bookingId;
        setBookingId(activeBookingId);
        setBookingNumber(activeBookingNumber);
      }

      const idToken = await user.getIdToken();
      const returnPath =
        `/catalog/${encodeURIComponent(product.id)}/reserve?bookingId=${encodeURIComponent(activeBookingId)}`;
      const checkout = await createPaymentCheckout(
        activeBookingId,
        idToken,
        draft.paymentOption,
        returnPath,
      );
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setOpeningPayment(false);
      setPaymentError(
        error instanceof Error
          ? error.message
          : "The secure PayMongo checkout could not be opened.",
      );
    }
  }

  async function handleDocumentSubmission() {
    if (!user || !bookingId || !bookingNumber) return;
    setSubmittingDocuments(true);
    try {
      await submitBookingDocuments(bookingId, draft);
      showToast("Verification documents and signed agreement submitted.", "success");
      goToStep(6);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "We couldn't submit your documents. Please try again.",
        "error",
      );
    } finally {
      setSubmittingDocuments(false);
    }
  }

  const agreementData = {
    bookingRef: bookingNumber ?? "Created before payment",
    customerName: draft.customerInfo.fullName || "-",
    productName: product.name,
    brand: product.brand,
    startDate: draft.startDate ?? new Date(),
    endDate: draft.endDate ?? new Date(),
    dayCount: getDayCount(draft.startDate, draft.endDate),
    fulfillmentMethod: draft.fulfillmentMethod ?? "pickup",
    customerLocation: draft.customerLocation || "-",
    pricePerDay: product.pricePerDay,
    currency: product.currency,
    includedAccessories: product.included,
  } as const;

  return (
    <div className={styles.wrapper}>
      <ReservationStepper steps={STEP_LABELS} currentStep={step} />

      <div className={styles.card}>
        {step === 1 ? (
          <StepCustomerInfo
            uid={user!.uid}
            customerInfo={draft.customerInfo}
            onUpdate={(patch) =>
              updateDraft({ customerInfo: { ...draft.customerInfo, ...patch } })
            }
            onContinue={() => goToStep(2)}
          />
        ) : null}

        {step === 2 ? (
          <StepRentalDetails
            product={product}
            units={units}
            draft={draft}
            onUpdate={updateDraft}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        ) : null}

        {step === 3 ? (
          <StepPaymentSubmission
            product={product}
            draft={draft}
            paymentStatus={paymentStatus}
            isDemoPayment={isDemoPayment}
            bookingNumber={bookingNumber ?? undefined}
            opening={openingPayment}
            checking={checkingPayment}
            error={paymentError}
            onPaymentOptionChange={(paymentOption) => updateDraft({ paymentOption })}
            onBack={() => goToStep(2)}
            onPay={() => void handlePayment()}
            onContinue={() => goToStep(4)}
          />
        ) : null}

        {step === 4 ? (
          <StepRequirements
            requirements={draft.requirements}
            onUpdate={(patch) =>
              updateDraft({ requirements: { ...draft.requirements, ...patch } })
            }
            onBack={() => goToStep(3)}
            onContinue={() => goToStep(5)}
          />
        ) : null}

        {step === 5 ? (
          <StepAgreement
            agreementData={agreementData}
            agreement={draft.agreement}
            onUpdate={(patch) => updateDraft({ agreement: { ...draft.agreement, ...patch } })}
            onBack={() => goToStep(4)}
            onContinue={() => void handleDocumentSubmission()}
            submitting={submittingDocuments}
          />
        ) : null}

        {step === 6 && bookingId && bookingNumber ? (
          <StepBookingConfirmation
            bookingId={bookingId}
            bookingNumber={bookingNumber}
            isDemo={isDemoPayment}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function ReserveFlowClient(props: ReserveFlowClientProps) {
  return (
    <RequireAuth>
      <ReserveFlowInner {...props} />
    </RequireAuth>
  );
}
