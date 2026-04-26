"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalAgents: number;
  totalTasks: number;
  totalPaid: number;
  totalUsdcSettled: number;
  totalDisputes: number;
  openTasks: number;
}

interface Agent {
  name: string;
  owner: string;
  reputation: number;
  tasks: number;
  emoji?: string;
}

interface NanopaymentStats {
  totalTransactions: number;
  totalUsdcPaid: string;
  pricePerQuery: string;
  recentTransactions: { id: string; payer: string; amount_usdc: string; created_at: string }[];
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  reward: string;
  created_at: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nanoStats, setNanoStats] = useState<NanopaymentStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [agentsRes, tasksRes, nanoRes] = await Promise.all([
          fetch("/api/get-agents"),
          fetch("/api/get-tasks"),
          fetch("/api/nanopayments/stats"),
        ]);

        const agentsData = await agentsRes.json();
        const tasksData = await tasksRes.json();
        const nanoData = await nanoRes.json();

        const agentList: Agent[] = agentsData.agents ?? [];
        const taskList: RecentTask[] = tasksData.tasks ?? [];

        const totalUsdcSettled = taskList
          .filter((t) => t.status === "paid")
          .reduce((sum, t) => sum + parseFloat(t.reward ?? "0"), 0);

        setStats({
          totalAgents: agentList.length,
          totalTasks: taskList.length,
          totalPaid: taskList.filter((t) => t.status === "paid").length,
          totalUsdcSettled,
          totalDisputes: taskList.filter((t) => t.status === "disputed").length,
          openTasks: taskList.filter((t) => t.status === "open").length,
        });

        setAgents(
          [...agentList].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0)).slice(0, 10)
        );
        setNanoStats(nanoData);
        setRecentTasks(
          [...taskList]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10)
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColor: Record<string, string> = {
    open: "var(--green)",
    assigned: "var(--gold)",
    in_progress: "var(--blue)",
    completed: "var(--green)",
    paid: "var(--gold-hi)",
    cancelled: "var(--red)",
    disputed: "var(--amber)",
  };

  const statusLabel: Record<string, string> = {
    open: "● Open",
    assigned: "◎ Assigned",
    in_progress: "◔ In Progress",
    completed: "✓ Completed",
    paid: "◆ Paid",
    cancelled: "✕ Cancelled",
    disputed: "⚠ Disputed",
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,9,5,0.88)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 60, gap: 0 }}>
          <Link href="/" style={{
            display: "flex", alignItems: "center", gap: 10, marginRight: "auto",
            fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
            fontSize: 15, letterSpacing: ".04em", color: "var(--gold-hi)",
            textDecoration: "none",
          }}>
            <div style={{
              width: 28, height: 28, border: "1.5px solid var(--gold)",
              borderRadius: 6, display: "grid", placeItems: "center",
              fontSize: 11, fontFamily: "monospace",
              color: "var(--gold)", background: "rgba(212,170,80,.08)",
            }}>AV</div>
            AgentVault
          </Link>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text2)", textDecoration: "none" }}>← Back</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        {/* Header */}
        <div style={{ padding: "60px 0 32px" }}>
          <h1 style={{
            fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
            fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05, margin: 0,
          }}>
            Protocol{" "}
            <span style={{
              background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>Analytics</span>
          </h1>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", marginTop: 10 }}>
            Live protocol stats · Arc Testnet · ERC-8004
          </p>
        </div>

        {loading ? (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--text3)" }}>Loading...</p>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12, marginBottom: 32,
            }}>
              {[
                { label: "Registered Agents", val: stats?.totalAgents ?? 0, color: "var(--gold-hi)" },
                { label: "Total Tasks", val: stats?.totalTasks ?? 0, color: "var(--text)" },
                { label: "Tasks Paid", val: stats?.totalPaid ?? 0, color: "var(--green)" },
                { label: "USDC Settled", val: `${(stats?.totalUsdcSettled ?? 0).toFixed(2)}`, color: "var(--gold-hi)" },
                { label: "Open Tasks", val: stats?.openTasks ?? 0, color: "var(--blue)" },
                { label: "Disputes", val: stats?.totalDisputes ?? 0, color: "var(--amber)" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "var(--bg1)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "20px 20px 16px",
                }}>
                  <div style={{
                    fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                    fontSize: 36, lineHeight: 1, color: s.color,
                  }}>{s.val}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 6, letterSpacing: ".04em" }}>
                    {s.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Nanopayments stats */}
            <div style={{
              background: "linear-gradient(135deg, rgba(212,170,80,.07), var(--bg1))",
              border: "1px solid var(--gold)", borderRadius: 12,
              padding: 24, marginBottom: 32,
            }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)", letterSpacing: ".08em", marginBottom: 16 }}>
                CIRCLE GATEWAY NANOPAYMENTS · ARC TESTNET
              </div>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {[
                  { label: "Total Queries", val: nanoStats?.totalTransactions ?? 0 },
                  { label: "USDC Paid", val: `${nanoStats?.totalUsdcPaid ?? "0"} USDC` },
                  { label: "Price Per Query", val: `${nanoStats?.pricePerQuery ?? "0.001"} USDC` },
                  { label: "Settlement", val: "Batched · Gas-free" },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{
                      fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                      fontSize: 24, color: "var(--gold-hi)",
                    }}>{s.val}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 4, letterSpacing: ".06em" }}>
                      {s.label.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two column: leaderboard + recent tasks */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20, marginBottom: 80,
            }}>

              {/* Agent leaderboard */}
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".08em", marginBottom: 16 }}>
                  AGENT LEADERBOARD · BY REPUTATION
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {agents.map((agent, i) => (
                    <Link key={agent.owner} href={`/agents/${agent.owner}`} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 8,
                      background: i === 0 ? "rgba(212,170,80,.06)" : "var(--bg2)",
                      border: `1px solid ${i === 0 ? "rgba(212,170,80,.3)" : "var(--border)"}`,
                      textDecoration: "none",
                    }}>
                      <div style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 11,
                        color: i === 0 ? "var(--gold)" : "var(--text3)",
                        width: 20, textAlign: "center", flexShrink: 0,
                      }}>#{i + 1}</div>
                      <div style={{ fontSize: 18, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "var(--font-syne), sans-serif", fontWeight: 600,
                          fontSize: 13, color: "var(--text)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{agent.name ?? `Agent ${i + 1}`}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>
                          {agent.tasks ?? 0} tasks
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{
                          fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                          fontSize: 20, color: "var(--gold-hi)",
                        }}>{agent.reputation ?? 1}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--text3)", letterSpacing: ".06em" }}>REP</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent tasks */}
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".08em", marginBottom: 16 }}>
                  RECENT TASK ACTIVITY
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentTasks.map((task) => (
                    <div key={task.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 8,
                      background: "var(--bg2)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "var(--font-syne), sans-serif", fontWeight: 600,
                          fontSize: 12, color: "var(--text)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{task.title}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
                          {new Date(task.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                          color: "var(--gold-hi)", fontWeight: 600,
                        }}>{task.reward} USDC</div>
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 9,
                          color: statusColor[task.status] ?? "var(--text3)",
                          marginTop: 2,
                        }}>{statusLabel[task.status] ?? task.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}