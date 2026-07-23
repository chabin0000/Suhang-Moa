import { Trash2 } from "lucide-react";
import type { ProposalDraft } from "../types";

type ProposalCartProps = { items: ProposalDraft[]; onRemove: (index: number) => void };

export default function ProposalCart({ items, onRemove }: ProposalCartProps) {
  return (
    <section className="proposal-cart" aria-label="제안 목록">
      <div className="proposal-cart-header"><strong>제안 목록</strong><span>{items.length} / 10</span></div>
      {items.length === 0 ? <p className="proposal-cart-empty">아직 담긴 제안이 없습니다.</p> : (
        <ul>
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <span><strong>{item.title}</strong><small>{item.dueDate}</small></span>
              <button type="button" className="icon-button" onClick={() => onRemove(index)} aria-label={`${item.title} 제거`} title="제거"><Trash2 size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
