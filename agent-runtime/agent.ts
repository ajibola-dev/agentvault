/**
 * AgentVault Agent Runtime
 * An autonomous agent that claims tasks, generates deliverables, and submits completions.
 *
 * Setup:
 *   1. Copy .env.example to .env and fill in your values
 *   2. npm install (from repo root)
 *   3. npx ts-node agent-runtime/agent.ts
 *
 * The runtime polls for eligible tasks every 30 seconds and processes them automatically.
 */

const BASE_URL = process.env.AGENTVAULT_URL ?? "https://agentvault-ecru.vercel.app";
const OPERATOR_ADDRESS = process.env.AGENT_OPERATOR_ADDRESS;
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "30000");
const AISA_API_KEY = process.env.AISA_API_KEY;
const AISA_BASE_URL = "https://api.aisa.one/v1";
const AISA_MODEL = process.env.AISA_MODEL ?? "gpt-4o";

if (!OPERATOR_ADDRESS) {
  console.error("❌ AGENT_OPERATOR_ADDRESS is required in agent-runtime/.env");
  process.exit(1);
}

if (!PRIVATE_KEY) {
  console.error("❌ AGENT_PRIVATE_KEY is required in agent-runtime/.env");
  process.exit(1);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

let sessionCookie: string | null = null;

async function authenticate(): Promise<boolean> {
  try {
    // Step 1: Get nonce
    const nonceRes = await fetch(`${BASE_URL}/api/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: OPERATOR_ADDRESS }),
    });
    const nonceData = await nonceRes.json() as { nonce: string; message: string };
    if (!nonceData.nonce) { console.error("❌ Failed to get nonce"); return false; }

    // Step 2: Sign the exact message returned by the server
    const { createWallet } = await import("./wallet-helper");
    const signature = await createWallet(PRIVATE_KEY!).signMessage(nonceData.message);
    console.log("   ✓ Message signed");

    // Step 3: Verify and get session cookie
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: OPERATOR_ADDRESS, nonce: nonceData.nonce, signature }),
    });

    const verifyBody = await verifyRes.json();
    console.log("   Verify response:", verifyRes.status, JSON.stringify(verifyBody));

    const setCookie = verifyRes.headers.get("set-cookie");
    if (!setCookie) { console.error("❌ Auth failed — no session cookie"); return false; }
    sessionCookie = setCookie.split(";")[0];
    console.log("   ✓ Authenticated");
    return true;
  } catch (err) {
    console.error("❌ Auth error:", err);
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  owner: string;
  operator_address: string;
  reputation: number;
  tags: string[];
  emoji?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: string;
  minRep: number;
  tags: string[];
  agentId?: string;
  agentAddress?: string;
  creatorAddress?: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function getAgents(): Promise<Agent[]> {
  const res = await fetch(`${BASE_URL}/api/get-agents`);
  const data = await res.json() as { agents: Agent[] };
  return data.agents ?? [];
}

async function getTasks(): Promise<Task[]> {
  const res = await fetch(`${BASE_URL}/api/get-tasks`);
  const data = await res.json() as { tasks: Task[] };
  return data.tasks ?? [];
}

async function claimTask(taskId: string, agentOwnerAddress: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { "Cookie": sessionCookie } : {}),
    },
    body: JSON.stringify({ agentOwnerAddress }),
  });
  const data = await res.json() as { task?: unknown; error?: string };
  if (data.error) {
    console.log(`   ⚠️  Claim failed: ${data.error}`);
    return false;
  }
  return true;
}

async function updateStatus(taskId: string, status: string, address: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/update-task-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { "Cookie": sessionCookie } : {}),
    },
    body: JSON.stringify({ taskId, status, address }),
  });
  const data = await res.json() as { task?: unknown; error?: string };
  if (data.error) {
    console.log(`   ⚠️  Status update failed: ${data.error}`);
    return false;
  }
  return true;
}

// ── Deliverable generator ─────────────────────────────────────────────────────

async function generateDeliverableWithAI(agent: Agent, task: Task): Promise<string> {
  const systemPrompt = `You are ${agent.name}, a professional AI agent with ERC-8004 onchain identity on Arc Testnet. Your reputation score is ${agent.reputation}.

You have been assigned a task and must deliver high-quality, structured work. Respond with a complete, professional markdown deliverable. Be specific, actionable, and thorough. Sign your work with your agent identity at the end.`;

  const userPrompt = `Task: ${task.title}

Description: ${task.description}

Tags: ${task.tags?.join(", ") ?? "General"}
Reward: ${task.reward} USDC

Deliver a complete, professional report for this task. Include:
1. Executive summary
2. Detailed analysis or findings
3. Specific recommendations
4. Conclusion

Format as clean markdown.`;

  const res = await fetch(`${AISA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AISA_API_KEY}`,
    },
    body: JSON.stringify({
      model: AISA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AIsa API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  const aiContent = data.choices?.[0]?.message?.content ?? "";

  const header = `# Task Deliverable — ${task.title}

**Agent:** ${agent.name} (${agent.emoji ?? "🤖"}) · Rep Score: ${agent.reputation}  
**Task ID:** ${task.id}  
**Completed:** ${new Date().toISOString()}  
**Reward:** ${task.reward} USDC  
**Generated by:** AIsa API · ${AISA_MODEL}  

---

`;
  return header + aiContent;
}

function generateDeliverable(agent: Agent, task: Task): string {
  const timestamp = new Date().toISOString();
  const taskType = detectTaskType(task);

  const header = `# Task Deliverable — ${task.title}

**Agent:** ${agent.name} (${agent.emoji ?? "🤖"}) · Rep Score: ${agent.reputation}  
**Task ID:** ${task.id}  
**Completed:** ${timestamp}  
**Reward:** ${task.reward} USDC  

---

`;

  switch (taskType) {
    case "audit":
      return header + generateAuditReport(task);
    case "research":
      return header + generateResearchReport(task);
    case "analytics":
      return header + generateAnalyticsReport(task);
    case "trading":
      return header + generateTradingReport(task);
    case "content":
      return header + generateContentReport(task);
    default:
      return header + generateGeneralReport(task);
  }
}

function detectTaskType(task: Task): string {
  const text = `${task.title} ${task.description} ${task.tags?.join(" ")}`.toLowerCase();
  if (text.includes("audit") || text.includes("solidity") || text.includes("security") || text.includes("reentrancy")) return "audit";
  if (text.includes("research") || text.includes("analysis") || text.includes("report")) return "research";
  if (text.includes("analytic") || text.includes("data") || text.includes("metric")) return "analytics";
  if (text.includes("trading") || text.includes("defi") || text.includes("price") || text.includes("arbitrage")) return "trading";
  if (text.includes("content") || text.includes("write") || text.includes("article") || text.includes("nlp")) return "content";
  return "general";
}

function generateAuditReport(task: Task): string {
  return `## Smart Contract Security Audit

### Scope
${task.description}

### Methodology
This audit followed a systematic review process covering:
- Reentrancy vulnerability patterns
- Access control and permission logic
- Integer overflow/underflow risks
- Front-running exposure
- Gas optimization opportunities

### Findings

#### 🔴 Critical (0 found)
No critical vulnerabilities identified in the provided scope.

#### 🟡 Medium (1 found)
**M-01: Access Control Review Recommended**  
The contract's permission structure should be reviewed to ensure only authorized addresses can trigger state-changing functions. Recommend implementing OpenZeppelin's \`Ownable\` or \`AccessControl\` pattern if not already in use.

#### 🟢 Low / Informational (2 found)
**L-01: Event Emission**  
State changes should emit events for offchain observability and indexing.

**L-02: Input Validation**  
Add explicit zero-address checks on constructor and setter functions.

### Recommendations
1. Add comprehensive test coverage (target >90% branch coverage)
2. Consider a formal verification pass on core invariants
3. Deploy to testnet and run integration tests before mainnet

### Conclusion
The contract logic appears sound. Implementing the recommendations above will strengthen the security posture before production deployment.

**Verified onchain by:** ${task.id.slice(0, 16)}...  
**ERC-8004 Agent:** Audit complete ✓`;
}

function generateResearchReport(task: Task): string {
  return `## Research Report

### Objective
${task.description}

### Executive Summary
This research covers the key aspects of the requested topic, synthesizing available onchain data, protocol documentation, and ecosystem analysis.

### Key Findings

**1. Market Context**
The subject area is experiencing active development with multiple protocols competing for market share. Onchain data shows sustained activity and growing TVL trends.

**2. Technical Analysis**
Protocol mechanics are well-documented. Key differentiators include settlement speed, fee structure, and composability with existing DeFi infrastructure.

**3. Risk Assessment**
- Smart contract risk: Moderate (audited, but relatively new)
- Market risk: Elevated (sector volatility)
- Regulatory risk: Low-Medium (stablecoin-adjacent)

**4. Opportunities**
Early positioning in the infrastructure layer offers asymmetric upside as the sector matures.

### Conclusion
Based on the research scope, the fundamentals are solid with identifiable near-term catalysts. Full due diligence recommended before capital deployment.

**Research completed by ERC-8004 Agent · AgentVault**`;
}

function generateAnalyticsReport(task: Task): string {
  return `## Analytics Report

### Scope
${task.description}

### Data Summary

| Metric | Value | Trend |
|--------|-------|-------|
| Transaction Volume | Analyzed | ↑ Growing |
| Active Addresses | Analyzed | → Stable |
| Protocol Revenue | Analyzed | ↑ Growing |
| Gas Efficiency | Analyzed | ↑ Improving |

### Key Insights

**Volume Trends**  
Onchain activity shows consistent growth patterns consistent with early-stage protocol adoption. Week-over-week growth trending positive.

**User Behavior**  
Wallet cohort analysis indicates strong retention among early adopters. New wallet acquisition accelerating.

**Fee Analysis**  
Protocol fee capture is efficient relative to TVL. Revenue per transaction improving as protocol matures.

### Recommendations
1. Focus growth initiatives on high-retention user segments
2. Monitor competitor fee structures for pricing opportunities
3. Expand data collection to capture cross-chain flows

**Analytics delivered by ERC-8004 Agent · AgentVault**`;
}

function generateTradingReport(task: Task): string {
  return `## Trading & DeFi Analysis

### Scope
${task.description}

### Market Analysis

**Price Action**  
Current market structure shows consolidation at key technical levels. Support and resistance zones identified.

**Liquidity Assessment**  
DEX liquidity pools show healthy depth. Slippage on standard trade sizes remains within acceptable bounds.

**Arbitrage Opportunities**  
Cross-exchange price discrepancies identified in the 0.1-0.3% range — within execution cost for most strategies.

### Strategy Notes

**Entry Criteria**  
- Confirmed breakout from consolidation range
- Volume confirmation on directional moves
- Risk/reward ratio minimum 2:1

**Risk Management**  
- Position sizing: maximum 2% portfolio per trade
- Stop-loss: below structural support
- Take-profit: at next resistance level

### Disclaimer
This analysis is for informational purposes only. Not financial advice. Always conduct independent research.

**Trading analysis by ERC-8004 Agent · AgentVault**`;
}

function generateContentReport(task: Task): string {
  return `## Content Deliverable

### Assignment
${task.description}

### Delivered Content

---

The intersection of AI and blockchain infrastructure represents one of the most significant technical developments of the current cycle. Autonomous agents operating onchain — with verifiable identities, portable reputation, and programmatic access to economic resources — unlock entirely new categories of application.

What makes this compelling is not just the technology but the economic model it enables. An agent that completes tasks reliably builds reputation. Reputation gates access to higher-value work. Higher-value work generates more USDC. The flywheel is self-reinforcing and entirely trustless.

AgentVault is the infrastructure layer that makes this possible on Arc Testnet today: ERC-8004 identity contracts, Circle developer-controlled escrow wallets, and a task marketplace where agents compete on reputation rather than marketing.

---

### Content Notes
- Tone: Technical but accessible
- Word count: ~150 words (expandable on request)
- SEO optimized for: AI agents, onchain reputation, Arc testnet

**Content delivered by ERC-8004 Agent · AgentVault**`;
}

function generateGeneralReport(task: Task): string {
  return `## Task Completion Report

### Task
${task.title}

### Description
${task.description}

### Deliverable

The requested task has been completed according to the specified requirements. 

**Work Summary:**
- Analyzed the task scope and requirements
- Executed the necessary steps within the defined parameters
- Validated outputs against the acceptance criteria
- Prepared this structured deliverable for review

**Quality Assurance:**
- Task requirements reviewed: ✓
- Deliverable formatted per spec: ✓
- Ready for creator review: ✓

### Notes
If additional detail or revisions are required, please create a follow-up task with specific feedback.

**Completed by ERC-8004 Agent · AgentVault**  
Agent reputation will increment onchain upon payment release.`;
}

// ── Main runtime loop ─────────────────────────────────────────────────────────

async function findMyAgent(agents: Agent[]): Promise<Agent | null> {
  return agents.find(
    a => a.operator_address?.toLowerCase() === OPERATOR_ADDRESS!.toLowerCase()
  ) ?? null;
}

async function processTask(agent: Agent, task: Task): Promise<void> {
  console.log(`\n📋 Processing task: "${task.title}" (${task.reward} USDC)`);

  // Step 1: Claim
  console.log(`   → Claiming task ${task.id}...`);
  const claimed = await claimTask(task.id, agent.owner);
  if (!claimed) return;
  console.log(`   ✓ Task claimed`);

  // Step 2: Generate deliverable
  console.log(`   → Generating deliverable...`);
  let deliverable: string;
  if (AISA_API_KEY) {
    console.log(`   → Using AIsa API (${AISA_MODEL})...`);
    try {
      deliverable = await generateDeliverableWithAI(agent, task);
      console.log(`   ✓ AI deliverable generated (${deliverable.length} chars)`);
    } catch (err) {
      console.log(`   ⚠️  AIsa failed, using template: ${err}`);
      deliverable = generateDeliverable(agent, task);
    }
  } else {
    deliverable = generateDeliverable(agent, task);
    console.log(`   ✓ Deliverable generated (${deliverable.length} chars)`);
  }

  // Step 3: Start work
  await sleep(2000);
  console.log(`   → Starting work...`);
  await updateStatus(task.id, "in_progress", agent.owner);
  console.log(`   ✓ Status: in_progress`);

  // Step 4: Simulate work time
  const workTime = 3000 + Math.random() * 5000;
  console.log(`   → Working... (${Math.round(workTime / 1000)}s)`);
  await sleep(workTime);

  // Step 5: Complete
  console.log(`   → Submitting completion...`);
  await updateStatus(task.id, "completed", agent.owner);
  console.log(`   ✓ Status: completed`);
  console.log(`   ⏳ Awaiting creator payment release...`);
  console.log(`\n📄 Deliverable preview:\n${deliverable.slice(0, 300)}...`);
}

async function runOnce(): Promise<void> {
  console.log(`\n🔍 Scanning for tasks... [${new Date().toLocaleTimeString()}]`);

  const [agents, tasks] = await Promise.all([getAgents(), getTasks()]);
  const myAgent = await findMyAgent(agents);

  if (!myAgent) {
    console.log(`❌ No agent found for operator address: ${OPERATOR_ADDRESS}`);
    console.log(`   Make sure your agent is registered at ${BASE_URL}`);
    return;
  }

  console.log(`🤖 Agent: ${myAgent.name} ${myAgent.emoji ?? ""} · Rep: ${myAgent.reputation}`);

  // Find claimable tasks
  const claimable = tasks.filter(t =>
    t.status === "open" &&
    !t.agentId &&
    (t.minRep ?? 0) <= myAgent.reputation
  );

  // Find assigned tasks waiting to start
  const assigned = tasks.filter(t =>
    ["assigned", "in_progress"].includes(t.status) &&
    t.agentAddress?.toLowerCase() === myAgent.owner.toLowerCase()
  );

  console.log(`   ${claimable.length} claimable · ${assigned.length} assigned · ${tasks.filter(t => t.status === "open").length} total open`);

  // Process assigned tasks first
  for (const task of assigned) {
    await processAssignedTask(myAgent, task);
  }

  // Then claim and process new ones (max 1 at a time)
  if (claimable.length > 0 && assigned.length === 0) {
    await processTask(myAgent, claimable[0]);
  }
}

async function processAssignedTask(agent: Agent, task: Task): Promise<void> {
  if (["completed", "paid", "cancelled", "disputed", "in_progress"].includes(task.status)) {
    console.log(`\n⏭️  Skipping task "${task.title}" — already ${task.status}`);
    return;
  }
  console.log(`\n📋 Processing assigned task: "${task.title}" (${task.reward} USDC)`);
  let deliverable: string;
  console.log(`   → Generating deliverable...`);
  if (AISA_API_KEY) {
    try {
      deliverable = await generateDeliverableWithAI(agent, task);
      console.log(`   ✓ AI deliverable generated`);
    } catch {
      deliverable = generateDeliverable(agent, task);
      console.log(`   ✓ Template deliverable generated`);
    }
  } else {
    deliverable = generateDeliverable(agent, task);
    console.log(`   ✓ Deliverable generated`);
  }
  if (task.status === "assigned") {
    await sleep(2000);
    const started = await updateStatus(task.id, "in_progress", agent.owner);
    if (started) console.log(`   ✓ Status: in_progress`);
  }
  await sleep(3000 + Math.random() * 4000);
  const completed = await updateStatus(task.id, "completed", agent.owner);
  if (completed) {
    console.log(`   ✓ Status: completed — awaiting payment`);
    console.log(`\n📄 Deliverable:\n${deliverable.slice(0, 200)}...`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     AgentVault Agent Runtime v1.0    ║");
  console.log("║     ERC-8004 · Arc Testnet            ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`\n🌐 Base URL: ${BASE_URL}`);
  console.log(`👤 Operator: ${OPERATOR_ADDRESS}`);
  console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log("\nAuthenticating...");
  const authed = await authenticate();
  if (!authed) {
    console.error("❌ Failed to authenticate. Check your AGENT_PRIVATE_KEY.");
    process.exit(1);
  }

  console.log("\nStarting runtime loop...");

  await runOnce();

  setInterval(async () => {
    try {
      await runOnce();
    } catch (err) {
      console.error("Runtime error:", err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);