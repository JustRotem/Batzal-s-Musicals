import { createHash, randomInt } from "crypto";

const PHONE_VERIFICATION_TTL_MS = 1000 * 60 * 10;

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function isValidPhone(value: string) {
  return /^\+?[0-9]{8,15}$/.test(value);
}

export function hashPhoneVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function createPhoneVerificationCode() {
  const code = String(randomInt(100000, 1000000));

  return {
    code,
    codeHash: hashPhoneVerificationCode(code),
    expiresAt: new Date(Date.now() + PHONE_VERIFICATION_TTL_MS),
  };
}

export async function sendPhoneVerificationCodeMessage({
  phone,
  code,
}: {
  phone: string;
  code: string;
}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Phone verification delivery is not configured in production");
  }

  console.info("[phone-verification] mock send", {
    phone,
    code,
  });
}
