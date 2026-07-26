import type { ReactNode } from "react";

export function PageHead({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
}) {
  return (
    <div>
      {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
      <div className="page-head">
        <h1>{title}</h1>
        <div className="spacer" />
        {actions}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: "blue",
  screened: "blue",
  shortlisted: "amber",
  in_process: "amber",
  in_interview: "amber",
  pending_approval: "amber",
  submitted: "amber",
  pending: "gray",
  draft: "gray",
  assigned: "blue",
  approved: "green",
  published: "green",
  selected: "green",
  verified: "green",
  placed: "green",
  rejected: "red",
  blacklisted: "red",
  closed: "gray",
  discarded: "gray",
  promoted: "green",
};

export function Badge({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "gray";
  return <span className={`badge ${tone}`}>{value.replace(/_/g, " ")}</span>;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <div className="spacer" />
          <button className="btn link" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
