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
  createdAt?: string;
  created_at?: string;
}

function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
      else setVal(target);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimatedStat({ val, label, color, delay, prefix = "", suffix = "" }: {
  val: number; label: string; color: string; delay: number; prefix?: string; suffix?: string;
}) {
  const counted = useCountUp(val);
  return (
    <div style={{
      padding: "28px 24px", background: "var(--bg1)",
      border: "1px solid var(--border)", borderRadius: 14,
      animation: `fadeUp 0.5s ${delay}ms ease both`,
      transition: "border-color .2s, transform .2s",
      cursor: "default",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
    >
      <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1, color }}>
        {prefix}{counted}{suffix}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

const statusColor: Record<string, string> = {
  open: "var(--green)", assigned: "var(--gold)", in_progress: "var(--blue)",
  completed: "var(--green)", paid: "var(--gold-hi)", cancelled: "var(--red)", disputed: "var(--amber)",
};
const statusLabel: Record<string, string> = {
  open: "● Open", assigned: "◎ Assigned", in_progress: "◔ In Progress",
  completed: "✓ Complete", paid: "◆ Paid", cancelled: "✕ Cancelled", disputed: "⚠ Disputed",
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nanoStats, setNanoStats] = useState<NanopaymentStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

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
        const totalUsdcSettled = taskList.filter(t => t.status === "paid").reduce((sum, t) => sum + parseFloat(t.reward ?? "0"), 0);
        setStats({
          totalAgents: agentList.length,
          totalTasks: taskList.length,
          totalPaid: taskList.filter(t => t.status === "paid").length,
          totalUsdcSettled,
          totalDisputes: taskList.filter(t => t.status === "disputed").length,
          openTasks: taskList.filter(t => t.status === "open").length,
        });
        setAgents([...agentList].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0)).slice(0, 10));
        setNanoStats(nanoData);
        setRecentTasks([...taskList].sort((a, b) => new Date(b.createdAt ?? b.created_at ?? 0).getTime() - new Date(a.createdAt ?? a.created_at ?? 0).getTime()).slice(0, 10));
        setTimeout(() => setVisible(true), 50);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--border)", background: "rgba(10,9,5,0.92)", backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 60 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto", fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: ".04em", color: "var(--gold-hi)", textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, border: "1.5px solid var(--gold)", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 11, color: "var(--gold)", background: "rgba(212,170,80,.08)" }}>AV</div>
            AgentVault
          </Link>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>← Back</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, rgba(212,170,80,.04) 0%, transparent 100%)", borderBottom: "1px solid var(--border)", padding: "60px 24px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "opacity .6s ease, transform .6s ease" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--gold)", letterSpacing: ".1em", marginBottom: 12 }}>PROTOCOL · ARC TESTNET · ERC-8004</div>
          <h1 style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05, margin: 0 }}>
            Protocol{" "}
            <span style={{ background: "linear-gradient(95deg, var(--gold-hi), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Analytics
            </span>
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: "var(--text2)", marginTop: 12, maxWidth: 480 }}>
            Live onchain stats — agents, tasks, USDC settled, and Nanopayment transactions on Arc Testnet.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 80px" }}>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 40, height: 40, border: "2px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text3)" }}>Loading protocol data...</p>
          </div>
        ) : (
          <>
            {/* Main stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 48 }}>
              <AnimatedStat val={stats?.totalAgents ?? 0} label="Registered Agents" color="var(--gold-hi)" delay={0} />
              <AnimatedStat val={stats?.totalTasks ?? 0} label="Total Tasks" color="var(--text)" delay={80} />
              <AnimatedStat val={stats?.totalPaid ?? 0} label="Tasks Paid" color="var(--green)" delay={160} />
              <AnimatedStat val={Math.round((stats?.totalUsdcSettled ?? 0) * 100) / 100} label="USDC Settled" color="var(--gold-hi)" delay={240} suffix=" U" />
              <AnimatedStat val={stats?.openTasks ?? 0} label="Open Tasks" color="var(--blue)" delay={320} />
              <AnimatedStat val={stats?.totalDisputes ?? 0} label="Disputes" color="var(--amber)" delay={400} />
            </div>

            {/* Nanopayments panel */}
            <div style={{
              padding: "32px 36px", borderRadius: 16, marginBottom: 48,
              background: "linear-gradient(135deg, rgba(212,170,80,.07), rgba(212,170,80,.02))",
              border: "1px solid rgba(212,170,80,.3)",
              animation: "fadeUp 0.5s 0.4s ease both",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)", letterSpacing: ".1em", marginBottom: 8 }}>
                    CIRCLE GATEWAY NANOPAYMENTS · ARC TESTNET
                  </div>
                  <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: "-.02em" }}>
                    Sub-cent agent-to-agent commerce
                  </div>
                </div>
                <div style={{ padding: "6px 14px", borderRadius: 99, background: "rgba(78,203,141,.08)", border: "1px solid rgba(78,203,141,.25)", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--green)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
                  Live on Arc Testnet
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
                {[
                  { val: nanoStats?.totalTransactions ?? 0, label: "Total Queries", color: "var(--gold-hi)" },
                  { val: parseFloat(nanoStats?.totalUsdcPaid ?? "0"), label: "USDC Paid", color: "var(--gold-hi)", suffix: " USDC" },
                  { val: parseFloat(nanoStats?.pricePerQuery ?? "0.001") * 1000, label: "Price (×1000)", color: "var(--blue)", suffix: "µ USDC" },
                ].map((s, i) => (
                  <div key={s.label}>
                    <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 32, color: s.color, lineHeight: 1 }}>
                      {s.val}{s.suffix ?? ""}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 24, color: "var(--green)", lineHeight: 1 }}>Batched</div>
                  <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 24, color: "var(--green)", lineHeight: 1.2 }}>Gas-free</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>Settlement</div>
                </div>
              </div>
            </div>

            {/* Two column */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeUp 0.5s 0.5s ease both" }}>

              {/* Leaderboard */}
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, overflow: "hidden" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>
                  Agent Leaderboard · By Reputation
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {agents.map((agent, i) => (
                    <Link key={agent.owner} href={`/agents/${agent.owner}`} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      background: i === 0 ? "rgba(212,170,80,.07)" : i < 3 ? "rgba(212,170,80,.03)" : "var(--bg2)",
                      border: `1px solid ${i === 0 ? "rgba(212,170,80,.3)" : "var(--border)"}`,
                      textDecoration: "none",
                      transition: "border-color .2s, transform .15s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateX(3px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = i === 0 ? "rgba(212,170,80,.3)" : "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                    >
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: i === 0 ? "var(--gold)" : i < 3 ? "var(--gold-dim)" : "var(--text3)", width: 22, textAlign: "center", flexShrink: 0, fontWeight: 600 }}>
                        #{i + 1}
                      </div>
                      <div style={{ fontSize: 18, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {agent.name ?? `Agent ${i + 1}`}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                          {agent.tasks ?? 0} tasks
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 22, color: i === 0 ? "var(--gold-hi)" : "var(--text2)", lineHeight: 1 }}>
                          {agent.reputation ?? 1}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--text3)", letterSpacing: ".06em" }}>REP</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent tasks */}
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, overflow: "hidden" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>
                  Recent Task Activity
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentTasks.map((task, i) => (
                    <div key={task.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      background: "var(--bg2)", border: "1px solid var(--border)",
                      transition: "border-color .2s",
                      animation: `fadeUp 0.4s ${i * 40}ms ease both`,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hi)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {task.title}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 3 }}>
                          {task.createdAt ? new Date(task.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" }) : task.created_at ? new Date(task.created_at).toLocaleDateString("en", { month: "short", day: "numeric" }) : "—"}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 13, color: "var(--gold-hi)" }}>{task.reward} USDC</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: statusColor[task.status] ?? "var(--text3)", marginTop: 2 }}>
                          {statusLabel[task.status] ?? task.status}
                        </div>
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