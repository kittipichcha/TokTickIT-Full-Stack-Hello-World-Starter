import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InternalNoteThread from "../InternalNoteThread";
import type { CommentItem } from "../api";

const notes: CommentItem[] = [];

describe("InternalNoteThread validation and accessibility", () => {
  afterEach(() => cleanup());

  it("associates a posting error with the textarea and removes the reference after success", async () => {
    const onPost = vi.fn().mockRejectedValueOnce(new Error("Could not post"));
    render(<InternalNoteThread notes={notes} onPost={onPost} />);
    const input = screen.getByLabelText("Add an internal note");

    await userEvent.type(input, "A note");
    await userEvent.click(screen.getByRole("button", { name: /Post Note/i }));
    const error = await screen.findByRole("alert");
    expect(error.id).toBe("note-input-error");
    expect(input.getAttribute("aria-describedby")).toBe("note-input-error");

    onPost.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole("button", { name: /Post Note/i }));
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("accepts 2,000 trimmed characters surrounded by whitespace", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<InternalNoteThread notes={notes} onPost={onPost} />);
    const input = screen.getByLabelText("Add an internal note");
    const content = `  ${"x".repeat(2000)}  `;

    fireEvent.change(input, { target: { value: content } });
    expect((input as HTMLTextAreaElement).value).toBe(content);
    await userEvent.click(screen.getByRole("button", { name: /Post Note/i }));
    expect(onPost).toHaveBeenCalledWith("x".repeat(2000));
  });

  it.each(["", "   ", "x".repeat(2001)])("rejects invalid trimmed length: %s", async (content) => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<InternalNoteThread notes={notes} onPost={onPost} />);
    const input = screen.getByLabelText("Add an internal note");

    fireEvent.change(input, { target: { value: content } });
    expect((screen.getByRole("button", { name: /Post Note/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(onPost).not.toHaveBeenCalled();
  });
});
