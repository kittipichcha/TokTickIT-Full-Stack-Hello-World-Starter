import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentThread from "../CommentThread";
import type { CommentItem } from "../api";

const comments: CommentItem[] = [];

describe("CommentThread validation and accessibility", () => {
  afterEach(() => cleanup());

  it("renders hostile comment content as literal text", () => {
    const payload = '<img src=x onerror="window.__reviewProbe=true"><script>alert(1)</script><b>bold</b>';
    render(
      <CommentThread
        comments={[{ id: 1, content: payload, authorId: 5, createdAt: "2026-09-10T00:00:00Z" }]}
        onPost={vi.fn()}
      />,
    );

    expect(screen.getByText(payload)).toBeTruthy();
    expect(document.querySelector("img, script, b")).toBeNull();
  });

  it("associates a posting error with the textarea and removes the reference after success", async () => {
    const onPost = vi.fn().mockRejectedValueOnce(new Error("Could not post"));
    render(<CommentThread comments={comments} onPost={onPost} />);
    const input = screen.getByLabelText("Add a comment");

    await userEvent.type(input, "A comment");
    await userEvent.click(screen.getByRole("button", { name: /Post Comment/i }));
    const error = await screen.findByRole("alert");
    expect(error.id).toBe("comment-input-error");
    expect(input.getAttribute("aria-describedby")).toBe("comment-input-error");

    onPost.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole("button", { name: /Post Comment/i }));
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("accepts 2,000 trimmed characters surrounded by whitespace", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread comments={comments} onPost={onPost} />);
    const input = screen.getByLabelText("Add a comment");
    const content = `  ${"x".repeat(2000)}  `;

    fireEvent.change(input, { target: { value: content } });
    expect((input as HTMLTextAreaElement).value).toBe(content);
    await userEvent.click(screen.getByRole("button", { name: /Post Comment/i }));
    expect(onPost).toHaveBeenCalledWith("x".repeat(2000));
  });

  it.each(["", "   ", "x".repeat(2001)])("rejects invalid trimmed length: %s", async (content) => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread comments={comments} onPost={onPost} />);
    const input = screen.getByLabelText("Add a comment");

    fireEvent.change(input, { target: { value: content } });
    expect((screen.getByRole("button", { name: /Post Comment/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(onPost).not.toHaveBeenCalled();
  });
});
