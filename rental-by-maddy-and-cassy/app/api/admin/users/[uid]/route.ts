import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase/admin";

export const runtime = "nodejs";

interface ErrorWithCode {
  code?: string;
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === code
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const token = getBearerToken(request);
  if (!token) {
    return errorResponse("Administrator authentication is required.", 401);
  }

  const { uid: targetUid } = await params;
  if (!targetUid || targetUid.length > 128) {
    return errorResponse("The selected account is invalid.", 400);
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let requesterUid: string;
    try {
      requesterUid = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return errorResponse("Your administrator session is invalid or expired.", 401);
    }

    const requesterAdmin = await adminDb.collection("admins").doc(requesterUid).get();
    if (!requesterAdmin.exists || requesterAdmin.data()?.active !== true) {
      return errorResponse("Active administrator access is required.", 403);
    }

    if (requesterUid === targetUid) {
      return errorResponse("You cannot delete the account you are currently using.", 409);
    }

    const targetUserRef = adminDb.collection("users").doc(targetUid);
    const [targetAdmin, targetProfile] = await Promise.all([
      adminDb.collection("admins").doc(targetUid).get(),
      targetUserRef.get(),
    ]);

    if (targetAdmin.exists) {
      return errorResponse(
        "Administrator accounts are protected and cannot be deleted from customer management.",
        409,
      );
    }

    let authAccountExists = true;
    try {
      await adminAuth.getUser(targetUid);
    } catch (error) {
      if (hasErrorCode(error, "auth/user-not-found")) {
        authAccountExists = false;
      } else {
        throw error;
      }
    }

    if (!authAccountExists && !targetProfile.exists) {
      return errorResponse("This customer account no longer exists.", 404);
    }

    if (authAccountExists) {
      await adminAuth.deleteUser(targetUid);
    }

    // This removes users/{uid} and nested notifications. Booking and rental
    // records remain in their own collections for business history.
    await adminDb.recursiveDelete(targetUserRef);

    return NextResponse.json({
      deleted: true,
      uid: targetUid,
      bookingHistoryPreserved: true,
    });
  } catch (error) {
    console.error("Admin customer deletion failed", error);
    return errorResponse(
      "The customer account could not be deleted. Please try again.",
      500,
    );
  }
}
