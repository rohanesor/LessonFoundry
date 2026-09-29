import {
  PassIcon,
  WarningIcon,
  FailIcon,
  DraftIcon,
  LockedIcon,
  QueuedIcon,
  RunningIcon,
  ApprovalIcon,
} from "@/components/icons/brand";

export function Status({
  state,
  label,
}: {
  state: string;
  label?: string;
}) {
  const text = label || state.replaceAll("_", " ");
  const isApproved = state === "APPROVED";
  const isPass = ["PASS", "SUPPORTED", "Succeeded", "Ready"].includes(state);
  const isFail = ["FAIL", "Failed", "GAP"].includes(state);
  const isWarning =
    state === "WARNING" ||
    state === "NEEDS_REVIEW" ||
    state === "NEEDS REVIEW";
  const isDraft = state === "DRAFT";
  const isQueued = state === "Queued";
  const isRunning = state === "Running";

  let cls = "status";
  let Icon = DraftIcon;

  if (isApproved) {
    cls += " good approved";
    Icon = ApprovalIcon;
  } else if (isPass) {
    cls += " good";
    Icon = PassIcon;
  } else if (isFail) {
    cls += " bad";
    Icon = FailIcon;
  } else if (isWarning) {
    cls += " warning";
    Icon = WarningIcon;
  } else if (isDraft) {
    cls += " draft";
    Icon = DraftIcon;
  } else if (isQueued) {
    cls += " draft";
    Icon = QueuedIcon;
  } else if (isRunning) {
    cls += " warning";
    Icon = RunningIcon;
  } else {
    cls += " draft";
    Icon = LockedIcon;
  }

  return (
    <span className={cls}>
      <Icon size={13} aria-hidden="true" />
      {text}
    </span>
  );
}

export function Skeleton() {
  return (
    <div className="skeletons" role="status" aria-label="Loading content">
      {[1, 2, 3, 4].map((x) => (
        <div className="skeleton-card" key={x}>
          <i />
          <i />
          <i />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
