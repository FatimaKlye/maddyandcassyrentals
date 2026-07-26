import { auth } from "../firebase/config";

export type SubmitBookingInput = {
  productId: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  fulfillmentMethod: "pickup" | "delivery";
  customerLocation: string;
};

export type SubmitBookingResult = {
  success: true;
  bookingId: string;
  bookingNumber: string;
};

type BookingErrorResponse = {
  success?: false;
  code?: string;
  message?: string;
};

export class SubmitBookingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SubmitBookingError";
  }
}

export async function submitBookingRequest(
  input: SubmitBookingInput,
): Promise<SubmitBookingResult> {
  const user = auth.currentUser;

  if (!user) {
    throw new SubmitBookingError(
      "unauthenticated",
      "Please sign in before submitting a booking request.",
    );
  }

  let token: string;

  try {
    token = await user.getIdToken();
  } catch {
    throw new SubmitBookingError(
      "unauthenticated",
      "Your login session has expired. Please sign in again.",
    );
  }

  let response: Response;

  try {
    response = await fetch("/api/bookings/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SubmitBookingError(
      "network-error",
      "The booking service could not be reached. Please check your connection and try again.",
    );
  }

  const responseData = (await response
    .json()
    .catch(() => null)) as
    | SubmitBookingResult
    | BookingErrorResponse
    | null;

  if (!response.ok) {
    const errorData = responseData as BookingErrorResponse | null;

    throw new SubmitBookingError(
      errorData?.code ?? "internal-error",
      errorData?.message ??
        "We could not submit your booking request. Please try again.",
    );
  }

  if (
    !responseData ||
    responseData.success !== true ||
    typeof responseData.bookingId !== "string" ||
    typeof responseData.bookingNumber !== "string"
  ) {
    throw new SubmitBookingError(
      "invalid-response",
      "The server returned an invalid booking response.",
    );
  }

  return responseData;
}