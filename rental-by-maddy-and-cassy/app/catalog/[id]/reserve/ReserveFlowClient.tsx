"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import { useAuth } from "@/hooks/useAuth";
import RequireAuth from "@/components/route-guards/RequireAuth";
import ReservationStepper from "@/components/reservation/ReservationStepper";
import StepRentalDetails from "@/components/reservation/StepRentalDetails";
import StepCustomerInfo from "@/components/reservation/StepCustomerInfo";
import StepRequirements from "@/components/reservation/StepRequirements";
import StepAgreement from "@/components/reservation/StepAgreement";
import StepReview from "@/components/reservation/StepReview";
import { useToast } from "@/components/ui/ToastProvider";
import { createEmptyDraft, getDayCount, type ReservationDraft } from "@/src/types/reservationDraft";
import { submitBooking } from "@/src/services/bookingSubmissionService";
import styles from "./reserve.module.css";

const STEP_LABELS = ["Rental Details", "Customer Info", "Requirements", "Agreement", "Review"];

interface ReserveFlowClientProps {
  product: Product;
  units: UnitCounts;
}

function ReserveFlowInner({ product, units }: ReserveFlowClientProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ReservationDraft>(createEmptyDraft());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !user) return;
    // Prefill is a one-time sync from the async auth/profile subscription
    // (AuthContext) into locally editable draft state, not a value derivable
    // during render, so an effect is the right tool here.
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

  function updateDraft(patch: Partial<ReservationDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function goToStep(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { bookingId } = await submitBooking(product, user.uid, draft);
      showToast("Booking request submitted successfully.", "success");
      router.push(`/account/bookings/${bookingId}?justSubmitted=1`);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof Error && error.name === "DatesUnavailableError") {
        setSubmitError(
          "One or more of your selected dates were just booked by someone else. Please go back and choose different dates."
        );
      } else {
        setSubmitError("We couldn't submit your booking request. Please try again.");
      }
    }
  }

  const agreementData = {
    bookingRef: "Generated at submission",
    customerName: draft.customerInfo.fullName || "—",
    productName: product.name,
    brand: product.brand,
    startDate: draft.startDate ?? new Date(),
    endDate: draft.endDate ?? new Date(),
    dayCount: getDayCount(draft.startDate, draft.endDate),
    fulfillmentMethod: draft.fulfillmentMethod ?? "pickup",
    customerLocation: draft.customerLocation || "—",
    pricePerDay: product.pricePerDay,
    currency: product.currency,
    includedAccessories: product.included,
  } as const;

  return (
    <div className={styles.wrapper}>
      <ReservationStepper steps={STEP_LABELS} currentStep={step} />

      <div className={styles.card}>
        {step === 1 ? (
          <StepRentalDetails
            product={product}
            units={units}
            draft={draft}
            onUpdate={updateDraft}
            onContinue={() => goToStep(2)}
          />
        ) : null}

        {step === 2 ? (
          <StepCustomerInfo
            uid={user!.uid}
            customerInfo={draft.customerInfo}
            onUpdate={(patch) => updateDraft({ customerInfo: { ...draft.customerInfo, ...patch } })}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        ) : null}

        {step === 3 ? (
          <StepRequirements
            requirements={draft.requirements}
            onUpdate={(patch) => updateDraft({ requirements: { ...draft.requirements, ...patch } })}
            onBack={() => goToStep(2)}
            onContinue={() => goToStep(4)}
          />
        ) : null}

        {step === 4 ? (
          <StepAgreement
            agreementData={agreementData}
            agreement={draft.agreement}
            onUpdate={(patch) => updateDraft({ agreement: { ...draft.agreement, ...patch } })}
            onBack={() => goToStep(3)}
            onContinue={() => goToStep(5)}
          />
        ) : null}

        {step === 5 ? (
          <StepReview
            product={product}
            draft={draft}
            onEditStep={goToStep}
            onBack={() => goToStep(4)}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
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
