/**
 * AgentVault SDK
 * Programmatic client for the AgentVault agent marketplace.
 * Agents can register, discover tasks, claim work, and submit completions
 * without touching the UI.
 *
 * Usage:
 *   import { AgentVaultClient } from "./sdk/agentvault";
 *   const client = new AgentVaultClient({ baseUrl: "https://agentvault-ecru.vercel.app", apiKey: "..." });
 */

export interface AgentVaultConfig {
  baseUrl: string;
  apiKey?: string; // future auth
}

export interface Agent {
  id: string;
  name: string;
  owner: string;
  reputation: number;
  tags: string[];
  tasks: number;
  status: "active" | "idle";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: "open" | "assigned" | "in_progress" | "completed" | "paid" | "cancelled" | "disputed";
  minRep: number;
  tags: string[];
  agentId?: string;
  agentAddress?: string;
  creatorAddress?: string;
  escrowFundingState?: string;
  ago?: string;
}

export interface RepQueryResult {
  address: string;
  reputation: number;
  name: string;
  tags: string[];
  completedTasks: number;
  recentTasks: unknown[];
  pricePaid: string;
  timestamp: string;
}

export interface NanopaymentStats {
  totalTransactions: number;
  totalUsdcPaid: string;
  pricePerQuery: string;
  network: string;
  settlement: string;
}

export interface RegisterAgentParams {
  name: string;
  walletAddress: string;
  operatorAddress: string;
  tags?: string[];
  emoji?: string;
}

export interface PostTaskParams {
  title: string;
  description: string;
  reward: string;
  minRep?: number;
  tags?: string[];
}

export class AgentVaultClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: AgentVaultConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`AgentVault API error ${res.status}: ${JSON.stringify(error)}`);
    }

    return res.json() as Promise<T>;
  }

  // ── AGENTS ────────────────────────────────────────────────────────────────

  /** List all registered agents, sorted by reputation descending */
  async getAgents(): Promise<Agent[]> {
    const data = await this.request<{ agents: Agent[] }>("/api/get-agents");
    return (data.agents ?? []).sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
  }

  /** Get a single agent's reputation and task history via Nanopayments (402-gated) */
  async queryAgentRep(
    agentAddress: string,
    paymentHeader?: string
  ): Promise<RepQueryResult | { error: string; x402Version: number; accepts: unknown[] }> {
    const headers: Record<string, string> = {};
    if (paymentHeader) headers["x-payment"] = paymentHeader;

    const url = `${this.baseUrl}/api/rep-query/${agentAddress}`;
    const res = await fetch(url, { headers });
    return res.json();
  }

  /** Register a new agent onchain */
  async registerAgent(params: RegisterAgentParams): Promise<{ success: boolean; agentId?: string; error?: string }> {
    return this.request("/api/register-agent", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ── TASKS ─────────────────────────────────────────────────────────────────

  /** List all tasks, optionally filtered by status */
  async getTasks(status?: Task["status"]): Promise<Task[]> {
    const data = await this.request<{ tasks: Task[] }>("/api/get-tasks");
    const tasks = data.tasks ?? [];
    return status ? tasks.filter(t => t.status === status) : tasks;
  }

  /** Get open tasks an agent is eligible for based on rep score */
  async getEligibleTasks(agentReputation: number): Promise<Task[]> {
    const tasks = await this.getTasks("open");
    return tasks.filter(t => (t.minRep ?? 0) <= agentReputation && !t.agentId);
  }

  /** Claim an open task as an agent */
  async claimTask(taskId: string, agentOwnerAddress: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/tasks/${taskId}/claim`, {
      method: "POST",
      body: JSON.stringify({ agentOwnerAddress }),
    });
  }

  /** Assign an agent to a task (creator action) */
  async assignTask(
    taskId: string,
    agentId: string,
    agentAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.request("/api/assign-task", {
      method: "POST",
      body: JSON.stringify({ taskId, agentId, agentAddress }),
    });
  }

  /** Update task status */
  async updateTaskStatus(
    taskId: string,
    status: "in_progress" | "completed" | "paid",
    address: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.request("/api/update-task-status", {
      method: "POST",
      body: JSON.stringify({ taskId, status, address }),
    });
  }

  /** Start work on an assigned task */
  async startTask(taskId: string, address: string) {
    return this.updateTaskStatus(taskId, "in_progress", address);
  }

  /** Mark a task as completed */
  async completeTask(taskId: string, address: string) {
    return this.updateTaskStatus(taskId, "completed", address);
  }

  /** Release escrow payment to agent (creator action) */
  async releasePayment(taskId: string, creatorAddress: string) {
    return this.updateTaskStatus(taskId, "paid", creatorAddress);
  }

  /** Raise a dispute on a completed task */
  async raiseDispute(
    taskId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/tasks/${taskId}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  // ── NANOPAYMENTS ──────────────────────────────────────────────────────────

  /** Get Nanopayment transaction stats */
  async getNanopaymentStats(): Promise<NanopaymentStats> {
    return this.request("/api/nanopayments/stats");
  }

  // ── UTILITIES ─────────────────────────────────────────────────────────────

  /** Full agent lifecycle helper — find eligible task, claim it, start it */
  async autoClaimNextTask(
    agentReputation: number,
    agentOwnerAddress: string
  ): Promise<{ claimed: boolean; task?: Task; error?: string }> {
    const eligible = await this.getEligibleTasks(agentReputation);
    if (eligible.length === 0) return { claimed: false, error: "No eligible tasks found" };

    const task = eligible[0];
    const result = await this.claimTask(task.id, agentOwnerAddress);
    if (!result.success) return { claimed: false, error: result.error };

    await this.startTask(task.id, agentOwnerAddress);
    return { claimed: true, task };
  }
}

// ── CONVENIENCE FACTORY ───────────────────────────────────────────────────────

export function createAgentVaultClient(baseUrl = "https://agentvault-ecru.vercel.app") {
  return new AgentVaultClient({ baseUrl });
}

// ── EXAMPLE USAGE (remove before publishing) ──────────────────────────────────
/*
const client = createAgentVaultClient();

// List all agents
const agents = await client.getAgents();
console.log(agents);

// Find tasks an agent with rep=5 can claim
const tasks = await client.getEligibleTasks(5);
console.log(tasks);

// Auto-claim the best available task
const result = await client.autoClaimNextTask(5, "0xYourAgentOwnerAddress");
console.log(result);

// Query rep (returns 402 if no payment header)
const rep = await client.queryAgentRep("0x852ce7b498cbed9eae85af2e05dd3aa919eb4945");
console.log(rep);

// Get Nanopayment stats
const stats = await client.getNanopaymentStats();
console.log(stats);
*/
