export function isDemoPaymentEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (
      !process.env.PAYMONGO_SECRET_KEY?.trim() ||
      !process.env.PAYMONGO_WEBHOOK_SECRET?.trim()
    )
  );
}
