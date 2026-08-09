# Lab 1 — Peer Review Record  (fill this in)

**Author:** <Kittipich Charoenthanachot> — <67070503405> — GitHub: @kittipichcha
**Peer reviewer:** <SUTHANG SUKRUEANGKUN> — <67070503477> — GitHub: @oangsa


## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
|    | feature/1-project-foundation | Approved |
|    | feature/2-health-check | Approved |
|    | feature/3-category-seed | Approved |
|    | feature/4-category-list | Approved |

**Issue #1**
Reviewer comment I received: LGTM
How I responded: 

**Issue #2**
Reviewer comment I received: I don't see a blocking issue against the five criteria you supplied. LGTM!
How I responded: 

**Issue 3**
Reviewer comment I received: All five acceptance criteria are satisfied by the implementation.
How I responded: 

**Issue 4** 
Reviewer comment I received: Request changes: the category ordering does not fully satisfy the acceptance criteria.

The Prisma query currently orders only by id ASC, but the requirement explicitly says the API response must be in a predictable ascending order for both ID and name.

Please update the query to order by both fields, for example:

orderBy: [
  { id: "asc" },
  { name: "asc" },
]
Also update the Supertest coverage so it verifies the required ordering, not only the ID order.

All acceptance criteria must be completed before this PR can be approved.

How I responded: I've fixed the function according to the criteria and change the function 

Reviewer comment I recieved: Request changes: the Prisma ordering fix is now correct, but the test coverage still does not fully address the previous review.

The API now orders by both id ASC and name ASC, but the Supertest tests only verify ID ordering. Please update the backend test coverage to also verify the required name ordering.

Since all acceptance criteria and prior review comments must be completed before approval, this remains blocking.

How I responded: I've edited the test case according to the feedback and push again.

Reviewer comment I recieved : Request changes: the previous test-coverage issue is fixed, but the ordering logic and the test expectation are still inconsistent.

orderBy: [{ id: "asc" }, { name: "asc" }] guarantees ID ascending, with name only used as a tie-breaker. Since id is unique, this does not guarantee that the entire name column is also globally ascending.

However, the new tests independently assert that both IDs and names are globally sorted, which can fail for valid database data.

Please align the implementation and tests with the intended acceptance criterion—either sort primarily by name, sort primarily by ID, or test the actual compound id ASC, name ASC ordering correctly.

This remains blocking until the ordering behavior and test expectation match.

How I responded : I've fix the testcase and push it again.

Reviewer comment I recieved : Request changes: the ordering issue is fixed, but the latest frontend changes introduced a new acceptance-criteria regression.

The requirement explicitly asks for a dedicated React button to load categories. The current implementation replaces the previous category-loading button with a generic Check System button that runs the health check first and only then fetches categories.

Please restore a dedicated category-loading action/button and make sure the Vitest coverage verifies that behavior directly.

This remains blocking because all acceptance criteria must be satisfied before approval. 

How I response : I said accidentally alter the issue from its actual criteria, so please accept my request.  

## Pull Requests I reviewed for my partner
**Issue #1**
My comment: After I've checked the branch, it can work correctly but I will add a few note here.

There are vulnerability dependencies warning that you should take a look however it can run correctly.
It would be nice if you add how you have tested that the app can work perfectly in doc/tests.md, it would be nice.
Partner's response: >commit the updated document

**Issue #2**
My comment: LGTM. Everything can run correctly.
Partner's response: 

**Issue #3**
My comment: It can run correctly and no conflict & critical vulnerability, good job.
Partner's response: 

**Issue #4**
My comment: url should have not been deleted in here, I could not run npm run prisma:migrate. If this is intentional, you needt to tell me how to migrate and test the prisma connection
Partner's response: He has fixed it and push fixed code for me to check it.
