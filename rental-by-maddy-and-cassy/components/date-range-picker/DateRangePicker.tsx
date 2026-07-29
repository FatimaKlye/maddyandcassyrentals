"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import ArrowLeftIcon from "@/components/icons/ArrowLeftIcon";
import { toDateKey } from "@/src/services/availabilityService";
import styles from "./DateRangePicker.module.css";

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: { startDate: Date | null; endDate: Date | null }) => void;
  disabledDateKeys: Set<string>;
  maxRentalDays?: number;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  disabledDateKeys,
  maxRentalDays = 30,
}: DateRangePickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(startDate ?? new Date()));
  const [error, setError] = useState<string | null>(null);
  const today = startOfDay(new Date());

  function isPast(day: Date): boolean {
    return isBefore(day, today);
  }

  function isBooked(day: Date): boolean {
    return disabledDateKeys.has(toDateKey(day));
  }

  function isDisabled(day: Date): boolean {
    return isPast(day) || isBooked(day);
  }

  function handleDayClick(day: Date) {
    if (isDisabled(day)) return;

    // Nothing selected yet: this click becomes the (single-day) selection.
    if (!startDate) {
      setError(null);
      onChange({ startDate: day, endDate: null });
      return;
    }

    const lastSelected = endDate ?? startDate;

    // Clicking the latest selected date removes it, keeping the run
    // consecutive from the start.
    if (isSameDay(day, lastSelected)) {
      setError(null);
      if (isSameDay(startDate, lastSelected)) {
        onChange({ startDate: null, endDate: null });
      } else {
        const newEnd = subDays(lastSelected, 1);
        onChange({
          startDate,
          endDate: isSameDay(newEnd, startDate) ? null : newEnd,
        });
      }
      return;
    }

    // Only the day immediately following the current selection can extend it.
    const nextAvailableDay = addDays(lastSelected, 1);
    if (isSameDay(day, nextAvailableDay) && !isDisabled(nextAvailableDay)) {
      const daySpan = differenceInCalendarDays(day, startDate) + 1;
      if (daySpan > maxRentalDays) {
        setError(`Maximum rental period is ${maxRentalDays} days.`);
        return;
      }
      setError(null);
      onChange({ startDate, endDate: day });
      return;
    }

    setError("Please select consecutive available dates");
  }

  const selectionEnd = endDate ?? startDate;
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
          aria-label="Previous month"
        >
          <ArrowLeftIcon size={14} />
        </button>
        <p className={styles.monthLabel}>{format(visibleMonth, "MMMM yyyy")}</p>
        <button
          type="button"
          className={`${styles.navButton} ${styles.navButtonNext}`}
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          aria-label="Next month"
        >
          <ArrowLeftIcon size={14} />
        </button>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className={styles.grid} role="grid">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} className={styles.blank} aria-hidden="true" />
        ))}
        {daysInMonth.map((day) => {
          const past = isPast(day);
          const booked = !past && isBooked(day);
          const disabled = past || booked;
          const selected =
            !!startDate && !!selectionEnd
              ? isWithinInterval(day, { start: startDate, end: selectionEnd })
              : false;

          let statusLabel = "";
          if (selected) statusLabel = ", selected";
          else if (past) statusLabel = ", past date";
          else if (booked) statusLabel = ", already booked";
          else statusLabel = ", available";

          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-current={selected ? "date" : undefined}
              aria-label={`${format(day, "MMMM d, yyyy")}${statusLabel}`}
              className={[
                styles.day,
                !isSameMonth(day, visibleMonth) ? styles.outsideMonth : "",
                !selected && past ? styles.dayPast : "",
                !selected && booked ? styles.dayBooked : "",
                !selected && !disabled ? styles.dayAvailable : "",
                selected ? styles.dayEdge : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleDayClick(day)}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}

      <p className={styles.legend}>
        <span className={styles.legendSwatch} data-variant="available" /> Available
        <span className={styles.legendSwatch} data-variant="booked" /> Booked
        <span className={styles.legendSwatch} data-variant="selected" /> Selected
        <span className={styles.legendSwatch} data-variant="disabled" /> Past
      </p>
    </div>
  );
}
