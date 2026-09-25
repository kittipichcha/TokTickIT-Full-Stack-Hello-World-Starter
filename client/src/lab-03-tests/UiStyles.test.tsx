import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Login from "../Login";
import ChangePassword from "../ChangePassword";
import appCss from "../App.css?raw";

afterEach(cleanup);

describe("UI-STYLE-01: Lab 3 authentication screens follow the Zen Green system", () => {
  it("defines the frozen palette and semantic field states", () => {
    expect(appCss).toContain("--color-primary: #006B3C");
    expect(appCss).toContain("--color-secondary: #0B7A46");
    expect(appCss).toContain("--color-error: #B3261E");
    expect(appCss).toContain("--color-success: #0B7A46");
    expect(appCss).toContain("--color-field-readonly-bg");
  });

  it("labels the login fields and uses the primary action style", () => {
    render(<Login onLogin={() => undefined} />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /login/i }).className).toContain("primary-button");
  });

  it("labels the mandatory password-change fields and action", () => {
    render(<ChangePassword onChanged={() => undefined} />);
    expect(screen.getByLabelText(/current password/i)).toBeTruthy();
    expect(screen.getByLabelText(/^new password/i)).toBeTruthy();
    expect(screen.getByLabelText(/^confirm new password/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /change password/i }).className).toContain("primary-button");
  });

  it("keeps keyboard focus visible with the secondary palette", () => {
    expect(appCss).toMatch(/focus-visible[^\{]*\{[^}]*outline: 2px solid var\(--color-secondary\)/s);
  });
});
