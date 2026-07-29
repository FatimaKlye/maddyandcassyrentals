const PAYMONGO_API_URL = "https://api.paymongo.com/v2";

export const DEFAULT_PAYMENT_METHODS = [
  "card",
  "gcash",
  "grab_pay",
  "paymaya",
  "qrph",
] as const;

export interface CreateCheckoutInput {
  amountCentavos: number;
  productName: string;
  bookingRef: string;
  referenceNumber: string;
  paymentLabel: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}

interface PayMongoCheckoutResponse {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
      livemode?: boolean;
    };
  };
  errors?: Array<{ detail?: string; code?: string }>;
}

export class PayMongoError extends Error {
  constructor(
    message: string,
    public readonly providerCode?: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

function getSecretKey(): string {
  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new PayMongoError(
      "Online payment is not configured yet. Please contact the business.",
      "missing_configuration",
      503,
    );
  }
  return secretKey;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<{ id: string; checkoutUrl: string; livemode: boolean }> {
  const methods =
    process.env.PAYMONGO_PAYMENT_METHODS?.split(",")
      .map((method) => method.trim())
      .filter(Boolean) ?? [...DEFAULT_PAYMENT_METHODS];

  const response = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${getSecretKey()}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 255),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            name: input.customer.name,
            email: input.customer.email,
            phone: input.customer.phone || undefined,
          },
          line_items: [
            {
              name: input.paymentLabel,
              description: `Booking ${input.bookingRef}`,
              amount: input.amountCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: methods,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.referenceNumber,
          description: `Rental payment for ${input.bookingRef}`,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          metadata: input.metadata,
        },
      },
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as PayMongoCheckoutResponse;
  const id = body.data?.id;
  const checkoutUrl = body.data?.attributes?.checkout_url;

  if (!response.ok || !id || !checkoutUrl) {
    const firstError = body.errors?.[0];
    throw new PayMongoError(
      firstError?.detail || "PayMongo could not create a checkout session.",
      firstError?.code,
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  return {
    id,
    checkoutUrl,
    livemode: body.data?.attributes?.livemode === true,
  };
}
