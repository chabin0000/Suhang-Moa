import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const projectId = "classmap-rules-test";
const classId = "grade-1-class-2";
const otherClassId = "grade-1-class-3";
let testEnv: RulesTestEnvironment;

const scheduleProposal = (overrides: Record<string, unknown> = {}) => ({
  batchId: "batch-1", ownerUid: "student-a", classId, nickname: "학생", title: "물리 보고서",
  subject: "물리", description: "보고서 제출", type: "performance", dueDate: "2026-08-01",
  status: "pending", createdAt: serverTimestamp(), reviewedAt: null, reviewedBy: null,
  rejectionReason: null, publishedEventId: null, ...overrides,
});

const opinionProposal = (overrides: Record<string, unknown> = {}) => ({
  classId, eventId: "event-published", ownerUid: "student-a", nickname: "학생", content: "참고 자료를 확인해요.",
  status: "pending", createdAt: serverTimestamp(), reviewedAt: null, reviewedBy: null,
  rejectionReason: null, publishedOpinionId: null, ...overrides,
});

const publishedEvent = (overrides: Record<string, unknown> = {}) => ({
  classId, title: "공개 일정", subject: "물리", description: "설명", type: "exam", dueDate: "2026-08-01",
  source: "admin", sourceProposalId: null, status: "published", approvedBy: "super", createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "classes", classId, "events", "event-published"), publishedEvent());
    await setDoc(doc(db, "classes", classId, "events", "event-archived"), publishedEvent({ status: "archived", archivedAt: new Date(), archivedBy: "super" }));
    await setDoc(doc(db, "classes", classId, "events", "event-published", "opinions", "opinion-published"), {
      nickname: "학생", content: "유용한 팁", sourceProposalId: "opinion-source", status: "published", approvedBy: "super", approvedAt: new Date(),
    });
    await setDoc(doc(db, "scheduleProposals", "proposal-a"), scheduleProposal({ createdAt: new Date() }));
    await setDoc(doc(db, "opinionProposals", "opinion-a"), opinionProposal({ createdAt: new Date() }));
    await setDoc(doc(db, "admins", "admin-1"), { role: "class_admin", active: true, classIds: [classId] });
    await setDoc(doc(db, "admins", "admin-other"), { role: "class_admin", active: true, classIds: [otherClassId] });
    await setDoc(doc(db, "admins", "admin-inactive"), { role: "class_admin", active: false, classIds: [classId] });
  });
});

const anonymous = (uid: string) => testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const google = (uid: string, email: string, email_verified = true) => testEnv.authenticatedContext(uid, { email, email_verified, firebase: { sign_in_provider: "google.com" } }).firestore();
const superAdmin = () => google("super", "chabin0960@gmail.com");
const classAdmin = () => google("admin-1", "admin@example.com");

describe("Firestore access policy", () => {
  it("allows only published public events and opinions below published events", async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(collection(publicDb, "classes", classId, "events"), where("status", "==", "published"), limit(50))));
    await assertFails(getDoc(doc(publicDb, "classes", classId, "events", "event-archived")));
    await assertSucceeds(getDocs(query(collection(publicDb, "classes", classId, "events", "event-published", "opinions"), where("status", "==", "published"), limit(50))));
  });

  it("enforces anonymous ownership, exact pending proposal fields, and bounded own history", async () => {
    const studentA = anonymous("student-a");
    const studentB = anonymous("student-b");
    await assertSucceeds(setDoc(doc(studentA, "scheduleProposals", "new-a"), scheduleProposal()));
    await assertFails(setDoc(doc(studentA, "scheduleProposals", "wrong-owner"), scheduleProposal({ ownerUid: "student-b" })));
    await assertFails(setDoc(doc(studentA, "scheduleProposals", "wrong-status"), scheduleProposal({ status: "approved" })));
    await assertFails(setDoc(doc(studentA, "scheduleProposals", "extra"), scheduleProposal({ unexpected: true })));
    await assertSucceeds(getDocs(query(collection(studentA, "scheduleProposals"), where("ownerUid", "==", "student-a"), limit(50))));
    await assertFails(getDocs(query(collection(studentA, "scheduleProposals"), where("ownerUid", "==", "student-a"))));
    await assertFails(getDoc(doc(studentB, "scheduleProposals", "proposal-a")));
    await assertFails(updateDoc(doc(studentA, "scheduleProposals", "proposal-a"), { title: "변조" }));
    await assertFails(deleteDoc(doc(studentA, "scheduleProposals", "proposal-a")));
  });

  it("requires a published parent in the same class for anonymous opinion proposals", async () => {
    const studentA = anonymous("student-a");
    await assertSucceeds(setDoc(doc(studentA, "opinionProposals", "new-opinion"), opinionProposal()));
    await assertFails(setDoc(doc(studentA, "opinionProposals", "wrong-event"), opinionProposal({ eventId: "missing" })));
    await assertFails(setDoc(doc(studentA, "opinionProposals", "wrong-class"), opinionProposal({ classId: otherClassId })));
  });

  it("allows only verified Google moderators in their class and protects admin documents", async () => {
    const unverified = google("unverified", "chabin0960@gmail.com", false);
    const wrongClass = google("admin-other", "other@example.com");
    const inactive = google("admin-inactive", "inactive@example.com");
    await assertSucceeds(getDocs(query(collection(classAdmin(), "scheduleProposals"), where("classId", "==", classId), where("status", "==", "pending"), limit(50))));
    await assertFails(getDocs(query(collection(classAdmin(), "scheduleProposals"), where("status", "==", "pending"), limit(50))));
    await assertFails(getDocs(query(collection(wrongClass, "scheduleProposals"), where("classId", "==", classId), where("status", "==", "pending"), limit(50))));
    await assertFails(getDocs(query(collection(inactive, "scheduleProposals"), where("classId", "==", classId), where("status", "==", "pending"), limit(50))));
    await assertFails(getDocs(query(collection(unverified, "scheduleProposals"), where("status", "==", "pending"), limit(50))));
    await assertSucceeds(getDocs(query(collection(superAdmin(), "scheduleProposals"), where("status", "==", "pending"), limit(50))));
    await assertSucceeds(getDoc(doc(classAdmin(), "admins", "admin-1")));
    await assertFails(getDoc(doc(classAdmin(), "admins", "admin-other")));
    await assertFails(setDoc(doc(classAdmin(), "admins", "admin-1"), { role: "class_admin", active: true, classIds: [classId] }));
  });

  it("requires matching atomic approval, preserves proposal originals, and archives only as the caller", async () => {
    const db = classAdmin();
    const proposalRef = doc(db, "scheduleProposals", "proposal-a");
    await assertFails(updateDoc(proposalRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", publishedEventId: "event-new" }));
    const batch = writeBatch(db);
    batch.set(doc(db, "classes", classId, "events", "event-new"), {
      ...publishedEvent({ source: "approved-proposal", sourceProposalId: "proposal-a", approvedBy: "admin-1" }), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.update(proposalRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", rejectionReason: null, publishedEventId: "event-new" });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db, "scheduleProposals", "proposal-a"), { title: "원본 변조" }));
    await assertFails(updateDoc(doc(db, "classes", classId, "events", "event-published"), { status: "archived", archivedAt: serverTimestamp(), archivedBy: "someone-else", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "classes", classId, "events", "event-published"), { status: "archived", archivedAt: serverTimestamp(), archivedBy: "admin-1", updatedAt: serverTimestamp() }));
  });

  it("requires matching atomic opinion publication and prevents a rejection from linking public data", async () => {
    const db = classAdmin();
    const proposalRef = doc(db, "opinionProposals", "opinion-a");
    await assertFails(updateDoc(proposalRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", publishedOpinionId: "new-opinion" }));
    await assertFails(updateDoc(proposalRef, { status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", rejectionReason: "사유", publishedOpinionId: "new-opinion" }));
    const batch = writeBatch(db);
    batch.set(doc(db, "classes", classId, "events", "event-published", "opinions", "new-opinion"), {
      nickname: "학생", content: "참고 자료를 확인해요.", sourceProposalId: "opinion-a", status: "published", approvedBy: "admin-1", approvedAt: serverTimestamp(),
    });
    batch.update(proposalRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", rejectionReason: null, publishedOpinionId: "new-opinion" });
    await assertSucceeds(batch.commit());
  });
});
