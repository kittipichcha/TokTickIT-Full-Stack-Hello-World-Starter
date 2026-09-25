# A11Y-01 intermittent status-dialog activation

## Reproduction and fail path

The first Lab 3-only structured run passed 27/27. A subsequent full 183-case rerun failed the status-dialog case on desktop and tablet. The Playwright DOM snapshot showed the ticket at `IN_PROGRESS`, owned by the logged-in Staff user, with an enabled `Resolved` transition; the expected dialog did not appear after Enter. A focused repeat without synchronization failed 1/5 desktop runs and passed 5/5 tablet runs.

Debugger attach was not available in this headless Playwright CLI run. Source trace shows the native transition button calls `handleTransitionClick`, which sets `pendingTransition` for `RESOLVED`; the modal is rendered from that state. The test had focused the button and immediately sent Enter, without asserting it was enabled or still focused.

## Ranked hypotheses and disproof

1. **Test acted before the target button was enabled/focused.** Added `toBeEnabled()` and `toBeFocused()` preconditions immediately before Enter. The same desktop trigger then passed 10/10 repeats, supporting this synchronization diagnosis.
2. **Application modal handler failed for native Enter activation.** The native button's `onClick` is the only activation path and the guarded keyboard run passed 10/10; no application defect was reproduced.
3. **Ticket role/status/ownership was wrong.** The failure snapshot showed `IN_PROGRESS`, current Staff owner, and the Resolved button present; this is falsified.
4. **Modal existed but its accessible name/role was wrong.** The failure snapshot contained no dialog at all; this is falsified.

## Experiment ledger

| Run | Change | Outcome | Conclusion |
|---|---|---|---|
| Lab 3-only suite | Initial journey run | 27/27 passed | Does not expose the intermittent path. |
| Full integrated run 2 | No test guard | A11Y-01 failed desktop + tablet; other 181 tests passed | Flake can arise in the full suite. |
| Focused repeats | Five each desktop/tablet, no new guard | 1/5 desktop failed; 5/5 tablet passed | Intermittent, low-frequency repro. |
| Focused desktop repeats | Assert target enabled and focused before Enter | 10/10 passed | Test now waits on the actual keyboard target state. |
| Lab 3-only suite | With the guard | See `lab3-playwright.json` | Final three-viewport E2E status. |

No Staff Ticket Detail application code was changed for this issue. The full 183-case suite still needs one clean run before the Lab 2 regression gate can pass.
