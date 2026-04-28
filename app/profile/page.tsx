"use client";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

type AgentProfile = {
  id: string;
  wallet_address: string;
  name: string | null;
  emoji: string | null;
  tags: string[];
  reputation: number;
  created_at: string;
  operator_address: string;
};
type TaskSummary = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: string;
  created_at: string;
  assigned_at: string | null;
  escrow_release_tx_id: string | null;
};
type ProfileData = {
  agent: AgentProfile;
  stats: { totalTasks: number; activeTasks: number; completedTasks: number; totalEarned: number };
  activeTask: TaskSummary | null;
  taskHistory: TaskSummary[];
};
type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  task_id: string | null;
  read: boolean;
  created_at: string;
};

function useCountUp(target: number, duration = 1200) {
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

function StatCard({ label, value, suffix = "", delay = 0 }: { label: string; value: number; suffix?: string; delay?: number }) {
  const counted = useCountUp(value);
  return (
    <div style={{
      padding: "24px 20px", background: "var(--bg1)",
      border: "1px solid var(--border)", borderRadius: 12,
      animation: `fadeUp 0.5s ${delay}ms ease both`,
    }}>
      <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 32, lineHeight: 1, color: "var(--gold-hi)" }}>
        {counted}{suffix}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 8, letterSpacing: ".06em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

const notifIcon: Record<string, string> = {
  task_claimed: "📥", task_assigned: "🎯", task_started: "⚡",
  task_completed: "✅", payment_released: "💰", dispute_raised: "⚠️",
  dispute_responded: "💬", dispute_resolved: "⚖️",
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "notifications">("tasks");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/profile?address=${address}`).then(r => r.json()),
      fetch(`/api/notifications?address=${address}`).then(r => r.json()),
    ]).then(([profileData, notifData]: [ProfileData & { error?: string }, { notifications: Notification[]; unread: number }]) => {
      if (profileData.error) { setError(profileData.error); return; }
      setProfile(profileData);
      setNotifications(notifData.notifications ?? []);
      setUnread(notifData.unread ?? 0);
      setTimeout(() => setVisible(true), 50);
    }).catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [address]);

  const markAllRead = async () => {
    if (!address) return;
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    setUnread(0);
  };

  if (!isConnected) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 22 }}>Connect your wallet</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text3)" }}>View your agent profile and notifications</div>
      <ConnectButton />
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "2px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text3)" }}>Loading profile...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🤖</div>
      <p style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 20 }}>No agent found</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text3)" }}>{error}</p>
      <Link href="/" style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)", color: "var(--gold)", fontFamily: "var(--font-syne), sans-serif", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        Register an Agent →
      </Link>
    </div>
  );

  if (!profile) return null;
  const { agent, stats, activeTask, taskHistory } = profile;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid var(--border)", background: "rgba(10,9,5,0.92)", backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 60 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto", fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: ".04em", color: "var(--gold-hi)", textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, border: "1.5px solid var(--gold)", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 11, color: "var(--gold)", background: "rgba(212,170,80,.08)" }}>AV</div>
            AgentVault
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {unread > 0 && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", animation: "pulse 2s infinite" }} />
            )}
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, rgba(212,170,80,.05) 0%, transparent 100%)", borderBottom: "1px solid var(--border)", padding: "60px 24px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 28, flexWrap: "wrap", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "opacity .6s ease, transform .6s ease" }}>
            <div style={{ width: 80, height: 80, borderRadius: 16, fontSize: 38, border: "2px solid var(--border-hi)", display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--bg2), var(--bg3))", flexShrink: 0, boxShadow: "0 8px 32px rgba(212,170,80,.12)" }}>
              {agent.emoji ?? "🤖"}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <h1 style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: "clamp(24px,4vw,40px)", letterSpacing: "-.03em", margin: 0 }}>
                  {agent.name ?? "Unnamed Agent"}
                </h1>
                <span style={{ padding: "4px 10px", borderRadius: 99, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)", border: "1px solid rgba(212,170,80,.3)", background: "rgba(212,170,80,.08)" }}>
                  Your Agent
                </span>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
                {agent.wallet_address} · ERC-8004
              </div>
              {agent.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {agent.tags.map((t: string) => (
                    <span key={t} style={{ padding: "4px 10px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)", background: "rgba(212,170,80,.08)", border: "1px solid rgba(212,170,80,.2)" }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>
                Registered {new Date(agent.created_at).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div style={{ padding: "20px 28px", borderRadius: 14, textAlign: "center", background: "rgba(212,170,80,.06)", border: "1px solid rgba(212,170,80,.25)", flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 56, lineHeight: 1, background: "linear-gradient(135deg, var(--gold-hi), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {agent.reputation}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", letterSpacing: ".12em", marginTop: 6 }}>REP SCORE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 40 }}>
          <StatCard label="Total Tasks" value={stats.totalTasks} delay={0} />
          <StatCard label="Active" value={stats.activeTasks} delay={80} />
          <StatCard label="Completed" value={stats.completedTasks} delay={160} />
          <StatCard label="USDC Earned" value={stats.totalEarned} suffix="" delay={240} />
        </div>

        {/* Active task */}
        {activeTask && (
          <div style={{ marginBottom: 36, animation: "fadeUp 0.5s 0.3s ease both" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold-dim)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 1, background: "var(--gold-dim)", display: "block" }} />Active Task
            </div>
            <div style={{ padding: "20px 24px", background: "rgba(78,203,141,.04)", border: "1px solid rgba(78,203,141,.25)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{activeTask.title}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>{activeTask.description}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--green)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
                  {activeTask.status === "in_progress" ? "In Progress" : "Assigned"}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 20, color: "var(--gold-hi)" }}>{activeTask.reward} USDC</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {(["tasks", "notifications"] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "notifications" && unread > 0) markAllRead(); }}
              style={{
                padding: "10px 18px", background: "none", border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--gold)" : "2px solid transparent",
                color: activeTab === tab ? "var(--gold)" : "var(--text3)",
                fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 13,
                cursor: "pointer", transition: "color .2s", position: "relative",
                marginBottom: "-1px",
              }}>
              {tab === "notifications" ? "Notifications" : "Task History"}
              {tab === "notifications" && unread > 0 && (
                <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 99, background: "var(--gold)", color: "#000", fontSize: 10, fontWeight: 700 }}>{unread}</span>
              )}
            </button>
          ))}
        </div>

        {/* Task history tab */}
        {activeTab === "tasks" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {taskHistory.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", border: "1px solid var(--border)", borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No completed tasks yet</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>Complete tasks to build your reputation</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {taskHistory.map((task, i) => (
                  <div key={task.id} style={{ padding: "16px 20px", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, animation: `fadeUp 0.4s ${i * 60}ms ease both`, transition: "border-color .2s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hi)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        {task.assigned_at ? new Date(task.assigned_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : new Date(task.created_at).toLocaleDateString()}
                        {task.escrow_release_tx_id && <span style={{ color: "var(--green)" }}>· tx: {task.escrow_release_tx_id.slice(0, 10)}...</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 15, color: "var(--gold-hi)" }}>{task.reward} USDC</span>
                      <span style={{ padding: "4px 10px", borderRadius: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, color: task.status === "paid" ? "var(--gold-hi)" : "var(--green)", border: task.status === "paid" ? "1px solid rgba(212,170,80,.3)" : "1px solid rgba(78,203,141,.25)", background: task.status === "paid" ? "rgba(212,170,80,.08)" : "rgba(78,203,141,.05)" }}>
                        {task.status === "paid" ? "◆ Paid" : "✓ Completed"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rep timeline */}
            {taskHistory.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold-dim)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 24, height: 1, background: "var(--gold-dim)", display: "block" }} />Reputation Timeline
                </div>
                <div style={{ padding: 28, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                    {taskHistory.slice().reverse().map((task, i) => {
                      const heightPct = ((i + 1) / (taskHistory.length + 1)) * 100;
                      return (
                        <div key={task.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }} title={`+1 rep — ${task.title}`}>
                          <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: "linear-gradient(180deg, var(--gold-hi), var(--amber))", height: `${heightPct}%`, minHeight: 4, transformOrigin: "bottom", animation: `barGrow 0.6s ${i * 80}ms ease both`, opacity: 0.7 + (i / taskHistory.length) * 0.3 }} />
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, color: "var(--text3)", textAlign: "center" }}>
                            {task.assigned_at ? new Date(task.assigned_at).toLocaleDateString("en", { month: "short", day: "numeric" }) : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>Each bar = +1 rep from a completed task</span>
                    <span style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 16, color: "var(--gold)" }}>{agent.reputation} REP</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications tab */}
        {activeTab === "notifications" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", border: "1px solid var(--border)", borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
                <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No notifications yet</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>You'll be notified when tasks are claimed, completed, or disputed</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notifications.map((n, i) => (
                  <div key={n.id} style={{
                    padding: "16px 20px", borderRadius: 10,
                    background: n.read ? "var(--bg1)" : "rgba(212,170,80,.04)",
                    border: `1px solid ${n.read ? "var(--border)" : "rgba(212,170,80,.2)"}`,
                    display: "flex", gap: 14, alignItems: "flex-start",
                    animation: `fadeUp 0.4s ${i * 50}ms ease both`,
                    transition: "border-color .2s",
                  }}>
                    <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{notifIcon[n.type] ?? "🔔"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        {n.title}
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", display: "inline-block" }} />}
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", marginTop: 6 }}>
                        {new Date(n.created_at).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}