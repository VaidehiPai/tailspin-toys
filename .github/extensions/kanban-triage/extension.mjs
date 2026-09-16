import { createServer } from "node:http";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const servers = new Map();
const issues = [
    { number: 6, title: "Implement pagination on the game list page", description: "Add pagination to the game list and cover the data helper, accessible controls, unit tests, and end-to-end behavior.", reason: "The catalog will become harder to browse as it grows, and this improves performance and usability at the main entry point.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/6" },
    { number: 1, title: "Add a search box to find games by title", description: "Let visitors filter the game list by title with case-insensitive matching, an accessible input, and an empty state.", reason: "Search is a high-value discovery feature that directly reduces the effort required to find a known game.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/1" },
    { number: 2, title: "Allow users to sort the game list", description: "Add accessible title and star-rating sort options, including sensible ordering for games without ratings.", reason: "Sorting complements search and pagination, giving users control over the catalog before the list grows further.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/2" },
    { number: 3, title: "Show category and publisher descriptions on the game detail page", description: "Surface available category and publisher descriptions on game details without showing empty sections.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/3" },
    { number: 4, title: "Add a publisher page listing that publisher's games", description: "Create prerendered publisher pages that show publisher details and reuse the existing game card.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/4" },
    { number: 5, title: "Show a catalog summary on the home page", description: "Display total games and average star rating on the home page, including empty-data handling and test coverage.", url: "https://github.com/VaidehiPai/tailspin-toys/issues/5" },
];

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function issueCard(issue, featured) {
    const reason = featured ? `<p class="reason"><strong>Why it is here:</strong> ${escapeHtml(issue.reason)}</p>` : "";
    return `<article class="card${featured ? " featured" : ""}" data-testid="issue-card-${issue.number}">
      <div class="card-heading"><span class="issue-number">#${issue.number}</span><a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.title)}</a></div>
      <p>${escapeHtml(issue.description)}</p>${reason}
      <button type="button" data-issue-number="${issue.number}" data-testid="add-issue-${issue.number}">Add to current context</button>
    </article>`;
}

function renderHtml() {
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Issue triage board</title>
<style>
:root{color-scheme:light dark}body{margin:0;padding:24px;background:var(--background-color-default,#fff);color:var(--text-color-default,#1f2328);font:14px/1.5 var(--font-sans,system-ui,sans-serif)}main{max-width:900px;margin:0 auto}h1{margin:0 0 4px;font-size:24px}h2{margin:28px 0 12px;font-size:17px}.subtitle{margin-top:0;color:var(--text-color-muted,#656d76)}.board{display:grid;gap:12px}.card{border:1px solid var(--border-color-default,#d0d7de);border-radius:10px;padding:16px;background:var(--background-color-muted,rgba(127,127,127,.08))}.featured{border-color:var(--true-color-blue,#0969da);box-shadow:0 0 0 1px var(--true-color-blue,#0969da)}.card-heading{display:flex;gap:9px;align-items:baseline}.card-heading a{color:var(--text-color-default,#1f2328);font-weight:600}.issue-number{color:var(--text-color-muted,#656d76);font-family:var(--font-mono,monospace)}p{margin:8px 0}.reason{color:var(--text-color-muted,#656d76)}button{border:1px solid var(--border-color-default,#d0d7de);border-radius:6px;padding:7px 11px;background:var(--true-color-blue,#0969da);color:var(--color-white,#fff);cursor:pointer;font:inherit}button:focus-visible,a:focus-visible{outline:2px solid var(--color-focus-outline,#0969da);outline-offset:2px}button[disabled]{opacity:.65;cursor:wait}#status{min-height:22px;margin-top:16px;color:var(--text-color-muted,#656d76)}
</style></head>
<body><main><h1>Issue triage board</h1><p class="subtitle">Six open issues, ranked by immediate user impact and dependency value.</p>
<h2>Needs attention now</h2><section class="board" aria-label="Top three issues">${issues.slice(0, 3).map((issue) => issueCard(issue, true)).join("")}</section>
<h2>Also open</h2><section class="board" aria-label="Remaining issues">${issues.slice(3).map((issue) => issueCard(issue, false)).join("")}</section>
<p id="status" role="status" aria-live="polite"></p></main>
<script>
const status=document.querySelector("#status");
document.querySelectorAll("button[data-issue-number]").forEach((button)=>button.addEventListener("click",async()=>{
  button.disabled=true; status.textContent="Adding issue to the current session...";
  try{const response=await fetch("/add-context",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({number:Number(button.dataset.issueNumber)})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to add issue");status.textContent=result.message;}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
}));
</script></body></html>`;
}

function issuePrompt(issue) {
    return `Work on GitHub issue #${issue.number}: ${issue.title}\n\n${issue.description}\n\nIssue URL: ${issue.url}`;
}

async function startServer(instanceId, session) {
    const server = createServer((req, res) => {
        if (req.method === "POST" && req.url === "/add-context") {
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", async () => {
                try {
                    const input = JSON.parse(body);
                    const issue = issues.find((candidate) => candidate.number === input.number);
                    if (!issue) {
                        res.writeHead(404, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Issue not found" }));
                        return;
                    }
                    await session.send({ prompt: issuePrompt(issue) });
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ message: `Issue #${issue.number} added to the current session.` }));
                } catch (error) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to add issue" }));
                }
            });
            return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderHtml());
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/`, instanceId };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "kanban-triage",
            displayName: "Issue triage board",
            description: "A ranked Kanban board for quickly triaging this repository's open GitHub issues.",
            actions: [{
                name: "add_issue_to_context",
                description: "Add an open issue from the board to the current session context.",
                inputSchema: {
                    type: "object",
                    properties: { number: { type: "integer", description: "GitHub issue number" } },
                    required: ["number"],
                    additionalProperties: false,
                },
                handler: async (ctx) => {
                    const issue = issues.find((candidate) => candidate.number === ctx.input.number);
                    if (!issue) throw new Error(`Issue #${ctx.input.number} is not on this board.`);
                    await session.send({ prompt: issuePrompt(issue) });
                    return { issueNumber: issue.number, message: `Issue #${issue.number} added to the current session.` };
                },
            }],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId, session);
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Issue triage board", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
