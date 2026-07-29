import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailOtp,
  hashEmailOtp,
  verifyEmailOtpHash,
} from "../src/lib/server/emailOtp";

process.env.EMAIL_OTP_HMAC_SECRET = "test-only-secret-at-least-32-characters-long";

test("email OTP codes are always six numeric digits", () => {
  for (let index = 0; index < 50; index += 1) {
    assert.match(createEmailOtp(), /^\d{6}$/);
  }
});

test("email OTP hashes verify only the correct account and code", () => {
  const uid = "customer-123";
  const email = "customer@example.com";
  const code = "381204";
  const hash = hashEmailOtp(uid, email, code);

  assert.equal(verifyEmailOtpHash(uid, email, code, hash), true);
  assert.equal(verifyEmailOtpHash(uid, email, "381205", hash), false);
  assert.equal(verifyEmailOtpHash("another-user", email, code, hash), false);
  assert.equal(
    verifyEmailOtpHash(uid, "another@example.com", code, hash),
    false,
  );
});

test("email OTP hashing is case-insensitive for the same email", () => {
  const first = hashEmailOtp("customer-123", "Customer@Example.com", "123456");
  const second = hashEmailOtp("customer-123", "customer@example.com", "123456");
  assert.equal(first, second);
});
