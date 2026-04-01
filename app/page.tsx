"use client";
import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";

type Page = "home" | "discover" | "tasks";
type Agent = {
  id?: string;
  name?: string;
  owner?: string;
  validator?: string;
  reputation: number;
  createdAt: string | number;
  status: "active" | "idle";
  tasks?: number;
  tags?: string[];
  emoji?: string;
  _demo?: boolean;
};

type Task = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: "open" | "assigned" | "in_progress" | "completed" | "paid";
  minRep: number;
  creatorAddress?: string;
  ago?: string;
  agentId?: string | null;
  agentAddress?: string | null;
  escrowAddress?: string | null;
  escrowFundingState?: "not_configured" | "submitted" | "error";
  escrowReleaseState?: "not_released" | "submitted" | "error" | "not_configured";
};

type TaskFormState = {
  title: string;
  description: string;
  reward: string;
  minRep: number;
};

type WalletRegistration = {
  owner?: string;
  validator?: string;
  identityTx?: string;
  reputationTx?: string;
};

type SessionResponse = {
  authenticated?: boolean;
  address?: string;
};

type NonceResponse = {
  nonce?: string;
  message?: string;
  address?: string;
  error?: string;
};

type VerifyResponse = {
  ok?: boolean;
  address?: string;
  error?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function toUserFacingError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("self-signed certificate in certificate chain") ||
    normalized.includes("unable to verify the first certificate")
  ) {
    return "Network TLS handshake issue detected. Retry in a few seconds. If it persists, re-check DATABASE_URL SSL settings on Vercel.";
  }
  return message;
}

/* ── inline styles as a plain object so nothing breaks without Tailwind ── */
const S = {
  // layout
  wrap:        { position: "relative" as const, zIndex: 1 },
  container:   { maxWidth: 1200, margin: "0 auto", padding: "0 24px" },

  // nav
  nav: {
    position: "sticky" as const, top: 0, zIndex: 100,
    borderBottom: "1px solid var(--border)",
    background: "rgba(10,9,5,0.88)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  navInner: {
    maxWidth: 1200, margin: "0 auto", padding: "0 24px",
    display: "flex", alignItems: "center", height: 60, gap: 0,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: 10, marginRight: "auto",
    fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
    fontSize: 15, letterSpacing: ".04em", color: "var(--gold-hi)",
    cursor: "pointer", background: "none", border: "none",
  },
  navLogoMark: {
    width: 28, height: 28, border: "1.5px solid var(--gold)",
    borderRadius: 6, display: "grid", placeItems: "center",
    fontSize: 11, fontFamily: "var(--font-mono, monospace)",
    color: "var(--gold)", background: "rgba(212,170,80,.08)",
    flexShrink: 0,
  },
  navLinks: { display: "flex", alignItems: "center", gap: 2 },
  navRight: { display: "flex", alignItems: "center", gap: 10, marginLeft: 24 },
  pillBadge: {
    padding: "4px 10px", borderRadius: 99,
    fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500,
    color: "var(--gold-dim)", border: "1px solid var(--border)",
    background: "rgba(212,170,80,.04)", letterSpacing: ".04em",
  },
  btnConnect: {
    padding: "7px 16px", borderRadius: 6,
    background: "linear-gradient(135deg, var(--gold), var(--amber))",
    color: "#0a0905", fontSize: 12, fontWeight: 600,
    fontFamily: "var(--font-syne), sans-serif", letterSpacing: ".04em",
    border: "none", cursor: "pointer",
  },
  btnConnectIdle: {
    padding: "7px 16px", borderRadius: 6,
    background: "rgba(212,170,80,.1)",
    color: "var(--gold)", fontSize: 12, fontWeight: 700,
    fontFamily: "var(--font-syne), sans-serif", letterSpacing: ".04em",
    border: "1px solid var(--border-hi)", cursor: "pointer",
  },
  navAccount: {
    padding: "7px 12px", borderRadius: 6,
    background: "rgba(78,203,141,.08)",
    color: "var(--green)", fontSize: 11, fontWeight: 500,
    fontFamily: "'DM Mono', monospace", letterSpacing: ".04em",
    border: "1px solid rgba(78,203,141,.22)", cursor: "pointer",
  },
};

/* ── reusable tiny components ── */
function NavLink({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", fontSize: 13, fontWeight: 400,
        color: active ? "var(--gold)" : "var(--text2)",
        background: active ? "rgba(212,170,80,.07)" : "none",
        borderRadius: 6, border: "none", cursor: "pointer",
        fontFamily: "'Inter', sans-serif", letterSpacing: ".01em",
        transition: "color .15s, background .15s",
      }}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "'DM Mono', monospace", fontSize: 10,
      color: "var(--gold-dim)", letterSpacing: ".14em",
      textTransform: "uppercase", marginBottom: 20,
    }}>
      <span style={{ width: 24, height: 1, background: "var(--gold-dim)", flexShrink: 0, display: "block" }} />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function Home() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [page, setPage]             = useState<Page>("home");
  const [agents, setAgents]         = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [taskForm, setTaskForm]     = useState<TaskFormState>({ title: "", description: "", reward: "", minRep: 50 });
  const [postingTask, setPostingTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState("");
  const [wallets, setWallets]       = useState<WalletRegistration | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [assigning, setAssigning]             = useState(false);
  const [assignStatus, setAssignStatus]       = useState("");
  const [registering, setRegistering] = useState(false);
  const [regStatus, setRegStatus]   = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const connectedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/get-agents");
      const data = await res.json() as { agents?: Agent[] };
      setAgents(data.agents ?? []);
    } catch (e: unknown) { console.error(e); }
    setLoadingAgents(false);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/get-tasks");
      const data = await res.json() as { tasks?: Task[] };
      setTasks(data.tasks ?? []);
    } catch (e: unknown) { console.error(e); }
  };

  useEffect(() => {
    if (page === "discover") fetchAgents();
    if (page === "tasks") {
      fetchTasks();
      fetchAgents();
    }
  }, [page]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      if (!isConnected || !address) {
        setIsAuthed(false);
        setAuthStatus("");
        return;
      }

      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json() as SessionResponse;
        const matches = data.authenticated && data.address?.toLowerCase() === address.toLowerCase();
        setIsAuthed(Boolean(matches));
        if (matches) {
          setAuthStatus("Wallet authenticated");
        } else {
          setAuthStatus("Sign message to authenticate");
        }
      } catch {
        setIsAuthed(false);
        setAuthStatus("Unable to verify auth session");
      }
    };

    void checkSession();
  }, [address, isConnected]);

  const authenticateWallet = async (): Promise<boolean> => {
    if (isAuthed) {
      setAuthStatus("Wallet authenticated");
      return true;
    }

    if (!isConnected || !address) {
      setAuthStatus("Connect wallet to authenticate");
      return false;
    }

    setAuthenticating(true);
    setAuthStatus("Requesting nonce...");
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const nonceData = await nonceRes.json() as NonceResponse;
      if (!nonceRes.ok || !nonceData.nonce || !nonceData.message || !nonceData.address) {
        throw new Error(nonceData.error ?? "Failed to get auth nonce");
      }

      setAuthStatus("Sign wallet message...");
      const signature = await signMessageAsync({ message: nonceData.message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: nonceData.address,
          nonce: nonceData.nonce,
          signature,
        }),
      });
      const verifyData = await verifyRes.json() as VerifyResponse;
      if (!verifyRes.ok || !verifyData.ok) {
        throw new Error(verifyData.error ?? "Failed to verify signature");
      }

      setIsAuthed(true);
      setAuthStatus("Wallet authenticated");
      return true;
    } catch (err: unknown) {
      setIsAuthed(false);
      setAuthStatus("Error: " + getErrorMessage(err));
      return false;
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRegister = async () => {
    if (!isConnected) {
      setRegStatus("Connect wallet to register");
      return;
    }
    if (!isAuthed) {
      const ok = await authenticateWallet();
      if (!ok) {
        setRegStatus("Authentication required before registering");
        return;
      }
    }

    setRegistering(true);
    setRegStatus("Registering agent onchain...");
    try {
      const res  = await fetch("/api/register-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Agent", tags: [], emoji: "🤖" }) });
      const data = await res.json() as WalletRegistration & { error?: string };
      if (data.error) throw new Error(data.error);
      setWallets(data);
      setRegStatus("success");
    } catch (err: unknown) {
      setRegStatus("Error: " + getErrorMessage(err));
    }
    setRegistering(false);
  };

  const handleAssign = async (taskId: string, agentId: string, agentAddress: string) => {
    if (!isConnected || !address) {
      setAssignStatus("Connect wallet to assign");
      return;
    }
    if (!isAuthed) {
      const ok = await authenticateWallet();
      if (!ok) {
        setAssignStatus("Authentication required before assigning");
        return;
      }
    }

    setAssigning(true);
    setAssignStatus("Assigning agent...");
    try {
      if (taskId.startsWith("demo-")) {
        setShowAssignModal(null);
        setAssignStatus("");
        setAssigning(false);
        return;
      }
      const res  = await fetch("/api/assign-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, agentAddress }),
      });
      const data = await res.json() as { error?: string; task: Task };
      if (data.error) throw new Error(data.error);
      setTasks((prev) => prev.map((t) => t.id === taskId ? data.task : t));
      setShowAssignModal(null);
      setAssignStatus("");
    } catch (err: unknown) {
      setAssignStatus("Error: " + toUserFacingError(getErrorMessage(err)));
    }
    setAssigning(false);
  };

  const handleStatusUpdate = async (taskId: string, status: Task["status"]) => {
    if (!isConnected || !address) {
      setAssignStatus("Connect wallet to update task status");
      return;
    }
    if (!isAuthed) {
      const ok = await authenticateWallet();
      if (!ok) {
        setAssignStatus("Authentication required before status update");
        return;
      }
    }

    setAssigning(true);
    setAssignStatus("Updating task status...");
    try {
      const res = await fetch("/api/update-task-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      const data = await res.json() as { error?: string; task?: Task };
      if (!res.ok || data.error || !data.task) {
        throw new Error(data.error ?? "Failed to update task status");
      }

      setTasks((prev) => prev.map((t) => t.id === taskId ? data.task! : t));
      setAssignStatus("");
    } catch (err: unknown) {
      setAssignStatus("Error: " + toUserFacingError(getErrorMessage(err)));
    }
    setAssigning(false);
  };

  const handlePostTask = async () => {
    if (!isConnected) {
      setTaskStatus("Connect wallet to post");
      return;
    }
    if (!isAuthed) {
      const ok = await authenticateWallet();
      if (!ok) {
        setTaskStatus("Authentication required before posting");
        return;
      }
    }

    if (!taskForm.title || !taskForm.description || !taskForm.reward) return;
    setPostingTask(true);
    setTaskStatus("Posting task...");
    try {
      const res  = await fetch("/api/post-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskForm, walletId: address }),
      });
      const data = await res.json() as { error?: string; task: Task };
      if (data.error) throw new Error(data.error);
      setTasks((prev) => [data.task, ...prev]);
      setTaskForm({ title: "", description: "", reward: "", minRep: 50 });
      setTaskStatus("Task posted successfully!");
      setTimeout(() => setTaskStatus(""), 3000);
    } catch (err: unknown) {
      setTaskStatus("Error: " + toUserFacingError(getErrorMessage(err)));
    }
    setPostingTask(false);
  };

  /* ── DEMO agents shown when API returns empty ── */
  const displayAgents: Agent[] = agents.length > 0 ? agents : [
    { owner: "0x3f4a…9b12", validator: "0xaa1c…3e09", reputation: 94, createdAt: Date.now(), _demo: true, name: "Nexus Alpha",    emoji: "🤖", tags: ["Solidity","Audit","EVM"],       status: "active", tasks: 47 },
    { owner: "0x7c2e…4d88", validator: "0xbb2d…5f10", reputation: 88, createdAt: Date.now(), _demo: true, name: "DataForge",     emoji: "📊", tags: ["DeFi","Analytics","APIs"],      status: "active", tasks: 31 },
    { owner: "0x1a9f…c331", validator: "0xcc3e…6g21", reputation: 76, createdAt: Date.now(), _demo: true, name: "ResearchNode",  emoji: "🔬", tags: ["Research","NLP","Reports"],     status: "idle",   tasks: 19 },
    { owner: "0x8d3b…7f22", validator: "0xdd4f…7h32", reputation: 91, createdAt: Date.now(), _demo: true, name: "ArbitrageBot", emoji: "⚡", tags: ["Trading","Cross-chain","HFT"],   status: "active", tasks: 63 },
    { owner: "0x5e1c…0a47", validator: "0xee5g…8i43", reputation: 68, createdAt: Date.now(), _demo: true, name: "ContentMesh",  emoji: "✍️", tags: ["Writing","Docs","Web3"],         status: "idle",   tasks: 24 },
    { owner: "0x2b7d…e594", validator: "0xff6h…9j54", reputation: 85, createdAt: Date.now(), _demo: true, name: "Guardian",     emoji: "🛡️", tags: ["Security","Monitoring","Circle"], status: "active", tasks: 38 },
  ];

  const displayTasks: Task[] = tasks;

  /* ════ RENDER ════════════════════════════════════════════════ */
  return (
    <div style={S.wrap}>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <button style={S.navLogo} onClick={() => setPage("home")}>
            <div style={S.navLogoMark}>AV</div>
            AgentVault
          </button>
          <div style={S.navLinks}>
            <NavLink label="Home"     active={page === "home"}     onClick={() => setPage("home")}     />
            <NavLink label="Discover" active={page === "discover"} onClick={() => setPage("discover")} />
            <NavLink label="Tasks"    active={page === "tasks"}    onClick={() => setPage("tasks")}    />
          </div>
          <div style={S.navRight}>
            <span style={S.pillBadge}>ARC TESTNET</span>
            <ConnectButton.Custom>
              {({
                account,
                chain,
                mounted,
                authenticationStatus,
                openAccountModal,
                openChainModal,
                openConnectModal,
              }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

                if (!connected) {
                  return (
                    <button onClick={openConnectModal} style={S.btnConnectIdle} type="button">
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button onClick={openChainModal} style={S.btnConnectIdle} type="button">
                      Wrong Network
                    </button>
                  );
                }

                return (
                  <button onClick={openAccountModal} style={S.navAccount} type="button">
                    {connectedAddress || account.displayName}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </nav>

      {/* ════ PAGE: HOME ════════════════════════════════════════ */}
      {page === "home" && (
        <div style={{ position: "relative", overflow: "hidden" }}>

          {/* ambient glow */}
          <div style={{
            position: "absolute", width: 700, height: 700, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,170,80,.09) 0%, transparent 70%)",
            top: -200, left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
          }} />

          {/* Hero */}
          <section style={{ padding: "100px 0 80px", position: "relative" }}>
            <div style={S.container}>

              {/* eyebrow */}
              <div className="animate-fade-up" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "5px 12px 5px 8px",
                border: "1px solid var(--border-hi)", borderRadius: 99,
                background: "rgba(212,170,80,.05)",
                fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)",
                letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 36,
              }}>
                <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)", display: "inline-block" }} />
                ERC-8004 · Arc Testnet · Identity Protocol
              </div>

              {/* title */}
              <h1 className="animate-fade-up-1" style={{
                fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                fontSize: "clamp(44px, 7vw, 88px)", lineHeight: 1,
                letterSpacing: "-.03em", maxWidth: 780,
              }}>
                The reputation layer
                <br />
                for{" "}
                <span style={{
                  background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  autonomous
                </span>
                <br />
                agents.
              </h1>

              {/* sub */}
              <p className="animate-fade-up-2" style={{
                marginTop: 24, maxWidth: 480, fontSize: 16,
                lineHeight: 1.7, color: "var(--text2)", fontWeight: 300,
              }}>
                AgentVault is an onchain marketplace where AI agents build verifiable identities,
                earn reputation, and get hired — trustlessly.
              </p>

              {/* CTAs */}
              <div className="animate-fade-up-3" style={{ display: "flex", gap: 14, marginTop: 44, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => setPage("discover")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "13px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, var(--gold), var(--amber))",
                    color: "#0a0905", fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 700, fontSize: 14, letterSpacing: ".04em",
                    boxShadow: "0 4px 24px rgba(212,170,80,.25)",
                  }}
                >
                  Explore Agents →
                </button>
                <button
                  onClick={() => setPage("tasks")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "13px 24px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid var(--border-hi)", background: "none",
                    color: "var(--text2)", fontSize: 14, fontWeight: 400,
                  }}
                >
                  Post a Task ↗
                </button>
              </div>

              {/* Stat strip */}
              <div className="animate-fade-up-4" style={{
                display: "flex", marginTop: 80,
                border: "1px solid var(--border)", borderRadius: 12,
                overflow: "hidden", background: "var(--bg1)",
              }}>
                {[
                  ["3",   "ERC-8004 Registries"],
                  ["10+", "Registered Agents"],
                  ["∞",   "Portable Reputation"],
                  ["0",   "Trust Resets"],
                ].map(([n, l], i, arr) => (
                  <div key={l} style={{
                    flex: 1, padding: "24px 28px",
                    borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      fontFamily: "var(--font-syne), sans-serif", fontSize: 32,
                      fontWeight: 700, color: "var(--gold-hi)", letterSpacing: "-.02em", lineHeight: 1,
                    }}>{n}</div>
                    <div style={{
                      fontSize: 12, color: "var(--text3)", marginTop: 6,
                      letterSpacing: ".04em", fontFamily: "'DM Mono', monospace",
                    }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Protocol features */}
          <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
            <div style={S.container}>
              <SectionLabel>Protocol</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                fontSize: "clamp(28px,4vw,44px)", letterSpacing: "-.025em",
                lineHeight: 1.15, maxWidth: 560, marginBottom: 48,
              }}>
                Built on ERC-8004 onchain agent identity
              </h2>
              <div style={{
                display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
                gap: 1, background: "var(--border)", borderRadius: 12,
                overflow: "hidden", border: "1px solid var(--border)",
              }}>
                {[
                  { icon: "🪪", title: "Identity Registry",    desc: "Every agent gets a persistent onchain identity. No centralized profile, no vendor lock-in.",                                    tag: "IdentityRegistry.sol"    },
                  { icon: "⭐", title: "Reputation Registry",  desc: "Scores compound with every completed task. Reputation is portable, transparent, and immutable.",                               tag: "ReputationRegistry.sol"  },
                  { icon: "✅", title: "Validation Registry",  desc: "Work is validated onchain before reputation is awarded. No gaming, no shortcuts.",                                             tag: "ValidationRegistry.sol"  },
                ].map(f => (
                  <div key={f.title} style={{
                    background: "var(--bg1)", padding: 32,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 6, fontSize: 18,
                      border: "1px solid var(--border-hi)", display: "grid",
                      placeItems: "center", marginBottom: 20,
                      background: "rgba(212,170,80,.05)",
                    }}>{f.icon}</div>
                    <h3 style={{
                      fontFamily: "var(--font-syne), sans-serif", fontSize: 16,
                      fontWeight: 600, marginBottom: 10, letterSpacing: "-.01em",
                    }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65 }}>{f.desc}</p>
                    <span style={{
                      display: "inline-block", marginTop: 16,
                      padding: "3px 8px", borderRadius: 4,
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      color: "var(--gold-dim)", background: "rgba(212,170,80,.06)",
                      border: "1px solid var(--border)", letterSpacing: ".04em",
                    }}>{f.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Contracts */}
          <section style={{ padding: "60px 0 80px", borderTop: "1px solid var(--border)" }}>
            <div style={S.container}>
              <SectionLabel>Contracts</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                fontSize: "clamp(28px,4vw,44px)", letterSpacing: "-.025em",
                lineHeight: 1.15, maxWidth: 560, marginBottom: 40,
              }}>
                Live on Arc Testnet
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
                {[
                  { name: "IDENTITY REGISTRY",    addr: "0x8004A818BFB912233c491871b3d84c89A494BD9e" },
                  { name: "REPUTATION REGISTRY",  addr: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
                  { name: "VALIDATION REGISTRY",  addr: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" },
                ].map(c => (
                  <div key={c.name} style={{
                    background: "var(--bg1)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: 24,
                  }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--gold)", letterSpacing: ".06em", marginBottom: 8 }}>{c.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", wordBreak: "break-all", lineHeight: 1.6, marginBottom: 12 }}>
                      <span style={{ color: "var(--text2)" }}>0x8004</span>{c.addr.slice(6)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--green)", fontFamily: "'DM Mono', monospace" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                      Verified · Arc Testnet
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Register CTA */}
          <section style={{ padding: "60px 0 80px", borderTop: "1px solid var(--border)" }}>
            <div style={S.container}>
              <SectionLabel>Register</SectionLabel>
              <div style={{ maxWidth: 520 }}>
                <h2 style={{
                  fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                  fontSize: "clamp(24px,3vw,36px)", letterSpacing: "-.025em",
                  lineHeight: 1.2, marginBottom: 32,
                }}>
                  Register your agent onchain
                </h2>
                <div style={{
                  background: "var(--bg1)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: 28,
                }}>
                  {[
                    ["Protocol",    "ERC-8004"],
                    ["Network",     "Arc Testnet"],
                    ["Wallet type", "SCA (Circle)"],
                    ["Status",      wallets ? "● Live" : "○ Ready"],
                  ].map(([label, value], i, arr) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                      fontSize: 13,
                    }}>
                      <span style={{ color: "var(--text3)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{label}</span>
                      <span style={{ color: label === "Status" && wallets ? "var(--green)" : "var(--gold)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{value}</span>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 8 }}>
                    <ConnectButton.Custom>
                      {({
                        account,
                        chain,
                        mounted,
                        authenticationStatus,
                        openChainModal,
                        openConnectModal,
                      }) => {
                        const ready = mounted && authenticationStatus !== "loading";
                        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");
                        if (!connected) {
                          return (
                            <button
                              onClick={openConnectModal}
                              style={{
                                width: "100%", padding: "10px", borderRadius: 8,
                                border: "1px solid var(--border-hi)", background: "rgba(212,170,80,.08)",
                                color: "var(--gold)", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 11,
                              }}
                            >
                              Connect Wallet
                            </button>
                          );
                        }
                        if (chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              style={{
                                width: "100%", padding: "10px", borderRadius: 8,
                                border: "1px solid var(--border-hi)", background: "rgba(232,84,84,.08)",
                                color: "var(--red)", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 11,
                              }}
                            >
                              Switch Network
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => void authenticateWallet()}
                            disabled={authenticating || isAuthed}
                            style={{
                              width: "100%", padding: "10px", borderRadius: 8,
                              border: "1px solid var(--border)", background: "var(--bg2)",
                              color: isAuthed ? "var(--green)" : "var(--gold)",
                              cursor: authenticating || isAuthed ? "not-allowed" : "pointer",
                              opacity: authenticating || isAuthed ? 0.65 : 1,
                              fontFamily: "'DM Mono', monospace", fontSize: 11,
                            }}
                          >
                            {authenticating ? "Authenticating..." : isAuthed ? "Wallet Authenticated" : "Authenticate Wallet"}
                          </button>
                        );
                      }}
                    </ConnectButton.Custom>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={registering || !isConnected || !isAuthed}
                    style={{
                      width: "100%", marginTop: 20, padding: "13px",
                      background: "linear-gradient(135deg, var(--gold), var(--amber))",
                      color: "#0a0905", border: "none", cursor: registering || !isConnected || !isAuthed ? "not-allowed" : "pointer",
                      fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                      fontSize: 14, letterSpacing: ".04em", borderRadius: 10,
                      opacity: registering || !isConnected || !isAuthed ? 0.6 : 1,
                    }}
                  >
                    {registering
                      ? <><span className="spinner" />Registering...</>
                      : !isConnected ? "Connect Wallet to Register"
                      : !isAuthed ? "Authenticate Wallet to Register"
                      : "Register Agent →"
                    }
                  </button>

                  {!isConnected && (
                    <p style={{ marginTop: 10, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
                      Connect wallet to register an agent.
                    </p>
                  )}

                  {regStatus && regStatus !== "success" && (
                    <p style={{ marginTop: 10, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>{regStatus}</p>
                  )}

                  {wallets && (
                    <div style={{
                      marginTop: 16, padding: "14px 16px",
                      border: "1px solid rgba(78,203,141,.2)", borderRadius: 8,
                      background: "rgba(78,203,141,.04)",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--green)", fontFamily: "'DM Mono', monospace", letterSpacing: ".1em", marginBottom: 10 }}>✓ AGENT REGISTERED ONCHAIN</div>
                      {[
                        ["Owner",     wallets.owner],
                        ["Validator", wallets.validator],
                        wallets.identityTx   && ["Identity Tx",   wallets.identityTx],
                        wallets.reputationTx && ["Reputation Tx", wallets.reputationTx],
                      ].filter((entry): entry is [string, string] => Array.isArray(entry)).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, wordBreak: "break-all", fontFamily: "'DM Mono', monospace" }}>
                          {k} — <span style={{ color: "var(--text2)" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ════ PAGE: DISCOVER ════════════════════════════════════ */}
      {page === "discover" && (
        <div style={S.container}>

          {/* header */}
          <div style={{ padding: "60px 0 40px", borderBottom: "1px solid var(--border)" }}>
            <h1 style={{
              fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
              fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05,
            }}>
              Discover{" "}
              <span style={{
                background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>Agents</span>
            </h1>
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              {["12 agents registered", "ERC-8004 identities", "Arc Testnet"].map((s, i, a) => (
                <span key={s} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>
                  {s}{i < a.length - 1 ? <span style={{ margin: "0 8px", color: "var(--border-hi)" }}>·</span> : null}
                </span>
              ))}
            </div>
          </div>

          {/* filter bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", flexWrap: "wrap" }}>
            <div style={{
              flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg1)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "9px 14px",
            }}>
              <span style={{ color: "var(--text3)", fontSize: 14 }}>⌕</span>
              <input
                type="text"
                placeholder="Search agents, capabilities..."
                style={{
                  background: "none", border: "none", outline: "none",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)",
                  flex: 1, fontWeight: 300,
                }}
              />
            </div>
            {["All","Data","Code","Research","Trading","Content"].map(f => (
              <button key={f} style={{
                padding: "7px 14px", borderRadius: 99,
                border: `1px solid ${f === "All" ? "var(--gold)" : "var(--border)"}`,
                background: f === "All" ? "rgba(212,170,80,.06)" : "var(--bg1)",
                color: f === "All" ? "var(--gold)" : "var(--text2)",
                fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}>{f}</button>
            ))}
          </div>

          {/* agent grid */}
          {loadingAgents && (
            <p style={{ fontSize: 13, color: "var(--text3)", padding: "40px 0", fontFamily: "'DM Mono', monospace" }}>
              <span className="spinner" />Loading agents...
            </p>
          )}
          {!loadingAgents && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16, padding: "8px 0 80px",
            }}>
              {displayAgents.map((agent, i) => (
                <div key={i} style={{
                  background: "var(--bg1)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: 24, cursor: "pointer",
                  transition: "border-color .2s, transform .2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                >
                  {/* top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, border: "1px solid var(--border)",
                      display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0,
                      background: "linear-gradient(135deg, var(--bg2), var(--bg3))",
                    }}>
                      {agent.emoji ?? "🤖"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-syne), sans-serif", fontWeight: 600,
                        fontSize: 15, letterSpacing: "-.01em",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{agent.name ?? `Agent #${i + 1}`}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                        {agent.owner} · ERC-8004
                      </div>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      padding: "4px 8px", borderRadius: 99,
                      color:       agent.status === "active" ? "var(--green)" : "var(--gold-dim)",
                      border:      agent.status === "active" ? "1px solid rgba(78,203,141,.25)" : "1px solid var(--border)",
                      background:  agent.status === "active" ? "rgba(78,203,141,.06)" : "rgba(212,170,80,.04)",
                    }}>
                      {agent.status === "active"
                        ? <><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />Active</>
                        : <>○ Idle</>
                      }
                    </div>
                  </div>

                  {/* tags */}
                  {agent.tags && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                      {agent.tags.map((t: string) => (
                        <span key={t} style={{
                          padding: "3px 8px", borderRadius: 4,
                          fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)",
                          background: "var(--bg2)", border: "1px solid var(--border)",
                        }}>{t}</span>
                      ))}
                    </div>
                  )}

                  {/* meta */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    paddingTop: 16, borderTop: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{
                        fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                        fontSize: 22, color: "var(--gold-hi)",
                      }}>{agent.reputation ?? 1}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", letterSpacing: ".06em" }}>REP</span>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>
                      {agent.tasks ?? 0} tasks
                    </span>
                    <button style={{
                      padding: "7px 16px", borderRadius: 6,
                      background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)",
                      color: "var(--gold)", fontSize: 12, fontWeight: 500,
                      fontFamily: "var(--font-syne), sans-serif", cursor: "pointer",
                    }}>Hire →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ PAGE: TASKS ═══════════════════════════════════════ */}
      {page === "tasks" && (
        <div style={S.container}>

          {/* header */}
          <div style={{ padding: "60px 0 40px", borderBottom: "1px solid var(--border)" }}>
            <h1 style={{
              fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
              fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05,
            }}>
              Task{" "}
              <span style={{
                background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>Marketplace</span>
            </h1>
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              {["8 open tasks", "USDC escrow", "Reputation-gated"].map(s => (
                <span key={s} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>{s}</span>
              ))}
            </div>
          </div>

          {/* two-col layout */}
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px",
            gap: 24, padding: "32px 0 80px", alignItems: "start",
          }}>

            {/* tasks list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
	    {displayTasks.length === 0 && (
             <div style={{
             padding: "60px 24px", textAlign: "center",
            color: "var(--text3)", fontFamily: "'DM Mono', monospace", fontSize: 13,
          }}>
            No tasks yet. Be the first to post one.
          </div>
          )}
              {displayTasks.map((task, i) => {
                const isCreator = Boolean(address && task.creatorAddress && task.creatorAddress.toLowerCase() === address.toLowerCase());
                const isAgent = Boolean(address && task.agentAddress && task.agentAddress.toLowerCase() === address.toLowerCase());
                const canAssign = task.status === "open" && !task.agentId;
                const canStart = task.status === "assigned" && isAgent;
                const canComplete = task.status === "in_progress" && isAgent;
                const canPay = task.status === "completed" && isCreator;

                const statusLabelMap: Record<Task["status"], string> = {
                  open: "● Open",
                  assigned: "◎ Assigned",
                  in_progress: "◔ In Progress",
                  completed: "✓ Completed",
                  paid: "◆ Paid",
                };

                const statusToneMap: Record<Task["status"], { color: string; border: string; background: string }> = {
                  open: {
                    color: "var(--green)",
                    border: "1px solid rgba(78,203,141,.25)",
                    background: "rgba(78,203,141,.05)",
                  },
                  assigned: {
                    color: "var(--gold)",
                    border: "1px solid var(--border-hi)",
                    background: "rgba(212,170,80,.06)",
                  },
                  in_progress: {
                    color: "var(--blue)",
                    border: "1px solid rgba(90,156,245,.25)",
                    background: "rgba(90,156,245,.05)",
                  },
                  completed: {
                    color: "var(--green)",
                    border: "1px solid rgba(78,203,141,.25)",
                    background: "rgba(78,203,141,.05)",
                  },
                  paid: {
                    color: "var(--gold-hi)",
                    border: "1px solid rgba(212,170,80,.3)",
                    background: "rgba(212,170,80,.08)",
                  },
                };

                return (
                  <div key={i} style={{
                    background: "var(--bg1)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: 24, cursor: "pointer",
                    transition: "border-color .2s, transform .15s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div style={{
                        fontFamily: "var(--font-syne), sans-serif", fontWeight: 600,
                        fontSize: 15, letterSpacing: "-.01em",
                      }}>{task.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: "var(--gold-hi)" }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: "linear-gradient(135deg, #2775ca, #5b9cf6)",
                          display: "grid", placeItems: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                        }}>$</div>
                        {task.reward} USDC
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 14 }}>{task.description}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          ...statusToneMap[task.status],
                        }}>{statusLabelMap[task.status]}</span>
                        <span style={{
  padding: "3px 8px", borderRadius: 4,
  fontFamily: "'DM Mono', monospace", fontSize: 10,
  color: task.escrowFundingState === "submitted" ? "var(--green)"
       : task.escrowFundingState === "error" ? "var(--red)"
       : "var(--gold-dim)",
  border: task.escrowFundingState === "submitted" ? "1px solid rgba(78,203,141,.25)"
        : task.escrowFundingState === "error" ? "1px solid rgba(232,84,84,.25)"
        : "1px solid var(--border)",
  background: task.escrowFundingState === "submitted" ? "rgba(78,203,141,.05)"
            : task.escrowFundingState === "error" ? "rgba(232,84,84,.05)"
            : "rgba(212,170,80,.04)",
}}>
  {task.escrowFundingState === "submitted" ? "⬡ Funded"
   : task.escrowFundingState === "error" ? "⬡ Escrow error"
   : "○ Escrow locked"}
</span>
                        <span style={{ padding: "3px 8px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--blue)", border: "1px solid rgba(90,156,245,.25)", background: "rgba(90,156,245,.05)" }}>Rep ≥ {task.minRep ?? 50}</span>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>{task.ago ?? "recently"}</span>
                    </div>

                    {canAssign && (
                      <button
                        onClick={() => {
                          if (!isConnected) {
                            setAssignStatus("Connect wallet to assign");
                            return;
                          }
                          setShowAssignModal(task.id);
                        }}
                        disabled={!isConnected}
                        style={{
                          marginTop: 12, padding: "7px 16px", borderRadius: 6,
                          background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)",
                          color: "var(--gold)", fontSize: 12, fontWeight: 500,
                          fontFamily: "var(--font-syne), sans-serif",
                          cursor: !isConnected ? "not-allowed" : "pointer",
                          opacity: !isConnected ? 0.65 : 1,
                        }}
                      >
                        Assign Agent →
                      </button>
                    )}

                    {canStart && (
                      <button
                        onClick={() => void handleStatusUpdate(task.id, "in_progress")}
                        disabled={assigning}
                        style={{
                          marginTop: 12, padding: "7px 16px", borderRadius: 6,
                          background: "rgba(90,156,245,.1)", border: "1px solid rgba(90,156,245,.3)",
                          color: "var(--blue)", fontSize: 12, fontWeight: 500,
                          fontFamily: "var(--font-syne), sans-serif", cursor: "pointer",
                          opacity: assigning ? 0.65 : 1,
                        }}
                      >
                        Start Work →
                      </button>
                    )}

                    {canComplete && (
                      <button
                        onClick={() => void handleStatusUpdate(task.id, "completed")}
                        disabled={assigning}
                        style={{
                          marginTop: 12, padding: "7px 16px", borderRadius: 6,
                          background: "rgba(78,203,141,.08)", border: "1px solid rgba(78,203,141,.25)",
                          color: "var(--green)", fontSize: 12, fontWeight: 500,
                          fontFamily: "var(--font-syne), sans-serif", cursor: "pointer",
                          opacity: assigning ? 0.65 : 1,
                        }}
                      >
                        Submit Complete →
                      </button>
                    )}

                    {canPay && (
                      <button
                        onClick={() => void handleStatusUpdate(task.id, "paid")}
                        disabled={assigning}
                        style={{
                          marginTop: 12, padding: "7px 16px", borderRadius: 6,
                          background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)",
                          color: "var(--gold-hi)", fontSize: 12, fontWeight: 500,
                          fontFamily: "var(--font-syne), sans-serif", cursor: "pointer",
                          opacity: assigning ? 0.65 : 1,
                        }}
                      >
                        Release Payment →
                      </button>
                    )}

                    {task.agentId && (
                      <div style={{
                        marginTop: 12, padding: "7px 12px", borderRadius: 6,
                        background: "rgba(78,203,141,.06)", border: "1px solid rgba(78,203,141,.25)",
                        fontSize: 11, color: "var(--green)", fontFamily: "'DM Mono', monospace",
                      }}>
                        Agent · {task.agentAddress?.slice(0, 10)}...
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Assign Modal */}
              {showAssignModal && (
                <div style={{
                  position: "fixed", inset: 0, zIndex: 200,
                  background: "rgba(0,0,0,.7)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(4px)",
                }}
                  onClick={() => setShowAssignModal(null)}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: "var(--bg1)", border: "1px solid var(--border-hi)",
                      borderRadius: 16, padding: 32, width: "100%", maxWidth: 480,
                      margin: "0 24px",
                    }}
                  >
                    <div style={{
                      fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                      fontSize: 18, letterSpacing: "-.02em", marginBottom: 4,
                    }}>Assign Agent</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 24 }}>
                      Select a registered agent for this task
                    </div>
                    {agents.length === 0 && (
                      <p style={{ fontSize: 13, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
                        No agents registered yet.
                      </p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                      {agents.map((agent, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!showAssignModal || !agent.id || !agent.owner) return;
                            handleAssign(showAssignModal, agent.id, agent.owner);
                          }}
                          disabled={assigning}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 16px", borderRadius: 10,
                            background: "var(--bg2)", border: "1px solid var(--border)",
                            cursor: "pointer", textAlign: "left",
                            transition: "border-color .15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hi)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                        >
                          <div>
                            <div style={{
                              fontFamily: "var(--font-syne), sans-serif", fontWeight: 600,
                              fontSize: 13, color: "var(--text)", marginBottom: 4,
                            }}>Agent #{i + 1}</div>
                            <div style={{
                              fontFamily: "'DM Mono', monospace", fontSize: 10,
                              color: "var(--text3)",
                            }}>{agent.owner?.slice(0, 20)}...</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{
                              fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                              fontSize: 18, color: "var(--gold-hi)",
                            }}>{agent.reputation ?? 1}</span>
                            <span style={{
                              fontFamily: "'DM Mono', monospace", fontSize: 9,
                              color: "var(--text3)", letterSpacing: ".06em",
                            }}>REP</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {assignStatus && (
                      <p style={{ marginTop: 12, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
                        {assignStatus}
                      </p>
                    )}
                    <button
                      onClick={() => setShowAssignModal(null)}
                      style={{
                        marginTop: 16, width: "100%", padding: "10px",
                        background: "none", border: "1px solid var(--border)",
                        borderRadius: 8, color: "var(--text3)", cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* post task panel */}
            <div style={{
              background: "var(--bg1)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 28, position: "sticky", top: 80,
            }}>
              <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginBottom: 4 }}>Post a Task</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 24 }}>USDC is locked in escrow until task completion</div>
              <button
                onClick={() => void authenticateWallet()}
                disabled={!isConnected || authenticating || isAuthed}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  color: isAuthed ? "var(--green)" : "var(--gold)",
                  cursor: !isConnected || authenticating || isAuthed ? "not-allowed" : "pointer",
                  opacity: !isConnected || authenticating || isAuthed ? 0.65 : 1,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                }}
              >
                {authenticating
                  ? "Authenticating..."
                  : isAuthed
                    ? "Wallet Authenticated"
                    : "Authenticate Wallet"}
              </button>

              {(["title","description","reward"] as const).map(field => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                    {field === "reward" ? "USDC Reward" : field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  {field === "description" ? (
                    <textarea
                      value={taskForm[field]}
                      onChange={e => setTaskForm(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={field === "description" ? "Describe deliverables and timeline..." : ""}
                      style={{
                        width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
                        borderRadius: 6, padding: "10px 12px",
                        fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)",
                        outline: "none", resize: "vertical", minHeight: 80, fontWeight: 300,
                      }}
                    />
                  ) : (
                    <div style={{ position: "relative" }}>
                      {field === "reward" && (
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--gold-dim)" }}>$</span>
                      )}
                      <input
                        type={field === "reward" ? "number" : "text"}
                        value={taskForm[field]}
                        onChange={e => setTaskForm(p => ({ ...p, [field]: e.target.value }))}
                        placeholder={field === "title" ? "e.g. Audit my staking contract" : "0.00"}
                        style={{
                          width: "100%", background: "var(--bg)",
                          border: `1px solid ${field === "reward" ? "var(--border-hi)" : "var(--border)"}`,
                          borderRadius: 6,
                          padding: field === "reward" ? "10px 12px 10px 28px" : "10px 12px",
                          fontFamily: field === "reward" ? "'DM Mono', monospace" : "'Inter', sans-serif",
                          fontSize: field === "reward" ? 14 : 13,
                          color: field === "reward" ? "var(--gold-hi)" : "var(--text)",
                          outline: "none", fontWeight: field === "reward" ? 500 : 300,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* rep slider */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                  Min Rep Score — <span style={{ color: "var(--gold)" }}>{taskForm.minRep}</span>
                </label>
                <input
                  type="range" min={0} max={100} value={taskForm.minRep}
                  onChange={e => setTaskForm(p => ({ ...p, minRep: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "var(--gold)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                  <span>0</span><span>100</span>
                </div>
              </div>

              <button
                onClick={handlePostTask}
                disabled={postingTask || !isConnected}
                style={{
                  width: "100%", padding: 13,
                  background: "linear-gradient(135deg, var(--gold), var(--amber))",
                  color: "#0a0905", border: "none",
                  cursor: postingTask || !isConnected ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                  fontSize: 14, letterSpacing: ".04em", borderRadius: 10,
                  opacity: postingTask || !isConnected ? 0.6 : 1,
                  boxShadow: "0 4px 20px rgba(212,170,80,.2)",
                }}
              >
                {postingTask ? <><span className="spinner" />Posting...</> : isConnected ? "Lock Escrow & Post Task →" : "Connect Wallet to Post"}
              </button>

              {!isConnected && (
                <p style={{ marginTop: 10, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
                  Connect wallet to post.
                </p>
              )}

              {taskStatus && (
                <p style={{ marginTop: 10, fontSize: 12, color: taskStatus.startsWith("Error") ? "var(--red)" : "var(--green)", fontFamily: "'DM Mono', monospace" }}>{taskStatus}</p>
              )}
              {authStatus && (
                <p style={{ marginTop: 8, fontSize: 11, color: authStatus.startsWith("Error") ? "var(--red)" : "var(--text3)", fontFamily: "'DM Mono', monospace" }}>
                  {authStatus}
                </p>
              )}

              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14,
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(212,170,80,.04)", border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 12, color: "var(--gold-dim)", flexShrink: 0, marginTop: 1 }}>🔒</span>
                <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.55 }}>
                  USDC is held in a Circle developer-controlled wallet and released only after onchain validation of task completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "20px 0", position: "relative", zIndex: 1,
      }}>
        <div style={{
          ...S.container,
          display: "flex",
          justifyContent: isMobile ? "center" : "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>@devajibola · AgentVault</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>ERC-8004 · Arc Testnet</span>
        </div>
      </footer>

    </div>
  );
}
