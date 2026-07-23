import { useEffect, useState } from "react";
import {
  firebaseSharedScheduleGateway,
  SharedScheduleGatewayError,
  SharedScheduleValidationError,
  type SharedScheduleErrorCode,
  type SharedScheduleGateway,
} from "../services/sharedScheduleService";
import type { ClassId, SharedEvent } from "../types";

export type SharedSchedulesState = {
  events: SharedEvent[];
  loading: boolean;
  error: SharedScheduleErrorCode | null;
};

export function useSharedSchedules(
  classId: ClassId | null,
  gateway: SharedScheduleGateway = firebaseSharedScheduleGateway,
): SharedSchedulesState {
  const [state, setState] = useState<SharedSchedulesState>({
    events: [],
    loading: classId !== null,
    error: null,
  });

  useEffect(() => {
    if (!classId) {
      setState({ events: [], loading: false, error: null });
      return;
    }

    let isActive = true;
    let unsubscribe = () => {};

    setState({ events: [], loading: true, error: null });

    try {
      unsubscribe = gateway.subscribePublished(
        classId,
        (events) => {
          if (!isActive) {
            return;
          }

          setState({ events, loading: false, error: null });
        },
        (error) => {
          if (!isActive) {
            return;
          }

          if (error instanceof SharedScheduleValidationError) {
            console.error(`[ClassMap] ${error.message}`);
            return;
          }

          const code =
            error instanceof SharedScheduleGatewayError
              ? error.code
              : "network";

          setState((current) => ({
            ...current,
            loading: false,
            error: code,
          }));
        },
      );
    } catch {
      if (isActive) {
        setState({
          events: [],
          loading: false,
          error: "network",
        });
      }
    }

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [classId, gateway]);

  return state;
}
