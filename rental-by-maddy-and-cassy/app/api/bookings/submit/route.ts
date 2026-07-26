import { NextResponse } from "next/server";
import {
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../../../../src/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FulfillmentMethod = "pickup" | "delivery";

type SubmitBookingBody = {
  productId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  dayCount?: unknown;
  fulfillmentMethod?: unknown;
  customerLocation?: unknown;
};

type BookingResult = {
  bookingId: string;
  bookingNumber: string;
};

class BookingApiError extends Error {
  constructor(
    public readonly code:
      | "unauthenticated"
      | "invalid-request"
      | "invalid-dates"
      | "product-not-found"
      | "fully-booked"
      | "booking-conflict"
      | "permission-denied"
      | "internal-error",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BookingApiError";
  }
}

function getRequiredString(
  value: unknown,
  fieldName: string,
  maximumLength = 500,
): string {
  if (typeof value !== "string") {
    throw new BookingApiError(
      "invalid-request",
      `${fieldName} is required.`,
      400,
    );
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > maximumLength) {
    throw new BookingApiError(
      "invalid-request",
      `${fieldName} is invalid.`,
      400,
    );
  }

  return normalized;
}

function getManilaDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new BookingApiError(
      "internal-error",
      "Could not process the requested dates.",
      500,
    );
  }

  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new BookingApiError(
      "invalid-dates",
      "Please provide valid rental dates.",
      400,
    );
  }

  const parsedDate = new Date(`${value}T00:00:00+08:00`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    getManilaDateKey(parsedDate) !== value
  ) {
    throw new BookingApiError(
      "invalid-dates",
      "Please provide valid rental dates.",
      400,
    );
  }

  return value;
}

function manilaDateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function enumerateDateKeys(
  startDateKey: string,
  endDateKey: string,
): string[] {
  const start = manilaDateKeyToDate(startDateKey);
  const end = manilaDateKeyToDate(endDateKey);

  const dateKeys: string[] = [];
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    dateKeys.push(getManilaDateKey(current));

    current.setTime(
      current.getTime() + 24 * 60 * 60 * 1000,
    );

    if (dateKeys.length > 365) {
      throw new BookingApiError(
        "invalid-dates",
        "The requested rental period is too long.",
        400,
      );
    }
  }

  return dateKeys;
}

function validateProductId(value: unknown): string {
  const productId = getRequiredString(value, "Product", 150);

  if (!/^[a-zA-Z0-9_-]+$/.test(productId)) {
    throw new BookingApiError(
      "invalid-request",
      "The selected product is invalid.",
      400,
    );
  }

  return productId;
}

function validateFulfillmentMethod(
  value: unknown,
): FulfillmentMethod {
  if (value !== "pickup" && value !== "delivery") {
    throw new BookingApiError(
      "invalid-request",
      "Please select pickup or delivery.",
      400,
    );
  }

  return value;
}

function validateDayCount(
  value: unknown,
  calculatedDayCount: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 365 ||
    value !== calculatedDayCount
  ) {
    throw new BookingApiError(
      "invalid-dates",
      "The rental duration does not match the selected dates.",
      400,
    );
  }

  return value;
}

function generateBookingNumber(
  bookingId: string,
  startDateKey: string,
): string {
  const datePart = startDateKey.replaceAll("-", "");
  const idPart = bookingId.slice(0, 6).toUpperCase();

  return `MC-${datePart}-${idPart}`;
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new BookingApiError(
      "unauthenticated",
      "Please sign in before submitting a booking request.",
      401,
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new BookingApiError(
      "unauthenticated",
      "Your login session is invalid.",
      401,
    );
  }

  return token;
}

function getErrorCode(error: unknown): string | number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string" || typeof code === "number") {
      return code;
    }
  }

  return undefined;
}

function getSafeUnexpectedError(
  error: unknown,
): BookingApiError {
  const code = getErrorCode(error);

  if (
    code === "auth/id-token-expired" ||
    code === "auth/argument-error" ||
    code === "auth/invalid-id-token"
  ) {
    return new BookingApiError(
      "unauthenticated",
      "Your login session has expired. Please sign in again.",
      401,
    );
  }

  if (
    code === "permission-denied" ||
    code === 7
  ) {
    return new BookingApiError(
      "permission-denied",
      "You do not have permission to submit this request.",
      403,
    );
  }

  if (
    code === "aborted" ||
    code === "already-exists" ||
    code === 6 ||
    code === 10
  ) {
    return new BookingApiError(
      "booking-conflict",
      "The selected dates were reserved by another customer. Please choose different dates.",
      409,
    );
  }

  return new BookingApiError(
    "internal-error",
    "We could not submit your booking request. Please try again.",
    500,
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const token = getBearerToken(request);

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      throw getSafeUnexpectedError(error);
    }

    const uid = decodedToken.uid;

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      throw new BookingApiError(
        "invalid-request",
        "The booking request could not be read.",
        400,
      );
    }

    if (
      typeof rawBody !== "object" ||
      rawBody === null ||
      Array.isArray(rawBody)
    ) {
      throw new BookingApiError(
        "invalid-request",
        "The booking request is invalid.",
        400,
      );
    }

    const body = rawBody as SubmitBookingBody;

    const productId = validateProductId(body.productId);
    const startDateKey = normalizeDateKey(body.startDate);
    const endDateKey = normalizeDateKey(body.endDate);

    const todayInManila = getManilaDateKey(new Date());

    if (startDateKey < todayInManila) {
      throw new BookingApiError(
        "invalid-dates",
        "Past rental dates cannot be selected.",
        400,
      );
    }

    if (endDateKey < startDateKey) {
      throw new BookingApiError(
        "invalid-dates",
        "The return date cannot be earlier than the start date.",
        400,
      );
    }

    const dateKeys = enumerateDateKeys(
      startDateKey,
      endDateKey,
    );

    const dayCount = validateDayCount(
      body.dayCount,
      dateKeys.length,
    );

    const fulfillmentMethod = validateFulfillmentMethod(
      body.fulfillmentMethod,
    );

    const customerLocation = getRequiredString(
      body.customerLocation,
      "Customer location",
      500,
    );

    const result = await adminDb.runTransaction<BookingResult>(
      async (transaction) => {
        const userRef = adminDb.collection("users").doc(uid);
        const productRef = adminDb
          .collection("products")
          .doc(productId);

        /*
         * All transaction reads happen before any writes.
         */
        const [userSnapshot, productDocSnapshot] =
          await Promise.all([
            transaction.get(userRef),
            transaction.get(productRef),
          ]);

        if (!userSnapshot.exists) {
          throw new BookingApiError(
            "permission-denied",
            "Your customer profile could not be verified.",
            403,
          );
        }

        const userData = userSnapshot.data();

        if (
          userData?.role !== "customer" ||
          userData?.accountStatus !== "active"
        ) {
          throw new BookingApiError(
            "permission-denied",
            "Your customer account is not active.",
            403,
          );
        }

        if (!productDocSnapshot.exists) {
          throw new BookingApiError(
            "product-not-found",
            "The selected rental item could not be found.",
            404,
          );
        }

        const productData = productDocSnapshot.data();

        if (productData?.isActive !== true) {
          throw new BookingApiError(
            "product-not-found",
            "The selected rental item is currently unavailable.",
            404,
          );
        }

        const pricePerDay = productData.pricePerDay;

        if (
          typeof pricePerDay !== "number" ||
          !Number.isFinite(pricePerDay) ||
          pricePerDay < 0
        ) {
          throw new BookingApiError(
            "internal-error",
            "The rental price is not configured correctly.",
            500,
          );
        }

        const unitsQuery = adminDb
          .collection("inventoryUnits")
          .where("productId", "==", productId);

        const unitsSnapshot = await transaction.get(unitsQuery);

        const activeUnits = unitsSnapshot.docs.filter(
          (unitSnapshot) => {
            const unitData = unitSnapshot.data();

            return (
              unitData.isActive === true &&
              unitData.status !== "inactive" &&
              unitData.status !== "maintenance"
            );
          },
        );

        if (activeUnits.length === 0) {
          throw new BookingApiError(
            "fully-booked",
            "No active unit is available for this rental item.",
            409,
          );
        }

        let selectedUnit:
          | QueryDocumentSnapshot
          | null = null;

        /*
         * Check every requested calendar document for each
         * candidate physical unit.
         */
        for (const unitSnapshot of activeUnits) {
          const calendarReferences = dateKeys.map((dateKey) =>
            unitSnapshot.ref
              .collection("calendar")
              .doc(dateKey),
          );

          const calendarSnapshots =
            await transaction.getAll(...calendarReferences);

          const hasConflict = calendarSnapshots.some(
            (calendarSnapshot) => calendarSnapshot.exists,
          );

          if (!hasConflict) {
            selectedUnit = unitSnapshot;
            break;
          }
        }

        if (!selectedUnit) {
          throw new BookingApiError(
            "fully-booked",
            "All units are already reserved for the selected dates.",
            409,
          );
        }

        /*
         * No more reads are performed after this point.
         */
        const bookingRef = adminDb
          .collection("bookings")
          .doc();

        const historyRef = bookingRef
          .collection("statusHistory")
          .doc();

        const notificationRef = userRef
          .collection("notifications")
          .doc();

        const bookingNumber = generateBookingNumber(
          bookingRef.id,
          startDateKey,
        );

        const now = Timestamp.now();

        const startTimestamp = Timestamp.fromDate(
          manilaDateKeyToDate(startDateKey),
        );

        const endTimestamp = Timestamp.fromDate(
          manilaDateKeyToDate(endDateKey),
        );

        const productName =
          typeof productData.name === "string"
            ? productData.name
            : "rental item";

        const currency =
          typeof productData.currency === "string"
            ? productData.currency
            : "₱";

        const productSnapshot = {
          name: productName,
          brand:
            typeof productData.brand === "string"
              ? productData.brand
              : "",
          category:
            typeof productData.category === "string"
              ? productData.category
              : "",
          image:
            typeof productData.image === "string"
              ? productData.image
              : "",
          pricePerDay,
          currency,
          included: Array.isArray(productData.included)
            ? productData.included
            : [],
        };

        transaction.create(bookingRef, {
          id: bookingRef.id,
          bookingRef: bookingNumber,

          userId: uid,
          productId,
          productSnapshot,
          assignedUnitId: selectedUnit.id,

          startDate: startTimestamp,
          endDate: endTimestamp,
          startDateKey,
          endDateKey,
          dayCount,

          fulfillmentMethod,
          customerLocation,

          pricePerDaySnapshot: pricePerDay,
          estimatedRentalAmount: pricePerDay * dayCount,

          status: "submitted",
          requirementsStatus: "not_submitted",
          agreementStatus: "awaiting_customer_signature",

          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        for (const dateKey of dateKeys) {
          const calendarRef = selectedUnit.ref
            .collection("calendar")
            .doc(dateKey);

          transaction.create(calendarRef, {
            unitId: selectedUnit.id,
            productId,
            bookingId: bookingRef.id,
            dateKey,

            status: "pending",

            startAt: startTimestamp,
            endAt: endTimestamp,

            createdAt: now,
            updatedAt: now,
          });
        }

        transaction.create(historyRef, {
          previousStatus: null,
          newStatus: "submitted",

          changedBy: "system",
          changedByUserId: uid,

          message: "Booking request submitted.",
          createdAt: now,
        });

        transaction.create(notificationRef, {
          recipientId: uid,
          bookingId: bookingRef.id,

          type: "booking_submitted",
          title: "Booking request submitted",
          message:
            `Your booking request for ${productName} has been submitted for review.`,

          actionUrl:
            `/account/bookings/${bookingRef.id}`,

          isRead: false,
          createdAt: now,
        });

        return {
          bookingId: bookingRef.id,
          bookingNumber,
        };
      },
    );

    return NextResponse.json(
      {
        success: true,
        bookingId: result.bookingId,
        bookingNumber: result.bookingNumber,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const apiError =
      error instanceof BookingApiError
        ? error
        : getSafeUnexpectedError(error);

    console.error("Booking submission failed", {
      code: apiError.code,
      message: apiError.message,
      originalCode: getErrorCode(error),
      error:
        process.env.NODE_ENV === "development"
          ? error
          : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        code: apiError.code,
        message: apiError.message,
      },
      {
        status: apiError.status,
      },
    );
  }
}