type GradeSelectorProps = {
  selectedGrade?: number;
  onSelect: (grade: number) => void;
};

const grades = [1, 2, 3];

export default function GradeSelector({
  selectedGrade,
  onSelect,
}: GradeSelectorProps) {
  return (
    <div className="grade-selector" aria-label="학년 선택">
      {grades.map((grade) => (
        <button
          key={grade}
          type="button"
          className={selectedGrade === grade ? "selected-button" : ""}
          aria-pressed={selectedGrade === grade}
          onClick={() => onSelect(grade)}
        >
          {grade}학년
        </button>
      ))}
    </div>
  );
}
