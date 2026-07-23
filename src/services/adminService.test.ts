import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAppMock = vi.hoisted(() => ({ getFirestoreDb: vi.fn() }));
const firestoreMock = vi.hoisted(() => ({ doc: vi.fn(), getDoc: vi.fn() }));

vi.mock("../firebase/app", () => firebaseAppMock);
vi.mock("firebase/firestore", () => firestoreMock);

import { AdminScopeLookupError, getAdminScope } from "./adminService";

const db = { kind: "db" };
const classAdmin = {
  uid: "class-admin-1",
  email: "teacher@example.com",
  emailVerified: true,
};

function documentSnapshot(data: unknown, exists = true) {
  return { exists: () => exists, data: () => data };
}

describe("adminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    firestoreMock.doc.mockReturnValue({ kind: "admin-document" });
  });

  it("normalizes a verified super-admin email without reading Firestore", async () => {
    await expect(getAdminScope({
      uid: "super-admin",
      email: "  CHABIN0960@GMAIL.COM  ",
      emailVerified: true,
    })).resolves.toEqual({ role: "super_admin", classIds: [] });

    expect(firestoreMock.getDoc).not.toHaveBeenCalled();
  });

  it("rejects an unverified super-admin email", async () => {
    firestoreMock.getDoc.mockResolvedValue(documentSnapshot(null, false));

    await expect(getAdminScope({
      uid: "super-admin",
      email: "chabin0960@gmail.com",
      emailVerified: false,
    })).resolves.toBeNull();
  });

  it("reads the exact admin document path and returns only declared class IDs", async () => {
    firestoreMock.getDoc.mockResolvedValue(documentSnapshot({
      role: "class_admin",
      active: true,
      classIds: ["grade-1-class-2", "grade-3-class-12"],
    }));

    await expect(getAdminScope(classAdmin)).resolves.toEqual({
      role: "class_admin",
      classIds: ["grade-1-class-2", "grade-3-class-12"],
    });
    expect(firestoreMock.doc).toHaveBeenCalledWith(db, "admins", "class-admin-1");
    expect(firestoreMock.getDoc).toHaveBeenCalledWith({ kind: "admin-document" });
  });

  it.each([
    [undefined],
    [{ role: "class_admin", active: false, classIds: ["grade-1-class-2"] }],
    [{ role: "class_admin", active: true, classIds: [] }],
    [{ role: "class_admin", active: true, classIds: ["grade-1-class-2", "grade-1-class-2"] }],
    [{ role: "class_admin", active: true, classIds: ["grade-4-class-1"] }],
    [{ role: "class_admin", active: true, classIds: ["grade-1-class-2"], createdAt: "extra" }],
  ])("rejects missing, malformed, inactive, or extra-field class-admin documents", async (data) => {
    firestoreMock.getDoc.mockResolvedValue(
      data === undefined ? documentSnapshot(null, false) : documentSnapshot(data),
    );

    await expect(getAdminScope(classAdmin)).resolves.toBeNull();
  });

  it("maps Firestore document read failures to an admin scope lookup error", async () => {
    firestoreMock.getDoc.mockRejectedValue(new Error("network unavailable"));

    await expect(getAdminScope(classAdmin)).rejects.toEqual(
      new AdminScopeLookupError(),
    );
  });
});
