import appCss from "../App.css?raw";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDashboard from "../RequesterDashboard";
import * as dashboard from "../dashboard-api";
import { requesterDashboard } from "./dashboard-fixtures";
vi.mock("../dashboard-api");
afterEach(cleanup);
beforeEach(()=> {vi.clearAllMocks();vi.mocked(dashboard.fetchRequesterDashboard).mockResolvedValue(requesterDashboard);});
function mount() {const onOpenTickets=vi.fn(),onOpenTicket=vi.fn(),onCreateTicket=vi.fn();render(<RequesterDashboard {...{onOpenTickets,onOpenTicket,onCreateTicket}}/>);return {onOpenTickets,onOpenTicket,onCreateTicket};}
describe("UI-DASH-01 Requester",()=> {
 it("shows server counts independently of summary size and all exact drill-downs",async()=> {const props=mount();for(const [key,label] of [["openTickets","Open Tickets"],["waitingForRequester","Waiting for Requester"],["recentlyUpdated","Recently Updated"],["recentlyResolved","Recently Resolved"]] as const){await userEvent.click(await screen.findByRole("button",{name:`${label}: ${requesterDashboard.counts[key]}`}));expect(props.onOpenTickets).toHaveBeenLastCalledWith(requesterDashboard.drillDowns[key]);}await userEvent.click(screen.getByRole("link",{name:/TKT-1/}));expect(props.onOpenTicket).toHaveBeenCalledWith("TKT-1");expect(screen.getByText(/last seven days/)).toBeTruthy();for(const card of screen.getAllByRole("button").filter(card=>card.classList.contains("dashboard-metric"))){if(card.querySelector("strong")?.textContent === "0") expect(within(card).getByText("No matching Tickets")).toBeTruthy();else expect(within(card).queryByText("No matching Tickets")).toBeNull();}});
 it("keeps loading frame and renders zero/empty without failure",async()=> {vi.mocked(dashboard.fetchRequesterDashboard).mockResolvedValue({...requesterDashboard,counts:{openTickets:0,waitingForRequester:0,recentlyUpdated:0,recentlyResolved:0},lists:{attentionTickets:[],recentTickets:[]}});const props=mount();expect(screen.getByRole("status").textContent).toContain("Loading");await userEvent.click(await screen.findByRole("button",{name:"Create Ticket"}));expect(props.onCreateTicket).toHaveBeenCalled();for(const label of ["Open Tickets","Waiting for Requester","Recently Updated","Recently Resolved"]){const card=screen.getByRole("button",{name:`${label}: 0`});expect(within(card).getByText("No matching Tickets")).toBeTruthy();expect(within(card).getByText("0")).toBeTruthy();}expect(screen.queryByRole("alert")).toBeNull();});
 it.each([403,401])("shows safe %s guidance without Retry",async(status)=>{vi.mocked(dashboard.fetchRequesterDashboard).mockRejectedValue({status});mount();expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByRole("button",{name:"Retry"})).toBeNull();});
 it("retries only a read after network failure",async()=> {vi.mocked(dashboard.fetchRequesterDashboard).mockRejectedValueOnce(new Error("secret failure")).mockResolvedValue(requesterDashboard);mount();await userEvent.click(await screen.findByRole("button",{name:"Retry"}));await screen.findByRole("button",{name:"Open Tickets: 21"});expect(dashboard.fetchRequesterDashboard).toHaveBeenCalledTimes(2);expect(screen.queryByText("secret failure")).toBeNull();});
 it("ignores a read completed after unmount",async()=> {let resolve!: (value:dashboard.RequesterDashboardData)=>void;vi.mocked(dashboard.fetchRequesterDashboard).mockReturnValue(new Promise(r=>resolve=r));const {unmount}=render(<RequesterDashboard onOpenTickets={vi.fn()} onOpenTicket={vi.fn()} onCreateTicket={vi.fn()}/>);unmount();await act(async()=>resolve(requesterDashboard));expect(screen.queryByText("Own Ticket")).toBeNull();});
});
 it("UI-STYLE-01: uses Zen Green tokens with visible named controls and status cues", async()=>{
  mount(); await screen.findByRole("button",{name: /^(Open Tickets|Unassigned):/});
  const styles = appCss.slice(appCss.indexOf("/* Issue #54 role dashboards"));
  expect(styles).toContain("var(--color-surface)");
  expect(styles).toContain("var(--color-text)");
  expect(styles).toContain("var(--color-primary)");
  expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(/i);
  for (const control of [...screen.getAllByRole("button"), ...screen.queryAllByRole("link")]) {
    expect(control.textContent?.trim()).toBeTruthy();
    expect(control.querySelector("svg[aria-label]")).toBeNull();
  }
 });