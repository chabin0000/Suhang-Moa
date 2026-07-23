import { useState } from "react";
import ClassDashboard from "./components/ClassDashboard";
import ClassSelectPage from "./components/ClassSelectPage";
import type { SelectedClass, SharedEvent } from "./types";
import { getSelectedClass, saveSelectedClass } from "./utils/storage";

type Screen = "select" | "dashboard";

// Task 5에서 Firebase 구독 결과로 교체한다.
const sharedEvents: SharedEvent[] = [];

export default function App() {
  const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(() =>
    getSelectedClass(),
  );
  const [screen, setScreen] = useState<Screen>(() =>
    selectedClass ? "dashboard" : "select",
  );

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
          sharedEvents={sharedEvents}
          onChangeClass={() => setScreen("select")}
        />
      )}
    </main>
  );
}
