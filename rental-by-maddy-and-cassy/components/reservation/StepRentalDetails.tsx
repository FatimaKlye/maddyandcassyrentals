"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import type { FulfillmentMethod } from "@/src/types/booking";
import type { ReservationDraft } from "@/src/types/reservationDraft";
import { getDayCount } from "@/src/types/reservationDraft";
import {
  getFullyBookedDateKeys,
  isRangeAvailable,
  MAX_RENTAL_DAYS,
} from "@/src/services/availabilityService";
import DateRangePicker from "@/components/date-range-picker/DateRangePicker";
import AvailabilityBadge from "@/components/availability-badge/AvailabilityBadge";
import Spinner from "@/components/ui/Spinner";
import formStyles from "@/components/ui/Form.module.css";
import styles from "./StepRentalDetails.module.css";

interface StepRentalDetailsProps {
  product: Product;
  units: UnitCounts;
  draft: ReservationDraft;
  onUpdate: (patch: Partial<ReservationDraft>) => void;
  onContinue: () => void;
}

export default function StepRentalDetails({
  product,
  units,
  draft,
  onUpdate,
  onContinue,
}: StepRentalDetailsProps) {
  const [disabledDateKeys, setDisabledDateKeys] = useState<Set<string>>(new Set());
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingCalendar(true);
    getFullyBookedDateKeys(product.id, units.totalUnits).then((keys) => {
      if (!cancelled) {
        setDisabledDateKeys(keys);
        setLoadingCalendar(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, units.totalUnits]);

  const dayCount = getDayCount(draft.startDate, draft.endDate);
  const canContinue =
    !!draft.startDate &&
    !!draft.endDate &&
    !!draft.fulfillmentMethod &&
    draft.customerLocation.trim().length > 0;

  async function handleContinue() {
    setError(null);

    if (!draft.startDate || !draft.endDate) {
      setError("Please select a start and return date.");
      return;
    }
    if (draft.endDate < draft.startDate) {
      setError("Return date cannot be earlier than the start date.");
      return;
    }
    if (!draft.fulfillmentMethod) {
      setError("Please choose pickup or delivery.");
      return;
    }
    if (!draft.customerLocation.trim()) {
      setError("Please enter your location.");
      return;
    }

    setChecking(true);
    const stillAvailable = await isRangeAvailable(
      product.id,
      units.totalUnits,
      draft.startDate,
      draft.endDate
    );
    setChecking(false);

    if (!stillAvailable) {
      setError(
        "One or more of your selected dates were just booked by someone else. Please choose different dates."
      );
      const keys = await getFullyBookedDateKeys(product.id, units.totalUnits);
      setDisabledDateKeys(keys);
      onUpdate({ startDate: null, endDate: null });
      return;
    }

    onContinue();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.productSummary}>
        <div className={styles.productImage}>
          <Image src={product.image} alt={product.name} fill sizes="88px" />
        </div>
        <div>
          <p className={styles.productMeta}>
            {product.brand} · {product.category}
          </p>
          <h2 className={styles.productName}>{product.name}</h2>
          <p className={styles.productRate}>
            {product.currency}
            {product.pricePerDay.toLocaleString()}
            <span>/day</span>
          </p>
          <AvailabilityBadge
            totalUnits={units.totalUnits}
            availableUnits={units.availableUnits}
            variant="compact"
          />
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <h3 className={styles.sectionHeading}>Rental Dates</h3>
          {loadingCalendar ? (
            <div className={styles.calendarLoading}>
              <Spinner label="Loading availability" />
            </div>
          ) : (
            <DateRangePicker
              startDate={draft.startDate}
              endDate={draft.endDate}
              onChange={({ startDate, endDate }) => onUpdate({ startDate, endDate })}
              disabledDateKeys={disabledDateKeys}
              maxRentalDays={MAX_RENTAL_DAYS}
            />
          )}

          {dayCount > 0 ? (
            <p className={styles.dayCount}>
              {dayCount} {dayCount === 1 ? "day" : "days"} selected
            </p>
          ) : null}
        </div>

        <div className={styles.fulfillmentColumn}>
          <h3 className={styles.sectionHeading}>Location &amp; Fulfillment</h3>

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="customerLocation">
              Your location<span className={formStyles.required}>*</span>
            </label>
            <textarea
              id="customerLocation"
              className={formStyles.textarea}
              value={draft.customerLocation}
              onChange={(event) => onUpdate({ customerLocation: event.target.value })}
              placeholder="Barangay, city, and any landmark details"
            />
          </div>

          <fieldset className={styles.fulfillmentFieldset}>
            <legend className={formStyles.label}>
              Pickup or delivery<span className={formStyles.required}>*</span>
            </legend>

            <label className={styles.fulfillmentOption}>
              <input
                type="radio"
                name="fulfillmentMethod"
                checked={draft.fulfillmentMethod === "pickup"}
                onChange={() => onUpdate({ fulfillmentMethod: "pickup" as FulfillmentMethod })}
              />
              <span>
                <strong>Pickup</strong>
                <span className={styles.fulfillmentDetail}>
                  Right Focus Off Campus, Manuel Hizon, Sta. Cruz, Manila. Available by
                  appointment from 9:00 AM to 7:00 PM.
                </span>
              </span>
            </label>

            <label className={styles.fulfillmentOption}>
              <input
                type="radio"
                name="fulfillmentMethod"
                checked={draft.fulfillmentMethod === "delivery"}
                onChange={() => onUpdate({ fulfillmentMethod: "delivery" as FulfillmentMethod })}
              />
              <span>
                <strong>Delivery</strong>
                <span className={styles.fulfillmentDetail}>
                  Delivery is arranged manually by the business. Delivery fees and courier
                  arrangements are handled directly with you, outside this website.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      </div>

      {error ? (
        <p className={formStyles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.footer}>
        <button
          type="button"
          className={formStyles.primaryButton}
          disabled={!canContinue || checking}
          onClick={handleContinue}
        >
          {checking ? "Checking availability..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
