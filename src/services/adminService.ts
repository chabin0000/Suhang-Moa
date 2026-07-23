import { doc, getDoc } from "firebase/firestore";
import { z } from "zod";
import { getFirestoreDb } from "../firebase/app";
import type { AdminScope, ClassId } from "../types";
import { isClassId } from "../utils/classId";

const SUPER_ADMIN_EMAIL = "chabin0960@gmail.com";

export type AdminIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

const classIdSchema = z.string().refine(isClassId);
const classAdminDocumentSchema = z.object({
  role: z.literal("class_admin"),
  active: z.literal(true),
  classIds: z.array(classIdSchema).min(1).refine(
    (classIds) => new Set(classIds).size === classIds.length,
  ),
}).strict();

export class AdminScopeLookupError extends Error {
  constructor() {
    super("관리자 권한 문서를 확인하지 못했습니다.");
    this.name = "AdminScopeLookupError";
  }
}

function normalizeEmail(email: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export async function getAdminScope(
  user: AdminIdentity,
): Promise<AdminScope | null> {
  if (!user.emailVerified) {
    return null;
  }

  if (normalizeEmail(user.email) === SUPER_ADMIN_EMAIL) {
    return { role: "super_admin", classIds: [] };
  }

  try {
    const db = getFirestoreDb();
    if (!db) {
      return null;
    }
    const snapshot = await getDoc(doc(db, "admins", user.uid));
    if (!snapshot.exists()) {
      return null;
    }

    const parsed = classAdminDocumentSchema.safeParse(snapshot.data());
    if (!parsed.success) {
      return null;
    }

    return {
      role: "class_admin",
      classIds: parsed.data.classIds as ClassId[],
    };
  } catch {
    throw new AdminScopeLookupError();
  }
}
