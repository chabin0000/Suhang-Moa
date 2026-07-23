import { useEffect, useState } from "react";
import type {
  SharedScheduleErrorCode,
  SharedScheduleGateway,
  SharedScheduleSubscriptionError,
} from "../services/sharedScheduleService";
import type { ClassId, SharedEvent } from "../types";

export type SharedSchedulesState = {
  events: SharedEvent[];
  loading: boolean;
  error: SharedScheduleErrorCode | null;
};

type DefaultGatewayLoader = () => Promise<SharedScheduleGateway>;

export async function loadDefaultSharedScheduleGateway(): Promise<SharedScheduleGateway> {
  const { firebaseSharedScheduleGateway } = await import(
    "../services/sharedScheduleService"
  );
  return firebaseSharedScheduleGateway;
}

function getErrorCode(
  error: SharedScheduleSubscriptionError,
): SharedScheduleErrorCode {
  if (
    error.code === "firebase-disabled" ||
    error.code === "permission-denied" ||
    error.code === "network"
  ) {
    return error.code;
  }

  return "network";
}

export function useSharedSchedules(
  classId: ClassId | null,
  gateway?: SharedScheduleGateway,
  loadDefaultGateway: DefaultGatewayLoader = loadDefaultSharedScheduleGateway,
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
    let unsubscribe: (() => void) | null = null;

    setState({ events: [], loading: true, error: null });

    const handleError = (error: SharedScheduleSubscriptionError) => {
      if (!isActive) {
        return;
      }

      if (error.category === "validation") {
        console.error(`[ClassMap] ${error.message}`);
        return;
      }

      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorCode(error),
      }));
    };

    const subscribe = (selectedGateway: SharedScheduleGateway) => {
      if (!isActive) {
        return;
      }

      try {
        const nextUnsubscribe = selectedGateway.subscribePublished(
        classId,
        (events) => {
          if (!isActive) {
            return;
          }

          setState({ events, loading: false, error: null });
        },
        handleError,
      );
        if (isActive) {
          unsubscribe = nextUnsubscribe;
        } else {
          nextUnsubscribe();
        }
      } catch {
        if (isActive) {
          setState({
            events: [],
            loading: false,
            error: "network",
          });
        }
      }
    };

    if (gateway) {
      subscribe(gateway);
    } else {
      void loadDefaultGateway()
        .then((defaultGateway) => {
          subscribe(defaultGateway);
        })
        .catch(() => {
          if (isActive) {
            setState({
              events: [],
              loading: false,
              error: "network",
            });
          }
        });
    }

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [classId, gateway, loadDefaultGateway]);

  return state;
}
