type ClassNumberSelectorProps = {
  selectedClassNo?: number;
  onSelect: (classNo: number) => void;
};

const classNumbers = Array.from({ length: 12 }, (_, index) => index + 1);

export default function ClassNumberSelector({
  selectedClassNo,
  onSelect,
}: ClassNumberSelectorProps) {
  return (
    <div className="class-selector" aria-label="반 선택">
      {classNumbers.map((classNo) => (
        <button
          key={classNo}
          type="button"
          className={selectedClassNo === classNo ? "selected-button" : ""}
          aria-pressed={selectedClassNo === classNo}
          onClick={() => onSelect(classNo)}
        >
          {classNo}반
        </button>
      ))}
    </div>
  );
}
