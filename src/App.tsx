import { useState } from "react";
import ClassDashboard from "./components/ClassDashboard";
import ClassSelectPage from "./components/ClassSelectPage";
import type { SelectedClass } from "./types";
import { getSelectedClass, saveSelectedClass } from "./utils/storage";

type Screen = "select" | "dashboard";

export default function App() {
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(() =>
    getSelectedClass(),
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
          onChangeClass={() => setScreen("select")}
        />
      )}
    </main>
  );
}
