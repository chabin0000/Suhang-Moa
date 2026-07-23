import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

export default async function globalSetup() {
  const testEnv = await initializeTestEnvironment({ projectId: "classmap-e2e" });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = new Date("2026-07-23T00:00:00.000Z");
    await setDoc(doc(db, "classes", "grade-1-class-2", "events", "shared-event"), {
      classId: "grade-1-class-2", title: "공유된 물리 보고서", subject: "물리",
      description: "반 전체가 확인하는 일정입니다.", type: "performance", dueDate: "2026-07-30",
      source: "admin", sourceProposalId: null, status: "published", approvedBy: "seed", createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, "classes", "grade-1-class-2", "events", "shared-event", "opinions", "published-tip"), {
      nickname: "선배", content: "실험 결과를 먼저 정리해 두세요.", sourceProposalId: "seed", status: "published", approvedBy: "seed", approvedAt: now,
    });
    await setDoc(doc(db, "classes", "grade-1-class-2", "events", "archived-event"), {
      classId: "grade-1-class-2", title: "숨겨진 일정", subject: "물리", description: "",
      type: "etc", dueDate: "2026-07-31", source: "admin", sourceProposalId: null,
      status: "archived", approvedBy: "seed", archivedBy: "seed", archivedAt: now, createdAt: now, updatedAt: now,
    });
  });
  await testEnv.cleanup();
}
