import { useCallback, useEffect, useState } from "react";
import type {
  ModerationQueueErrorCode,
  ModerationQueueGateway,
  ModerationQueueRow,
  ModerationQueueTab,
} from "../services/adminService";
import type { AdminScope, ClassId } from "../types";
import { isClassId } from "../utils/classId";

export type { ModerationQueueGateway } from "../services/adminService";

export type ModerationQueueState = {
  rows: ModerationQueueRow[];
  loading: boolean;
  empty: boolean;
  error: ModerationQueueErrorCode | null;
  refresh: () => void;
};

type GatewayLoader = () => Promise<ModerationQueueGateway>;

export async function loadDefaultModerationQueueGateway(): Promise<ModerationQueueGateway> {
  const { firebaseModerationQueueGateway } = await import("../services/adminService");
  return firebaseModerationQueueGateway;
}

function isAllowed(scope: AdminScope, selectedClassId: ClassId | null): boolean {
  if (selectedClassId !== null && !isClassId(selectedClassId)) return false;
  return scope.role === "super_admin" || (selectedClassId !== null && scope.classIds.includes(selectedClassId));
}

export function useModerationQueue(
  scope: AdminScope | null,
  selectedClassId: ClassId | null,
  tab: ModerationQueueTab,
  gateway?: ModerationQueueGateway,
  loadGateway: GatewayLoader = loadDefaultModerationQueueGateway,
): ModerationQueueState {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);
  const [state, setState] = useState<Omit<ModerationQueueState, "refresh">>({ rows: [], loading: Boolean(scope), empty: false, error: null });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    if (!scope) {
      setState({ rows: [], loading: false, empty: false, error: null });
      return () => { active = false; };
    }
    if (!isAllowed(scope, selectedClassId)) {
      setState({ rows: [], loading: false, empty: true, error: "unauthorized" });
      return () => { active = false; };
    }
    setState({ rows: [], loading: true, empty: false, error: null });
    const subscribe = (selectedGateway: ModerationQueueGateway) => {
      if (!active) return;
      try {
        const nextUnsubscribe = selectedGateway.subscribe(scope, selectedClassId, tab, (rows) => {
          if (active) setState({ rows, loading: false, empty: rows.length === 0, error: null });
        }, (error) => {
          if (active) setState({ rows: [], loading: false, empty: false, error });
        });
        if (active) unsubscribe = nextUnsubscribe;
        else nextUnsubscribe();
      } catch {
        if (active) setState({ rows: [], loading: false, empty: false, error: "retryable" });
      }
    };
    if (gateway) subscribe(gateway);
    else void loadGateway().then(subscribe).catch(() => {
      if (active) setState({ rows: [], loading: false, empty: false, error: "retryable" });
    });
    return () => { active = false; unsubscribe?.(); };
  }, [scope, selectedClassId, tab, gateway, loadGateway, refreshKey]);

  return { ...state, refresh };
}
