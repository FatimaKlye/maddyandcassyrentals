import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

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

    await adminDb.collection("auditLogs").add({
      action: "account.deleted",
      actorType: "admin",
      actorId: requesterUid,
      targetType: "user",
      targetId: targetUid,
      metadata: { bookingHistoryPreserved: true },
      createdAt: Timestamp.now(),
    });

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const token = getBearerToken(request);
  if (!token) return errorResponse("Administrator authentication is required.", 401);
  const { uid: targetUid } = await params;
  if (!targetUid || targetUid.length > 128) {
    return errorResponse("The selected account is invalid.", 400);
  }
  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: unknown;
        phoneNumber?: unknown;
        fullAddress?: unknown;
        accountStatus?: unknown;
        role?: unknown;
      }
    | null;
  if (!body) return errorResponse("The account update is invalid.", 400);

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
    const targetRef = adminDb.collection("users").doc(targetUid);
    const target = await targetRef.get();
    if (!target.exists) return errorResponse("This user account no longer exists.", 404);

    const accountStatus =
      body.accountStatus === "active" || body.accountStatus === "suspended"
        ? body.accountStatus
        : target.data()?.accountStatus ?? "active";
    const role =
      body.role === "admin" || body.role === "customer"
        ? body.role
        : target.data()?.role ?? "customer";
    if (requesterUid === targetUid && (accountStatus !== "active" || role !== "admin")) {
      return errorResponse("You cannot suspend or demote the account you are using.", 409);
    }
    const cleanOptional = (value: unknown, max: number, fallback: string) =>
      typeof value === "string" ? value.trim().slice(0, max) : fallback;
    const now = Timestamp.now();
    const updates = {
      displayName: cleanOptional(body.displayName, 150, target.data()?.displayName ?? ""),
      phoneNumber: cleanOptional(body.phoneNumber, 50, target.data()?.phoneNumber ?? ""),
      fullAddress: cleanOptional(body.fullAddress, 500, target.data()?.fullAddress ?? ""),
      accountStatus,
      role,
      updatedAt: now,
    };
    const batch = adminDb.batch();
    batch.update(targetRef, updates);
    const adminRef = adminDb.collection("admins").doc(targetUid);
    if (role === "admin") {
      batch.set(
        adminRef,
        {
          active: accountStatus === "active",
          email: target.data()?.email ?? "",
          displayName: updates.displayName,
          createdAt: target.data()?.createdAt ?? now,
          updatedAt: now,
        },
        { merge: true },
      );
    } else {
      batch.set(
        adminRef,
        { active: false, demotedAt: now, updatedAt: now },
        { merge: true },
      );
    }
    batch.set(adminDb.collection("auditLogs").doc(), {
      action: "account.updated",
      actorType: "admin",
      actorId: requesterUid,
      targetType: "user",
      targetId: targetUid,
      metadata: {
        previousStatus: target.data()?.accountStatus,
        accountStatus,
        previousRole: target.data()?.role,
        role,
      },
      createdAt: now,
    });
    await batch.commit();
    await adminAuth.updateUser(targetUid, {
      displayName: updates.displayName || undefined,
      disabled: accountStatus === "suspended",
    });
    await adminAuth.setCustomUserClaims(targetUid, role === "admin" ? { admin: true } : null);
    return NextResponse.json({ success: true, uid: targetUid, accountStatus, role });
  } catch (error) {
    console.error("Admin account update failed", error);
    return errorResponse("The account could not be updated.", 500);
  }
}
