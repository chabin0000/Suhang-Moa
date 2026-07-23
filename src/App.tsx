import { useState } from "react";
import ClassDashboard from "./components/ClassDashboard";
import ClassSelectPage from "./components/ClassSelectPage";
import { useSharedSchedules } from "./hooks/useSharedSchedules";
import type { SelectedClass } from "./types";
import { toClassId } from "./utils/classId";
import { getSelectedClass, saveSelectedClass } from "./utils/storage";

type Screen = "select" | "dashboard";

export default function App() {
  const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(() =>
    getSelectedClass(),
  );
  const [screen, setScreen] = useState<Screen>(() =>
    selectedClass ? "dashboard" : "select",
  );
  const classId = selectedClass ? toClassId(selectedClass) : null;
  const sharedSchedules = useSharedSchedules(classId);

  function handleEnterClass(nextClass: SelectedClass) {
    saveSelectedClass(nextClass);
    setSelectedClass(nextClass);
    setScreen("dashboard");
  }

  return (
    <main className="app-container">
      {screen === "select" || !selectedClass ? (
        <ClassSelectPage
          savedClass={selectedClass}
          onEnterClass={handleEnterClass}
        />
      ) : (
        <ClassDashboard
          selectedClass={selectedClass}
          sharedEvents={sharedSchedules.events}
          sharedScheduleLoading={sharedSchedules.loading}
          sharedScheduleError={sharedSchedules.error}
          onChangeClass={() => setScreen("select")}
        />
      )}
    </main>
  );
}
