/**
 * Shared Public Comment thread (Issue #38).
 *
 * Used by both the Requester Ticket Detail and the Staff Ticket Detail. Content
 * is rendered as plain JSX text children — React escapes it, so no
 * `dangerouslySetInnerHTML` and no sanitizer library are needed (BR-24).
 *
 * The compose box disables submit while pending or invalid, shows a length
 * counter, and preserves the entered text on API failure (BR-33).
 */

import { useState } from "react";
import type { CommentItem } from "./api";
import { formatUtcDate } from "./format";

export const MAX_COMMENT_LENGTH = 2000;

interface CommentThreadProps {
  comments: CommentItem[];
  /** Posts a comment; rejects with an Error on failure. */
  onPost: (content: string) => Promise<void>;
  /** Optional heading override. */
  title?: string;
  /** Optional empty-state message. */
  emptyMessage?: string;
}

export default function CommentThread({
  comments,
  onPost,
  title = "Public Comments",
  emptyMessage = "No comments yet.",
}: CommentThreadProps) {
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
      // Only clear the box after a confirmed success (BR-33).
      setContent("");
    } catch (err) {
      // Preserve the entered text on failure (BR-33).
      setError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="comment-thread" aria-label={title}>
      <h2>{title}</h2>

      {comments.length === 0 ? (
        <p className="comment-empty">{emptyMessage}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <div className="comment-meta">
                <span className="comment-author">User #{comment.authorId}</span>
                <span className="comment-date">{formatUtcDate(comment.createdAt)}</span>
              </div>
              <p className="comment-content">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <label htmlFor="comment-input" className="comment-label">
          Add a comment
        </label>
        <textarea
          id="comment-input"
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
            {isSubmitting ? "Posting…" : "Post Comment"}
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