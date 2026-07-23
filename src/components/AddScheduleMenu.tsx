import { CalendarPlus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AddScheduleMenuProps = {
  onAddPersonal: () => void;
  onProposeClass: () => void;
};

export default function AddScheduleMenu({ onAddPersonal, onProposeClass }: AddScheduleMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="add-schedule-menu" ref={menuRef}>
      <button type="button" className="floating-add-button" onClick={() => setOpen((current) => !current)} aria-label="일정 추가 메뉴" title="일정 추가">
        <CalendarPlus size={21} aria-hidden="true" />
      </button>
      {open && (
        <div className="add-schedule-popover" role="menu" aria-label="일정 추가 메뉴">
          <button type="button" role="menuitem" onClick={() => choose(onAddPersonal)}>
            <CalendarPlus size={17} aria-hidden="true" /> 내 일정 추가
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onProposeClass)}>
            <Send size={17} aria-hidden="true" /> 반 일정 제안
          </button>
        </div>
      )}
    </div>
  );
}
