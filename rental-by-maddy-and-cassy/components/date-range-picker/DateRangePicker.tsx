"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
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
  const today = startOfDay(new Date());

  function isDisabled(day: Date): boolean {
    if (isBefore(day, today)) return true;
    return disabledDateKeys.has(toDateKey(day));
  }

  function handleDayClick(day: Date) {
    if (isDisabled(day)) return;

    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: day, endDate: null });
      return;
    }

    if (isBefore(day, startDate)) {
      onChange({ startDate: day, endDate: null });
      return;
    }

    const daySpan =
      Math.round((day.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (daySpan > maxRentalDays) {
      onChange({ startDate: day, endDate: null });
      return;
    }

    // If any day in the prospective range is disabled, restart the selection
    // from this day instead of allowing a range that spans a booked date.
    const spanDays = eachDayOfInterval({ start: startDate, end: day });
    const hasDisabledDayInRange = spanDays.some(isDisabled);
    if (hasDisabledDayInRange) {
      onChange({ startDate: day, endDate: null });
      return;
    }

    onChange({ startDate, endDate: day });
  }

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
          const disabled = isDisabled(day);
          const isStart = startDate ? isSameDay(day, startDate) : false;
          const isEnd = endDate ? isSameDay(day, endDate) : false;
          const inRange =
            startDate && endDate ? isWithinInterval(day, { start: startDate, end: endDate }) : false;

          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-current={isStart || isEnd ? "date" : undefined}
              aria-label={`${format(day, "MMMM d, yyyy")}${disabled ? ", unavailable" : ""}`}
              className={[
                styles.day,
                !isSameMonth(day, visibleMonth) ? styles.outsideMonth : "",
                disabled ? styles.dayDisabled : "",
                isStart || isEnd ? styles.dayEdge : "",
                inRange && !isStart && !isEnd ? styles.dayInRange : "",
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

      <p className={styles.legend}>
        <span className={styles.legendSwatch} data-variant="disabled" /> Unavailable
        <span className={styles.legendSwatch} data-variant="selected" /> Selected
      </p>
    </div>
  );
}
