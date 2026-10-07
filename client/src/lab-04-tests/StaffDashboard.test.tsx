import appCss from "../App.css?raw";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffDashboard from "../StaffDashboard";
import * as dashboard from "../dashboard-api";
import { staffDashboard } from "./dashboard-fixtures";
vi.mock("../dashboard-api");
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();vi.mocked(dashboard.fetchStaffDashboard).mockResolvedValue(staffDashboard);});
function mount(){const onOpenQueue=vi.fn(),onOpenTicket=vi.fn(),onOpenAction=vi.fn();render(<StaffDashboard {...{onOpenQueue,onOpenTicket,onOpenAction}}/>);return {onOpenQueue,onOpenTicket,onOpenAction};}
describe("UI-DASH-01 Staff",()=> {
 it("shows exact numbers, every enum card and count-only Action metrics",async()=>{const props=mount();await screen.findByRole("button",{name:"Unassigned: 23"});for(const [key,label] of [["unassignedTickets","Unassigned"],["myTickets","My Tickets"],["recentlyUpdatedTickets","Recently Updated"],["urgentTickets","Urgent"]] as const){await userEvent.click(screen.getByRole("button",{name:`${label}: ${staffDashboard.counts[key]}`}));expect(props.onOpenQueue).toHaveBeenLastCalledWith(staffDashboard.drillDowns[key]);}for(const status of Object.keys(staffDashboard.counts.byStatus)){await userEvent.click(screen.getByRole("button",{name:`Status: ${status.replaceAll("_"," ")}: 0`}));expect(props.onOpenQueue).toHaveBeenLastCalledWith(staffDashboard.drillDowns.byStatus[status as keyof typeof staffDashboard.counts.byStatus]);}for(const priority of ["LOW","MEDIUM","HIGH"] as const){await userEvent.click(screen.getByRole("button",{name:`IT Priority: ${priority}: ${staffDashboard.counts.byPriority[priority]}`}));expect(props.onOpenQueue).toHaveBeenLastCalledWith(staffDashboard.drillDowns.byPriority[priority]);}expect(screen.queryByRole("button",{name:/My Pending Assigned Actions/})).toBeNull();expect(screen.queryByRole("link",{name:/My Recently Performed Actions/})).toBeNull();await userEvent.click(screen.getByRole("link",{name:"Action 21 on TKT-1: Action twenty one"}));expect(props.onOpenAction).toHaveBeenCalledWith("TKT-1",21);expect(screen.getAllByText(/No matching/).length).toBe(5);});
 it("renders successful zero metrics and empty Action guidance",async()=>{vi.mocked(dashboard.fetchStaffDashboard).mockResolvedValue({...staffDashboard,counts:{...staffDashboard.counts,unassignedTickets:0,myTickets:0,myPendingAssignedActions:0,myRecentlyPerformedActions:0,recentlyUpdatedTickets:0,urgentTickets:0},lists:{...staffDashboard.lists,pendingActions:[]}});mount();expect(await screen.findByRole("button",{name:"Unassigned: 0"})).toBeTruthy();expect(screen.queryByRole("link",{name:/Action 21/})).toBeNull();expect(screen.queryByRole("alert")).toBeNull();expect(screen.getAllByText(/Individual Actions appear here/)).toHaveLength(2);});
 it.each([403,401])("shows %s without Retry",async(status)=>{vi.mocked(dashboard.fetchStaffDashboard).mockRejectedValue({status});mount();await screen.findByRole("alert");expect(screen.queryByRole("button",{name:"Retry"})).toBeNull();});
 it("offers safe read Retry",async()=>{vi.mocked(dashboard.fetchStaffDashboard).mockRejectedValueOnce({status:500}).mockResolvedValue(staffDashboard);mount();await userEvent.click(await screen.findByRole("button",{name:"Retry"}));await screen.findByRole("button",{name:"Unassigned: 23"});expect(dashboard.fetchStaffDashboard).toHaveBeenCalledTimes(2);});
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