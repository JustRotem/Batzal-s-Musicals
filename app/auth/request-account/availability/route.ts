import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function normalize(value: string | null) {
  return (value || "").trim();
}

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUsername(value: string) {
  return /^[\p{L}\p{N}_ ]+$/u.test(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = normalize(searchParams.get("email")).toLowerCase();
  const username = normalize(searchParams.get("username"));

  const payload: {
    email?: { checked: boolean; exists: boolean; valid: boolean };
    username?: { checked: boolean; exists: boolean; valid: boolean };
  } = {};

  if (email) {
    const valid = isPlausibleEmail(email);
    if (!valid) {
      payload.email = { checked: false, exists: false, valid: false };
    } else {
      const existingByEmail = await db.user.findFirst({
        where: { email },
        select: { id: true },
      });

      payload.email = {
        checked: true,
        exists: Boolean(existingByEmail),
        valid: true,
      };
    }
  }

  if (username) {
    const valid = username.length >= 3 && isValidUsername(username);
    if (!valid) {
      payload.username = { checked: false, exists: false, valid: false };
    } else {
      const existingByUsername = await db.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      payload.username = {
        checked: true,
        exists: Boolean(existingByUsername),
        valid: true,
      };
    }
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
