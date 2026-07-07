import { ArrowRight, GraduationCap } from "lucide-react";
import { useState } from "react";
import type { SelectedClass } from "../types";
import ClassNumberSelector from "./ClassNumberSelector";
import GradeSelector from "./GradeSelector";

type ClassSelectPageProps = {
  savedClass: SelectedClass | null;
  onEnterClass: (selectedClass: SelectedClass) => void;
};

export default function ClassSelectPage({
  savedClass,
  onEnterClass,
}: ClassSelectPageProps) {
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(
    savedClass?.grade,
  );
  const [selectedClassNo, setSelectedClassNo] = useState<number | undefined>(
    savedClass?.classNo,
  );
  const [errorMessage, setErrorMessage] = useState("");

  function handleEnter() {
    if (!selectedGrade || !selectedClassNo) {
      setErrorMessage("학년과 반을 모두 선택한 뒤 들어갈 수 있습니다.");
      return;
    }

    setErrorMessage("");
    onEnterClass({ grade: selectedGrade, classNo: selectedClassNo });
  }

  return (
    <section className="landing-page">
      <div className="landing-shell">
        <div className="brand-lockup" aria-label="ClassMap 소개">
          <span className="brand-mark" aria-hidden="true">
            <GraduationCap size={22} strokeWidth={2.1} />
          </span>
          <p className="overline">Local class planner</p>
          <h1>ClassMap</h1>
          <p className="landing-subtitle">
            가입 없이 원클릭으로 끝내는 우리 반 수행평가 지도
          </p>
        </div>

        <div className="selection-panel">
          <section className="selection-block" aria-labelledby="grade-title">
            <div>
              <p className="overline">Step 01</p>
              <h2 id="grade-title">학년 선택</h2>
            </div>
            <GradeSelector
              selectedGrade={selectedGrade}
              onSelect={(grade) => {
                setSelectedGrade(grade);
                setErrorMessage("");
              }}
            />
          </section>

          <section className="selection-block" aria-labelledby="class-title">
            <div>
              <p className="overline">Step 02</p>
              <h2 id="class-title">반 선택</h2>
            </div>
            <ClassNumberSelector
              selectedClassNo={selectedClassNo}
              onSelect={(classNo) => {
                setSelectedClassNo(classNo);
                setErrorMessage("");
              }}
            />
          </section>

          <div className="entry-actions">
            <p className="selection-hint">
              {savedClass
                ? `${savedClass.grade}학년 ${savedClass.classNo}반 선택값을 불러왔습니다.`
                : "처음 접속했다면 학년과 반을 선택해 주세요."}
            </p>
            {errorMessage && <p className="form-error">{errorMessage}</p>}
            <button type="button" className="primary-button" onClick={handleEnter}>
              우리 반 들어가기
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
