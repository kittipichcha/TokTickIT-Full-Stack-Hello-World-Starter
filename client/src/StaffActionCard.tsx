import type { ReactNode } from "react";
import { ACTION_STATUS_LABELS, type StaffActionDto } from "./api";
import { formatUtcDate } from "./format";
function ActionField({ label, children }: { label: string; children: ReactNode }) { return <div className="action-field"><span className="action-field-label">{label}</span><span className="action-field-value">{children}</span></div>; }
function ActionStatusChip({ status }: { status: keyof typeof ACTION_STATUS_LABELS }) { return <span className={`action-status-badge action-status-${status.toLowerCase()}`}>{ACTION_STATUS_LABELS[status]}</span>; }
export default function StaffActionCard({ action, onOpen, className = "action-card" }: { className?: string; action: StaffActionDto; onOpen: (action: StaffActionDto) => void }) { return <div className={className}>
                <div className="action-card-header">
                  <ActionStatusChip status={action.status} />
                  <span className="action-card-date">{formatUtcDate(action.createdAt)}</span>
                </div>
                <p className="action-card-description">{action.description}</p>
                <div className="action-card-fields">
                  <ActionField label="Result">
                    {action.result === null ? (
                      <span className="muted">—</span>
                    ) : (
                      action.result
                    )}
                  </ActionField>
                  <ActionField label="Follow-up Required">
                    {action.followUpRequired ? "Yes" : "No"}
                  </ActionField>
                  {action.followUpRequired && action.followUpNote !== null && (
                    <ActionField label="Follow-up Note">{action.followUpNote}</ActionField>
                  )}
                  <ActionField label="Attachment Notes">
                    {action.attachmentNotes === null ? (
                      <span className="muted">—</span>
                    ) : (
                      action.attachmentNotes
                    )}
                  </ActionField>
                  <ActionField label="Performed by">{action.performedBy.name}</ActionField>
                  <ActionField label="Assignee">
                    {action.assignee === null ? (
                      <span className="muted">Unassigned</span>
                    ) : (
                      action.assignee.name
                    )}
                  </ActionField>
                  <ActionField label="Last Updated">{formatUtcDate(action.updatedAt)}</ActionField>
                </div>
<div className="action-card-footer"><button type="button" className="secondary-button" onClick={() => onOpen(action)}>{action.status === "PENDING" ? "Edit Action" : "View Action"}</button></div></div>; }
