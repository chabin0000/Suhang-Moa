import { useMyProposals } from "../hooks/useMyProposals";

const statusLabel = { pending: "검토 대기", approved: "승인됨", rejected: "반려됨" } as const;

export default function ProposalStatusPanel() {
  const { proposals, loading, error } = useMyProposals();
  if (loading || (proposals.length === 0 && !error)) return null;
  return <section className="proposal-status-panel" aria-label="내 제안 상태">
    <header><p className="overline">MY PROPOSALS</p><h2>내 제안 상태</h2></header>
    {error ? <p className="shared-schedule-notice" role="status">제안 상태를 불러오지 못했습니다.</p> : <ul>{proposals.map((proposal) => <li key={proposal.id}><div><strong>{proposal.title}</strong><span className={`proposal-status proposal-status-${proposal.status}`}>{statusLabel[proposal.status]}</span></div>{proposal.status === "rejected" && proposal.rejectionReason ? <p>{proposal.rejectionReason}</p> : null}</li>)}</ul>}
  </section>;
}
