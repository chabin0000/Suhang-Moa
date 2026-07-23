import { useEffect, useState } from "react";
import type { ScheduleProposal } from "../schemas/proposal";
import type { ProposalHistoryGateway } from "../services/proposalService";

type ProposalState = { proposals: ScheduleProposal[]; loading: boolean; error: boolean };
type GatewayLoader = () => Promise<ProposalHistoryGateway>;

export async function loadDefaultProposalHistoryGateway(): Promise<ProposalHistoryGateway> {
  const { loadDefaultProposalHistoryGateway: loadGateway } = await import("../services/proposalService");
  return loadGateway();
}

export function useMyProposals(
  loadGateway: GatewayLoader = loadDefaultProposalHistoryGateway,
): ProposalState {
  const [state, setState] = useState<ProposalState>({ proposals: [], loading: true, error: false });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void loadGateway()
      .then((gateway) => {
        if (!active) return;
        unsubscribe = gateway.subscribeExistingAnonymous(
          (proposals) => { if (active) setState({ proposals, loading: false, error: false }); },
          () => { if (active) setState((current) => ({ ...current, loading: false, error: true })); },
        );
      })
      .catch(() => { if (active) setState({ proposals: [], loading: false, error: true }); });
    return () => { active = false; unsubscribe?.(); };
  }, [loadGateway]);

  return state;
}
