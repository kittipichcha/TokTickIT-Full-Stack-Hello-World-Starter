/**
 * Internal Note thread (Issue #38) — Staff/Admin only.
 *
 * Same shape as `CommentThread` but visually distinct. This component must
 * NEVER be imported into the Requester view (defense in depth): the server
 * enforces the role gate, and the Requester payload never contains notes.
 */

import { useState } from "react";
import type { CommentItem } from "./api";
import { formatUtcDate } from "./format";
import { MAX_COMMENT_LENGTH } from "./CommentThread";

interface InternalNoteThreadProps {
  notes: CommentItem[];
  /** Posts a note; rejects with an Error on failure. */
  onPost: (content: string) => Promise<void>;
}

export default function InternalNoteThread({ notes, onPost }: InternalNoteThreadProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onPost(trimmed);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="note-thread" aria-label="Internal Notes">
      <h2>Internal Notes</h2>
      <p className="note-visibility-hint">Visible to IT Staff and Administrators only.</p>

      {notes.length === 0 ? (
        <p className="comment-empty">No internal notes yet.</p>
      ) : (
        <ul className="comment-list">
          {notes.map((note) => (
            <li key={note.id} className="note-item">
              <div className="comment-meta">
                <span className="comment-author">User #{note.authorId}</span>
                <span className="comment-date">{formatUtcDate(note.createdAt)}</span>
              </div>
              <p className="comment-content">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <label htmlFor="note-input" className="comment-label">
          Add an internal note
        </label>
        <textarea
          id="note-input"
          className="comment-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          aria-invalid={content.length > 0 && !isValid}
        />
        <div className="comment-form-footer">
          <span className="comment-counter" aria-live="polite">
            {trimmed.length}/{MAX_COMMENT_LENGTH}
          </span>
          <button type="submit" className="primary-button" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Posting…" : "Post Note"}
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}