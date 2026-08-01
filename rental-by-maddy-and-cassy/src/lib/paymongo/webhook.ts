import { createHmac, timingSafeEqual } from "node:crypto";

export interface PayMongoWebhookEvent {
  data: {
    id: string;
    type?: string;
    attributes: {
      type: string;
      livemode?: boolean;
      data?: {
        id?: string;
        type?: string;
        attributes?: Record<string, unknown>;
      };
    };
  };
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyPayMongoSignature(
  rawBody: string,
  signatureHeader: string | null,
): void {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) {
    throw new Error("MISSING_WEBHOOK_SIGNATURE");
  }

  const values = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return [
        separator >= 0 ? part.slice(0, separator).trim() : "",
        separator >= 0 ? part.slice(separator + 1).trim() : "",
      ];
    }),
  );

  const timestamp = values.t;
  if (!timestamp || !/^\d+$/.test(timestamp)) {
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) {
    throw new Error("STALE_WEBHOOK_SIGNATURE");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const candidates = [values.te, values.li].filter(Boolean);
  if (!candidates.some((candidate) => safeCompare(expected, candidate))) {
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  }
}
