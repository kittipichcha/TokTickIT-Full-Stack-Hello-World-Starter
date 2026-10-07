import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import StaffTicketQueue from "../StaffTicketQueue";
import { fetchMyTickets, fetchStaffQueue } from "../api";
import { TEST_USER, TEST_STAFF_USER } from "../lab-02-tests/helpers/user";
import { requesterDashboard, staffDashboard, windowStart } from "./dashboard-fixtures";
const calls: URL[]=[];
const list = {data:[],pagination:{page:1,pageSize:10,totalItems:0,totalPages:0,unfilteredTotalItems:1}};
const originalFetch=async(input: RequestInfo | URL, options?:RequestInit)=> {
 const url=new URL(String(input));calls.push(url);expect(options?.credentials).toBe("include");
 let body: unknown=list;
 if(url.pathname==="/api/requester/dashboard")body={data:requesterDashboard};
 if(url.pathname==="/api/staff/dashboard")body={data:staffDashboard};
 if(url.pathname==="/api/categories")body=[];
 if(url.pathname==="/api/staff/owners")body={data:[]};
 return new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}});
};
const fetchMock=vi.fn(originalFetch);
beforeEach(()=>{calls.length=0;fetchMock.mockReset().mockImplementation(originalFetch);vi.stubGlobal("fetch",fetchMock);});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function latest(path:string){return calls.filter(u=>u.pathname===path).at(-1)!;}
describe("UI-DASH-01 role navigation and credentialed real list transport",()=> {
 it.each([TEST_USER,TEST_STAFF_USER,{...TEST_STAFF_USER,role:"ADMINISTRATOR" as const}])("lands $role on its dashboard and preserves exact ordered role navigation",async user=>{render(<App user={user}/>);const staff=user.role!=="REQUESTER";await screen.findByRole("heading",{name:staff?"Staff Dashboard":"Requester Dashboard"});const nav=screen.getByRole("navigation",{name:"Primary"});const names=within(nav).getAllByRole("link").map(e=>e.textContent);expect(names).toEqual(staff?user.role==="ADMINISTRATOR"?["Dashboard","Ticket Queue","User Management"]:["Dashboard","Ticket Queue"]:["Dashboard","My Tickets","Create Ticket"]);expect(within(nav).getByRole("link",{name:"Dashboard"}).getAttribute("aria-current")).toBe("page");expect(calls.filter(u=>u.pathname===(staff?"/api/tickets":"/api/staff/queue"))).toHaveLength(0);});
 it("applies all requester dashboard predicates before the first read, clears them, and re-enters cleanly",async()=>{render(<App user={TEST_USER}/>);for(const [label,query] of [["Open Tickets: 21",{scope:"open"}],["Waiting for Requester: 0",{status:"WAITING_FOR_REQUESTER"}],["Recently Updated: 17",{updatedSince:windowStart}],["Recently Resolved: 2",{status:"RESOLVED",resolvedSince:windowStart}]] as const){await userEvent.click(await screen.findByRole("button",{name:label}));await waitFor(()=>expect(latest("/api/tickets")).toBeTruthy());const url=latest("/api/tickets");expect(url.searchParams.get("page")).toBe("1");for(const [key,value] of Object.entries(query))expect(url.searchParams.get(key)).toBe(value);expect(screen.getByRole("link",{name:"My Tickets"}).getAttribute("aria-current")).toBe("page");await userEvent.click(screen.getByRole("link",{name:"Dashboard"}));}await userEvent.click(await screen.findByRole("button",{name:"Open Tickets: 21"}));await userEvent.click((await screen.findAllByRole("button",{name:"Clear Filters"}))[0]);await waitFor(()=>expect(latest("/api/tickets").searchParams.has("scope")).toBe(false));await userEvent.click(screen.getByRole("link",{name:"My Tickets"}));await waitFor(()=>expect(latest("/api/tickets").searchParams.has("scope")).toBe(false));});
 it("applies Queue owner/urgent/recent predicates before first read and plain navigation resets",async()=>{render(<App user={TEST_STAFF_USER}/>);for(const [label,query] of [["Unassigned: 23",{ownerScope:"unassigned"}],["My Tickets: 12",{ownerScope:"me"}],["Urgent: 3",{priority:"HIGH",openOnly:"true"}],["Recently Updated: 12",{updatedSince:windowStart}]] as const){calls.length=0;await userEvent.click(await screen.findByRole("button",{name:label}));await waitFor(()=>expect(latest("/api/staff/queue")).toBeTruthy());const entries=calls.filter(u=>u.pathname==="/api/staff/queue");for(const url of entries){expect(url.searchParams.get("page")).toBe("1");for(const [key,value] of Object.entries(query))expect(url.searchParams.get(key)).toBe(value);}await userEvent.click(screen.getByRole("link",{name:"Dashboard"}));}await userEvent.click(await screen.findByRole("button",{name:"My Tickets: 12"}));await userEvent.click((await screen.findAllByRole("button",{name:"Clear Filters"}))[0]);await waitFor(()=>expect(latest("/api/staff/queue").searchParams.has("ownerScope")).toBe(false));});
 it("mobile menu exposes expanded state and closes after navigation",async()=>{render(<App user={TEST_USER}/>);await userEvent.click(screen.getByLabelText("Open navigation menu"));expect(screen.getByLabelText("Close navigation menu").getAttribute("aria-expanded")).toBe("true");await userEvent.click(screen.getByRole("link",{name:"My Tickets"}));expect(screen.getByLabelText("Open navigation menu").getAttribute("aria-expanded")).toBe("false");});

 it("retains dashboard scope through page 2 and resets same list re-entry to page 1",async()=>{
 fetchMock.mockImplementation(async(input,options)=>{const url=new URL(String(input));if(url.pathname!=="/api/tickets")return originalFetch(input,options);calls.push(url);const page=Number(url.searchParams.get("page"));return new Response(JSON.stringify({data:[{id:page,ticketNumber:`TKT-${page}`,summary:`Page ${page}`,categoryId:1,categoryName:"Hardware",requestedPriority:"MEDIUM",itPriority:null,currentStatus:"OPEN",createdAt:windowStart,updatedAt:windowStart}],pagination:{page,pageSize:10,totalItems:21,totalPages:3,unfilteredTotalItems:21}}),{status:200,headers:{"Content-Type":"application/json"}});});
 render(<App user={TEST_USER}/>);await userEvent.click(await screen.findByRole("button",{name:"Open Tickets: 21"}));await screen.findAllByText("Page 1");await userEvent.click(screen.getByRole("button",{name:/Next/i}));await waitFor(()=>expect(latest("/api/tickets").searchParams.get("page")).toBe("2"));expect(latest("/api/tickets").searchParams.get("scope")).toBe("open");await userEvent.click(screen.getByRole("link",{name:"My Tickets"}));await waitFor(()=>expect(latest("/api/tickets").searchParams.get("page")).toBe("1"));expect(latest("/api/tickets").searchParams.has("scope")).toBe(false);
 });
 it("serializes explicit Queue false and retains exact UTC timestamp",async()=>{await fetchStaffQueue({openOnly:false,updatedSince:windowStart});expect(latest("/api/staff/queue").searchParams.get("openOnly")).toBe("false");await fetchMyTickets({resolvedSince:windowStart,status:"RESOLVED"});expect(latest("/api/tickets").searchParams.get("resolvedSince")).toBe(windowStart);});
 it("shows readable dashboard filters with local dates and clears the notice",async()=>{
  render(<App user={TEST_USER}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Open Tickets: 21"}));
  expect(screen.getByLabelText("Active dashboard filters").textContent).toContain("Open Tickets");
  expect(screen.queryByText(/scope:|updatedSince|resolvedSince/)).toBeNull();
  await userEvent.click(screen.getAllByRole("button",{name:"Clear Filters"})[0]);
  await waitFor(()=>expect(screen.queryByLabelText("Active dashboard filters")).toBeNull());
  await userEvent.click(screen.getByRole("link",{name:"Dashboard"}));
  await userEvent.click(await screen.findByRole("button",{name:/Recently Resolved/}));
  const requesterNotice=screen.getByLabelText("Active dashboard filters").textContent ?? "";
  expect(requesterNotice).toContain(`Resolved since: ${new Date(windowStart).toLocaleString()} (local time)`);
  expect(requesterNotice).not.toMatch(/resolvedSince|status:/);
 });
 it("labels the real urgent dashboard string filter",async()=>{
  render(<App user={TEST_STAFF_USER}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Urgent: 3"}));
  expect(screen.getByLabelText("Active dashboard filters").textContent).toContain("Open Tickets only");
  expect(latest("/api/staff/queue").searchParams.get("openOnly")).toBe("true");
 });
 it("labels staff filters and distinguishes explicit false from no filter",async()=>{
  render(<App user={TEST_STAFF_USER}/>);
  await userEvent.click(await screen.findByRole("button",{name:"My Tickets: 12"}));
  const notice=screen.getByLabelText("Active dashboard filters").textContent ?? "";
  expect(notice).toContain("Assigned to me");
  expect(notice).not.toContain("ownerScope");
  cleanup();
  render(<StaffTicketQueue initialFilters={{openOnly:false,updatedSince:windowStart}} onOpenDetail={vi.fn()}/>);
  const falseNotice=screen.getByLabelText("Active dashboard filters").textContent ?? "";
  expect(falseNotice).toContain("All Ticket statuses");
  expect(falseNotice).toContain(`Updated since: ${new Date(windowStart).toLocaleString()} (local time)`);
  expect(falseNotice).not.toMatch(/openOnly|updatedSince/);
  await userEvent.click(screen.getAllByRole("button",{name:"Clear Filters"})[0]);
  await waitFor(()=>expect(screen.queryByLabelText("Active dashboard filters")).toBeNull());
 });
});

