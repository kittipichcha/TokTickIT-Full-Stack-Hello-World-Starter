/**
 * Shared accessible modal dialog (Issue #41 review 48-B4 — ui-spec.md §8).
 *
 * `role="dialog"` + `aria-modal="true"` alone do NOT implement modal keyboard
 * behavior. This component supplies the behavior the Lab 3 accessibility
 * requirement actually demands:
 *
 *   - Opening: focus moves to the first focusable control inside the dialog.
 *   - Tab: from the last focusable control, wraps to the first.
 *   - Shift+Tab: from the first focusable control, wraps to the last.
 *   - Escape: closes the dialog without mutating anything.
 *   - Closing: focus returns to the control that invoked the dialog.
 *
 * The dialog is purely presentational — it never performs a mutation itself.
 * Only the caller's explicit submit action may mutate data.
 *
 * Shared by `AdminUserManagement` (Create / Edit / Reset Password) and available
 * to #49's Staff Ticket Detail confirm dialog so the repository has exactly one
 * focus-trap implementation rather than several subtly different ones.
 */

import { useEffect, useRef, type ReactNode } from "react";

/** The focusable-control selector used for the initial focus and the Tab trap. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  /** Id of the element that names the dialog (`aria-labelledby` target). */
  labelledBy: string;
  /** Requests close (Escape). The caller decides what closing means. */
  onClose: () => void;
  /**
   * When true, Escape is ignored — used while a mutation is in flight so the
   * dialog cannot be dismissed mid-request.
   */
  busy?: boolean;
  children: ReactNode;
}

export default function Modal({ labelledBy, onClose, busy = false, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Opening: remember the invoking control, then move focus into the dialog.
  // Closing (unmount): restore focus to the invoking control.
  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog) {
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) {
        first.focus();
      } else {
        dialog.focus();
      }
    }

    return () => {
      lastFocusedRef.current?.focus?.();
      lastFocusedRef.current = null;
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      if (busy) return;
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && dialog.contains(active);

    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
