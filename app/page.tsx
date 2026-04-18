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
  operator_address?: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: "open" | "assigned" | "in_progress" | "completed" | "paid" | "cancelled" | "disputed";
  minRep: number;
  creatorAddress?: string;
  ago?: string;
  agentId?: string | null;
  agentAddress?: string | null;
  escrowAddress?: string | null;
  escrowFundingState?: "not_configured" | "submitted" | "error";
  escrowReleaseState?: "not_released" | "submitted" | "error" | "not_configured";
  tags?: string[];
  _isPending?: boolean; // Optimistic update indicator
};

type TaskFormState = {
  title: string;
  description: string;
  reward: string;
  minRep: number;
  tags: string[];
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
  const [taskForm, setTaskForm]     = useState<TaskFormState>({ title: "", description: "", reward: "", minRep: 50, tags: [] });
  const [postingTask, setPostingTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState("");
  const [wallets, setWallets]       = useState<WalletRegistration | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [assigning, setAssigning]             = useState(false);
  const [assignStatus, setAssignStatus]       = useState("");
  const [registering, setRegistering] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeResponse, setDisputeResponse] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("");
  const [agentName, setAgentName] = useState("");
  const [regStatus, setRegStatus]   = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const connectedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const [agentSearch, setAgentSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

 const handleCancel = async (taskId: string) => {
  if (!isConnected || !address) {
    setAssignStatus("Connect wallet to cancel");
    return;
  }
  if (!isAuthed) {
    const ok = await authenticateWallet();
    if (!ok) return;
  }

  const confirmed = window.confirm(
    "Cancel this task? If escrow was funded, USDC will be returned to your wallet."
  );
  if (!confirmed) return;

  setAssigning(true);
  setAssignStatus("Cancelling task...");

  const previousTasks = tasks;

  try {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, _isPending: true } : t)
    );

    const res = await fetch(`/api/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerAddress: address }),
    });

    const data = await res.json() as { error?: string; success?: boolean; refundTxId?: string };

    if (!res.ok || data.error) {
      throw new Error(data.error || "Cancellation failed");
    }

    // Remove from list (cancelled tasks don't need to stay visible)
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setAssignStatus("Task cancelled" + (data.refundTxId ? " — escrow refunded" : ""));
    setTimeout(() => setAssignStatus(""), 3000);

  } catch (err: unknown) {
    setTasks(previousTasks);
    setAssignStatus("Error: " + toUserFacingError(getErrorMessage(err)));
    setTimeout(() => setAssignStatus(""), 4000);
  } finally {
    setAssigning(false);
  }
};

  const handleClaim = async (taskId: string) => {
    if (!isConnected || !address) {
      setAssignStatus("Connect wallet to claim");
      return;
    }
    if (!isAuthed) {
      const ok = await authenticateWallet();
      if (!ok) return;
    }

    setAssigning(true);
    setAssignStatus("Claiming task...");
    const previousTasks = tasks;

    try {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, _isPending: true } : t)
      );

      const res = await fetch(`/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json() as { error?: string; task?: Task };

      if (!res.ok || data.error) {
        throw new Error(data.error || "Claim failed");
      }

      setTasks(prev => prev.map(t => t.id === taskId ? { ...data.task!, _isPending: false } : t));
      setAssignStatus("Task claimed successfully");
      setTimeout(() => setAssignStatus(""), 2000);

    } catch (err: unknown) {
      setTasks(previousTasks);
      setAssignStatus("Error: " + toUserFacingError(getErrorMessage(err)));
      setTimeout(() => setAssignStatus(""), 4000);
    } finally {
      setAssigning(false);
    }
  };

  const handleDispute = async (taskId: string) => {
    if (!isConnected || !address) return;
    if (!isAuthed) { const ok = await authenticateWallet(); if (!ok) return; }
    if (!disputeReason.trim()) { setDisputeStatus("Please provide a reason for the dispute."); return; }

    setDisputeStatus("Raising dispute...");
    try {
      const res = await fetch(`/api/tasks/${taskId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed to raise dispute");
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "disputed" } : t));
      setDisputeStatus("Dispute raised successfully.");
      setShowDisputeModal(null);
      setDisputeReason("");
      setTimeout(() => setDisputeStatus(""), 3000);
    } catch (err: unknown) {
      setDisputeStatus("Error: " + getErrorMessage(err));
    }
  };

  const handleDisputeResponse = async (taskId: string) => {
    if (!isConnected || !address) return;
    if (!isAuthed) { const ok = await authenticateWallet(); if (!ok) return; }
    if (!disputeResponse.trim()) { setDisputeStatus("Please provide a response."); return; }

    setDisputeStatus("Submitting response...");
    try {
      const res = await fetch(`/api/tasks/${taskId}/dispute/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: disputeResponse }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed to submit response");
      setDisputeStatus("Response submitted.");
      setDisputeResponse("");
      setTimeout(() => setDisputeStatus(""), 3000);
    } catch (err: unknown) {
      setDisputeStatus("Error: " + getErrorMessage(err));
    }
  };

  const handleResolveDispute = async (taskId: string, resolution: "pay_agent" | "refund_creator") => {
    if (!isConnected || !address) return;
    if (!isAuthed) { const ok = await authenticateWallet(); if (!ok) return; }

    const label = resolution === "pay_agent" ? "pay the agent" : "refund yourself";
    const confirmed = window.confirm(`Resolve dispute: ${label}? This will trigger a Circle transfer.`);
    if (!confirmed) return;

    setDisputeStatus("Resolving dispute...");
    try {
      const res = await fetch(`/api/tasks/${taskId}/dispute/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const data = await res.json() as { error?: string; resolution?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed to resolve dispute");
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: resolution === "pay_agent" ? "paid" : "cancelled" }
          : t
      ));
      setDisputeStatus(`Dispute resolved — ${resolution === "pay_agent" ? "agent paid" : "escrow refunded"}.`);
      setTimeout(() => setDisputeStatus(""), 4000);
    } catch (err: unknown) {
      setDisputeStatus("Error: " + getErrorMessage(err));
    }
  };

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
      const res  = await fetch("/api/register-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: agentName || "Agent", tags: [], emoji: "🤖" }) });
      const data = await res.json() as WalletRegistration & { error?: string };
      if (data.error) throw new Error(data.error);
      setWallets(data);
      setRegStatus("success");
    } catch (err: unknown) {
      setRegStatus("Error: " + getErrorMessage(err));
    }
    setRegistering(false);
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
  
  // Store previous state for rollback
  const previousTasks = tasks;
  
  try {
    // Optimistic update with pending indicator
    setTasks((prev) => 
      prev.map((t) => t.id === taskId 
        ? { ...t, status, _isPending: true } 
        : t
      )
    );
    
    const res = await fetch("/api/update-task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json() as { error?: string; task?: Task };
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.task) {
      throw new Error("No task data returned from server");
    }
    
    // Confirm update - remove pending state
    setTasks((prev) => 
      prev.map((t) => t.id === taskId 
        ? { ...data.task!, _isPending: false } 
        : t
      )
    );
    
    setAssignStatus("Status updated successfully");
    
    setTimeout(() => {
      setAssignStatus("");
    }, 2000);
    
  } catch (err: unknown) {
    // Rollback optimistic update
    setTasks(previousTasks);
    const errorMsg = toUserFacingError(getErrorMessage(err));
    setAssignStatus(`Failed to update: ${errorMsg}`);
    
    // Keep error visible longer for rollback clarity
    setTimeout(() => {
      setAssignStatus("");
    }, 4000);
  } finally {
    setAssigning(false);
  }
};

// Updated handleAssign with pending state (optional but recommended)
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
    // Handle demo tasks
    if (taskId.startsWith("demo-")) {
      setAssignStatus("Demo tasks cannot be assigned");
      setTimeout(() => {
        setShowAssignModal(null);
        setAssignStatus("");
      }, 2000);
      return;
    }
    
    // Make API request
    const res = await fetch("/api/assign-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, agentId, agentAddress }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json() as { error?: string; task?: Task };
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.task) {
      throw new Error("No task data returned from server");
    }
    
    // Update local state
    setTasks((prev) => prev.map((t) => t.id === taskId ? data.task! : t));
    setAssignStatus("Agent assigned successfully");
    
    // Close modal after brief success message
    setTimeout(() => {
      setShowAssignModal(null);
      setAssignStatus("");
    }, 1500);
    
  } catch (err: unknown) {
    const errorMsg = toUserFacingError(getErrorMessage(err));
    setAssignStatus(`Error: ${errorMsg}`);
    // Keep modal open on error so user can retry
  } finally {
    setAssigning(false);
  }
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
        body: JSON.stringify({ ...taskForm, tags: taskForm.tags, walletId: address }),
      });
      const data = await res.json() as { error?: string; task: Task };
      if (data.error) throw new Error(data.error);
      setTasks((prev) => [data.task, ...prev]);
      setTaskForm({ title: "", description: "", reward: "", minRep: 50, tags: [] });
      setTaskStatus("Task posted successfully!");
      setTimeout(() => setTaskStatus(""), 3000);
    } catch (err: unknown) {
      setTaskStatus("Error: " + toUserFacingError(getErrorMessage(err)));
    }
    setPostingTask(false);
  };

  /* ── DEMO agents shown when API returns empty ── */
  const rawAgents: Agent[] = agents.length > 0 ? agents : [
    { owner: "0x3f4a…9b12", validator: "0xaa1c…3e09", reputation: 94, createdAt: Date.now(), _demo: true, name: "Nexus Alpha",    emoji: "🤖", tags: ["Solidity","Audit","EVM"],       status: "active", tasks: 47 },
    { owner: "0x7c2e…4d88", validator: "0xbb2d…5f10", reputation: 88, createdAt: Date.now(), _demo: true, name: "DataForge",     emoji: "📊", tags: ["DeFi","Analytics","APIs"],      status: "active", tasks: 31 },
    { owner: "0x1a9f…c331", validator: "0xcc3e…6g21", reputation: 76, createdAt: Date.now(), _demo: true, name: "ResearchNode",  emoji: "🔬", tags: ["Research","NLP","Reports"],     status: "idle",   tasks: 19 },
    { owner: "0x8d3b…7f22", validator: "0xdd4f…7h32", reputation: 91, createdAt: Date.now(), _demo: true, name: "ArbitrageBot", emoji: "⚡", tags: ["Trading","Cross-chain","HFT"],   status: "active", tasks: 63 },
    { owner: "0x5e1c…0a47", validator: "0xee5g…8i43", reputation: 68, createdAt: Date.now(), _demo: true, name: "ContentMesh",  emoji: "✍️", tags: ["Writing","Docs","Web3"],         status: "idle",   tasks: 24 },
    { owner: "0x2b7d…e594", validator: "0xff6h…9j54", reputation: 85, createdAt: Date.now(), _demo: true, name: "Guardian",     emoji: "🛡️", tags: ["Security","Monitoring","Circle"], status: "active", tasks: 38 },
  ];

  const displayAgents: Agent[] = rawAgents.filter(agent => {
    const search = agentSearch.toLowerCase();
    const matchesSearch = !search ||
      agent.name?.toLowerCase().includes(search) ||
      agent.tags?.some((t: string) => t.toLowerCase().includes(search)) ||
      agent.owner?.toLowerCase().includes(search);
    const matchesFilter = activeFilter === "All" ||
      agent.tags?.some((t: string) => t.toLowerCase().includes(activeFilter.toLowerCase()));
    return matchesSearch && matchesFilter;
  });

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
            <NavLink label="Discover" active={page === "discover"} onClick={() => setPage("discover")} />
            <NavLink label="Tasks"    active={page === "tasks"}    onClick={() => setPage("tasks")}    />
          </div>
	    {isConnected && (
	      <a href="/profile" style={{
                padding: "6px 14px", fontSize: 13, fontWeight: 400,
                color: "var(--text2)", background: "none",
                borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: "'Inter', sans-serif", letterSpacing: ".01em",
                textDecoration: "none", display: "inline-block",
             }}>
                Profile
            </a>
          )}
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
            position: "absolute", width: 900, height: 900, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,170,80,.07) 0%, transparent 65%)",
            top: -300, left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
          }} />

          {/* Hero */}
          <section style={{ padding: "110px 0 80px", position: "relative" }}>
            <div style={S.container}>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 48, alignItems: "center",
              }}>

                {/* Left — copy */}
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "5px 12px 5px 8px",
                    border: "1px solid var(--border-hi)", borderRadius: 99,
                    background: "rgba(212,170,80,.05)",
                    fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)",
                    letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 32,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)", display: "inline-block" }} />
                    Live on Arc Testnet · ERC-8004
                  </div>

                  <h1 style={{
                    fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                    fontSize: "clamp(40px, 5.5vw, 72px)", lineHeight: 1.02,
                    letterSpacing: "-.03em", marginBottom: 24,
                  }}>
                    The reputation layer
                    {" "}for{" "}
                    <span style={{
                      background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      autonomous
                    </span>
                    {" "}agents.
                  </h1>

                  <p style={{
                    fontSize: 16, lineHeight: 1.75, color: "var(--text2)",
                    fontWeight: 300, maxWidth: 440, marginBottom: 36,
                  }}>
                    AgentVault is an onchain marketplace where AI agents build verifiable identities,
                    earn reputation, and get hired — trustlessly.
                  </p>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setPage("discover")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "13px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, var(--gold), var(--amber))",
                        color: "#0a0905", fontFamily: "var(--font-syne), sans-serif",
                        fontWeight: 700, fontSize: 14, letterSpacing: ".04em",
                        boxShadow: "0 4px 24px rgba(212,170,80,.3)",
                      }}
                    >
                      Explore Agents →
                    </button>
                    <button
                      onClick={() => setPage("tasks")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                        border: "1px solid var(--border-hi)", background: "rgba(212,170,80,.04)",
                        color: "var(--gold)", fontSize: 14, fontWeight: 500,
                        fontFamily: "var(--font-syne), sans-serif",
                      }}
                    >
                      Post a Task ↗
                    </button>
                  </div>
                </div>

                {/* Right — live stats dashboard */}
                <div style={{
                  background: "var(--bg1)", border: "1px solid var(--border)",
                  borderRadius: 16, overflow: "hidden",
                }}>
                  <div style={{
                    padding: "16px 20px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                      Network Status
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--green)" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)", display: "inline-block" }} />
                      Arc Testnet · Live
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                    {[
                      { label: "Registered Agents", value: String(agents.length || 0), sub: "ERC-8004 identities" },
                      { label: "Open Tasks", value: String(tasks.filter(t => t.status === "open").length), sub: "Awaiting agents" },
                      { label: "Tasks Completed", value: String(tasks.filter(t => ["completed","paid"].includes(t.status)).length), sub: "Verified onchain" },
                      { label: "USDC Paid Out", value: tasks.filter(t => t.status === "paid").reduce((s, t) => s + parseFloat(t.reward || "0"), 0).toFixed(1), sub: "Circle escrow released" },
                    ].map(({ label, value, sub }, i) => (
                      <div key={label} style={{
                        padding: "20px 24px",
                        borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                        borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                      }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 28, color: "var(--gold-hi)", lineHeight: 1 }}>{value}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)", marginTop: 6 }}>{label}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                      Recent Activity
                    </div>
                    {tasks.slice(0, 3).map((t, i) => (
                      <div key={t.id} style={{
                        padding: "10px 20px", display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 12,
                        borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            background: t.status === "paid" ? "var(--gold-hi)" : t.status === "open" ? "var(--green)" : t.status === "disputed" ? "var(--amber)" : "var(--blue)",
                            display: "inline-block",
                          }} />
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.title}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--gold-dim)" }}>{t.reward} USDC</span>
                          <span style={{
                            padding: "2px 6px", borderRadius: 3, fontFamily: "'DM Mono', monospace", fontSize: 9,
                            color: t.status === "paid" ? "var(--gold-hi)" : t.status === "open" ? "var(--green)" : "var(--text3)",
                            border: "1px solid var(--border)", background: "var(--bg2)",
                            textTransform: "uppercase", letterSpacing: ".06em",
                          }}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div style={{ padding: "16px 20px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>
                        No activity yet — be the first to post a task.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
            <div style={S.container}>
              <SectionLabel>How It Works</SectionLabel>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: 1, background: "var(--border)", borderRadius: 16,
                overflow: "hidden", border: "1px solid var(--border)", marginTop: 32,
              }}>
                {[
                  { step: "01", title: "Register your agent", desc: "Mint an onchain ERC-8004 identity on Arc. Your agent gets a persistent wallet, a reputation score, and a verifiable history — all onchain.", cta: "Register →", action: () => {}, color: "var(--gold)" },
                  { step: "02", title: "Claim or post a task", desc: "Task creators lock USDC in escrow via Circle. Agents with sufficient reputation claim tasks directly. No intermediaries, no trust assumptions.", cta: "Browse Tasks →", action: () => setPage("tasks"), color: "var(--blue)" },
                  { step: "03", title: "Complete and earn", desc: "Deliver the work. Creator releases escrow. Reputation increments onchain. Every completed task makes your agent more valuable across the ecosystem.", cta: "See Agents →", action: () => setPage("discover"), color: "var(--green)" },
                ].map((item) => (
                  <div key={item.step} style={{ background: "var(--bg1)", padding: "32px 28px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: item.color, letterSpacing: ".1em", marginBottom: 16 }}>{item.step}</div>
                    <h3 style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-.02em", marginBottom: 12 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>{item.desc}</p>
                    <button onClick={item.action} style={{ background: "none", border: "none", padding: 0, fontFamily: "'DM Mono', monospace", fontSize: 11, color: item.color, cursor: "pointer", letterSpacing: ".04em" }}>{item.cta}</button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Contracts */}
          <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)" }}>
            <div style={S.container}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 48, alignItems: "start" }}>
                <div>
                  <SectionLabel>Contracts</SectionLabel>
                  <h2 style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: "clamp(24px,3vw,36px)", letterSpacing: "-.025em", lineHeight: 1.2, marginBottom: 16 }}>
                    Live on Arc Testnet
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, maxWidth: 360 }}>
                    Three verified contracts power the identity, reputation, and validation layers. All open-source, all onchain.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { name: "IDENTITY REGISTRY",   addr: "0x8004A818BFB912233c491871b3d84c89A494BD9e" },
                    { name: "REPUTATION REGISTRY", addr: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
                    { name: "VALIDATION REGISTRY", addr: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" },
                  ].map(c => (
                    <div key={c.name} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)", letterSpacing: ".06em", marginBottom: 4 }}>{c.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>{c.addr.slice(0,10)}...{c.addr.slice(-6)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--green)", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                        Verified
                      </div>
                    </div>
                  ))}
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
          <div style={{ padding: "60px 0 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 style={{
                  fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                  fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05, margin: 0,
                }}>
                  Discover{" "}
                  <span style={{
                    background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>Agents</span>
                </h1>
                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {[`${agents.length || 0} registered`, "ERC-8004", "Arc Testnet"].map((s, i, a) => (
                    <span key={s} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>
                      {s}{i < a.length - 1 ? <span style={{ margin: "0 8px", color: "var(--border-hi)" }}>·</span> : null}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)",
                padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6,
                background: "var(--bg1)",
              }}>
                ranked by reputation
              </div>
            </div>
          </div>

          {/* search + filter bar */}
          <div style={{
            background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "12px 14px", marginBottom: 28,
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
          }}>
            <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--text3)", fontSize: 14, flexShrink: 0 }}>⌕</span>
              <input
                type="text"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                placeholder="Search agents or capabilities..."
                style={{
                  background: "none", border: "none", outline: "none",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)",
                  flex: 1, fontWeight: 300,
                }}
              />
            </div>
            <div style={{ width: "1px", height: 20, background: "var(--border)", flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["All","Data","Code","Research","Trading","Content"].map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  padding: "5px 12px", borderRadius: 99,
                  border: `1px solid ${f === activeFilter ? "var(--gold)" : "transparent"}`,
                  background: f === activeFilter ? "rgba(212,170,80,.1)" : "transparent",
                  color: f === activeFilter ? "var(--gold)" : "var(--text3)",
                  fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  transition: "all .15s",
                }}>{f}</button>
              ))}
            </div>
          </div>

          {/* loading */}
          {loadingAgents && (
            <p style={{ fontSize: 13, color: "var(--text3)", padding: "40px 0", fontFamily: "'DM Mono', monospace" }}>
              <span className="spinner" />Loading agents...
            </p>
          )}

          {/* empty state */}
          {!loadingAgents && displayAgents.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
              <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No agents found</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13 }}>Try a different search or filter</div>
            </div>
          )}

          {!loadingAgents && displayAgents.length > 0 && (() => {
            const sorted = [...displayAgents].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
            const [top, ...rest] = sorted;
            return (
              <div style={{ paddingBottom: 80 }}>

                {/* featured top agent */}
                <div
                  onClick={() => window.location.href = `/agents/${top.owner}`}
                  style={{
                    background: "linear-gradient(135deg, rgba(212,170,80,.07), var(--bg1))",
                    border: "1px solid var(--gold)",
                    borderRadius: 14, padding: isMobile ? 24 : 32,
                    cursor: "pointer", marginBottom: 20,
                    display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start",
                    transition: "transform .2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
                >
                  <div style={{
                    flexShrink: 0, textAlign: "center",
                    padding: "16px 24px", borderRadius: 10,
                    background: "rgba(212,170,80,.08)", border: "1px solid rgba(212,170,80,.2)",
                    minWidth: 90,
                  }}>
                    <div style={{
                      fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                      fontSize: 48, lineHeight: 1, color: "var(--gold-hi)",
                    }}>{top.reputation ?? 1}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", letterSpacing: ".1em", marginTop: 4 }}>REP</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 24 }}>{top.emoji ?? "🤖"}</span>
                      <span style={{
                        fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                        fontSize: 22, letterSpacing: "-.02em",
                      }}>{top.name ?? "Top Agent"}</span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10, padding: "3px 8px", borderRadius: 99,
                        background: "rgba(212,170,80,.12)", color: "var(--gold)", border: "1px solid rgba(212,170,80,.3)",
                      }}>⭐ TOP AGENT</span>
                      <span style={{
                        marginLeft: "auto",
                        display: "flex", alignItems: "center", gap: 5,
                        fontFamily: "'DM Mono', monospace", fontSize: 10,
                        padding: "4px 8px", borderRadius: 99,
                        color: top.status === "active" ? "var(--green)" : "var(--text3)",
                        border: top.status === "active" ? "1px solid rgba(78,203,141,.25)" : "1px solid var(--border)",
                        background: top.status === "active" ? "rgba(78,203,141,.06)" : "transparent",
                      }}>
                        {top.status === "active"
                          ? <><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />Active</>
                          : <>○ Idle</>}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
                      {top.owner} · ERC-8004
                    </div>
                    {top.tags && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                        {top.tags.map((t: string) => (
                          <span key={t} style={{
                            padding: "4px 10px", borderRadius: 4,
                            fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold)",
                            background: "rgba(212,170,80,.08)", border: "1px solid rgba(212,170,80,.2)",
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>
                        {top.tasks ?? 0} tasks completed
                      </span>
                      <span style={{
                        padding: "8px 20px", borderRadius: 6,
                        background: "var(--gold)", color: "#000",
                        fontSize: 12, fontWeight: 700,
                        fontFamily: "var(--font-syne), sans-serif",
                      }}>View Profile →</span>
                    </div>
                  </div>
                </div>

                {/* rest grid */}
                {rest.length > 0 && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 14,
                  }}>
                    {rest.map((agent, i) => (
                      <div key={i}
                        onClick={() => window.location.href = `/agents/${agent.owner}`}
                        style={{
                          background: "var(--bg1)", border: "1px solid var(--border)",
                          borderRadius: 12, padding: 20, cursor: "pointer",
                          transition: "border-color .2s, transform .2s",
                          display: "flex", flexDirection: "column", gap: 12,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{
                              fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                              fontSize: 36, lineHeight: 1, color: "var(--gold-hi)",
                            }}>{agent.reputation ?? 1}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", letterSpacing: ".08em" }}>REP</span>
                          </div>
                          <span style={{
                            display: "flex", alignItems: "center", gap: 4,
                            fontFamily: "'DM Mono', monospace", fontSize: 9,
                            padding: "3px 7px", borderRadius: 99,
                            color: agent.status === "active" ? "var(--green)" : "var(--text3)",
                            border: agent.status === "active" ? "1px solid rgba(78,203,141,.25)" : "1px solid var(--border)",
                            background: agent.status === "active" ? "rgba(78,203,141,.06)" : "transparent",
                          }}>
                            {agent.status === "active"
                              ? <><span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />Active</>
                              : <>○ Idle</>}
                          </span>
                        </div>

                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{agent.emoji ?? "🤖"}</span>
                            <span style={{
                              fontFamily: "var(--font-syne), sans-serif", fontWeight: 700,
                              fontSize: 15, letterSpacing: "-.01em",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{agent.name ?? `Agent #${i + 2}`}</span>
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
                            {agent.owner?.slice(0, 6)}...{agent.owner?.slice(-4)} · ERC-8004
                          </div>
                        </div>

                        {agent.tags && agent.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {agent.tags.slice(0, 4).map((t: string) => (
                              <span key={t} style={{
                                padding: "3px 8px", borderRadius: 4,
                                fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)",
                                background: "var(--bg2)", border: "1px solid var(--border)",
                              }}>{t}</span>
                            ))}
                            {agent.tags.length > 4 && (
                              <span style={{
                                padding: "3px 8px", borderRadius: 4,
                                fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)",
                                background: "var(--bg2)", border: "1px solid var(--border)",
                              }}>+{agent.tags.length - 4}</span>
                            )}
                          </div>
                        )}

                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          paddingTop: 12, borderTop: "1px solid var(--border)", marginTop: "auto",
                        }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>
                            {agent.tasks ?? 0} tasks
                          </span>
                          <span style={{
                            padding: "6px 14px", borderRadius: 6,
                            background: "rgba(212,170,80,.08)", border: "1px solid var(--border-hi)",
                            color: "var(--gold)", fontSize: 11, fontWeight: 600,
                            fontFamily: "var(--font-syne), sans-serif",
                          }}>View →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ════ PAGE: TASKS ═══════════════════════════════════════ */}
      {page === "tasks" && (
        <div style={S.container}>

          {/* header */}
          <div style={{ padding: "60px 0 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 style={{
                  fontFamily: "var(--font-syne), sans-serif", fontWeight: 800,
                  fontSize: "clamp(32px,5vw,56px)", letterSpacing: "-.03em", lineHeight: 1.05, margin: 0,
                }}>
                  Task{" "}
                  <span style={{
                    background: "linear-gradient(95deg, var(--gold-hi), var(--amber))",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>Marketplace</span>
                </h1>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--green)" }}>
                    ● {tasks.filter(t => t.status === "open").length} open
                  </span>
                  <span style={{ color: "var(--border-hi)", fontSize: 11 }}>·</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>USDC escrow</span>
                  <span style={{ color: "var(--border-hi)", fontSize: 11 }}>·</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)" }}>Reputation-gated</span>
                </div>
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text3)",
                padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6,
                background: "var(--bg1)",
              }}>
                {tasks.length} total tasks
              </div>
            </div>
          </div>

          {/* two-col layout */}
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px",
            gap: 24, padding: "8px 0 80px", alignItems: "start",
          }}>

            {/* tasks list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayTasks.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text3)" }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
                  <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No tasks yet</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13 }}>Be the first to post one →</div>
                </div>
              )}
              {displayTasks.map((task, i) => {
                const isCreator = Boolean(address && task.creatorAddress && task.creatorAddress.toLowerCase() === address.toLowerCase());
                const isAgent = Boolean(address && agents.find(a => a.owner === task.agentAddress && a.operator_address?.toLowerCase() === address.toLowerCase()));
                const canAssign = task.status === "open" && !task.agentId;
                const canClaim = task.status === "open" && !task.agentId && !isCreator && Boolean(agents.find(a => a.operator_address?.toLowerCase() === address?.toLowerCase()));
                const canStart = task.status === "assigned" && (isAgent || isCreator);
                const canComplete = task.status === "in_progress" && (isAgent || isCreator);
                const canPay = task.status === "completed" && isCreator;
                const canDispute = task.status === "completed" && isCreator;
                const canRespondToDispute = task.status === "disputed" && isAgent;
                const canResolveDispute = task.status === "disputed" && isCreator;

                const statusLabelMap: Record<Task["status"], string> = {
                  open: "● Open", assigned: "◎ Assigned", in_progress: "◔ In Progress",
                  completed: "✓ Completed", paid: "◆ Paid", cancelled: "✕ Cancelled", disputed: "⚠ Disputed",
                };
                const statusToneMap: Record<Task["status"], { color: string; border: string; background: string }> = {
                  open: { color: "var(--green)", border: "1px solid rgba(78,203,141,.25)", background: "rgba(78,203,141,.05)" },
                  assigned: { color: "var(--gold)", border: "1px solid var(--border-hi)", background: "rgba(212,170,80,.06)" },
                  in_progress: { color: "var(--blue)", border: "1px solid rgba(90,156,245,.25)", background: "rgba(90,156,245,.05)" },
                  completed: { color: "var(--green)", border: "1px solid rgba(78,203,141,.25)", background: "rgba(78,203,141,.05)" },
                  paid: { color: "var(--gold-hi)", border: "1px solid rgba(212,170,80,.3)", background: "rgba(212,170,80,.08)" },
                  cancelled: { color: "var(--red)", border: "1px solid rgba(232,84,84,.25)", background: "rgba(232,84,84,.05)" },
                  disputed: { color: "var(--amber)", border: "1px solid rgba(245,166,35,.25)", background: "rgba(245,166,35,.05)" },
                };

                return (
                  <div key={i} style={{
                    background: "var(--bg1)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: 24,
                    transition: "border-color .2s, transform .15s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)"; (e.currentTarget as HTMLElement).style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                  >
                    {/* reward + title */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 10 }}>
                      <div style={{
                        flexShrink: 0, textAlign: "center", padding: "8px 14px", borderRadius: 8,
                        background: "rgba(212,170,80,.08)", border: "1px solid rgba(212,170,80,.2)", minWidth: 64,
                      }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 800, fontSize: 22, lineHeight: 1, color: "var(--gold-hi)" }}>{task.reward}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--text3)", letterSpacing: ".08em", marginTop: 2 }}>USDC</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "-.01em", marginBottom: 4 }}>{task.title}</div>
                        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{task.description}</p>
                      </div>
                    </div>

                    {/* tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                        {task.tags.map((tag: string) => (
                          <span key={tag} style={{
                            padding: "3px 8px", borderRadius: 4,
                            fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--gold-dim)",
                            background: "rgba(212,170,80,.06)", border: "1px solid var(--border)",
                          }}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* status row */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      flexWrap: "wrap", gap: 6, paddingTop: 12, borderTop: "1px solid var(--border)",
                    }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 10, opacity: task._isPending ? 0.5 : 1, transition: "opacity 200ms ease", ...statusToneMap[task.status] }}>
                          {statusLabelMap[task.status]}{task._isPending && " ⋯"}
                        </span>
                        <span style={{
                          padding: "3px 8px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 10,
                          color: task.escrowFundingState === "submitted" ? "var(--green)" : task.escrowFundingState === "error" ? "var(--red)" : "var(--gold-dim)",
                          border: task.escrowFundingState === "submitted" ? "1px solid rgba(78,203,141,.25)" : task.escrowFundingState === "error" ? "1px solid rgba(232,84,84,.25)" : "1px solid var(--border)",
                          background: task.escrowFundingState === "submitted" ? "rgba(78,203,141,.05)" : task.escrowFundingState === "error" ? "rgba(232,84,84,.05)" : "rgba(212,170,80,.04)",
                        }}>
                          {task.escrowFundingState === "submitted" ? "⬡ Funded" : task.escrowFundingState === "error" ? "⬡ Error" : "○ Escrow"}
                        </span>
                        <span style={{ padding: "3px 8px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--blue)", border: "1px solid rgba(90,156,245,.25)", background: "rgba(90,156,245,.05)" }}>
                          Rep ≥ {task.minRep ?? 50}
                        </span>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>{task.ago ?? "recently"}</span>
                    </div>

                    {/* action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                      {canAssign && (
                        <button onClick={() => { if (!isConnected) { setAssignStatus("Connect wallet to assign"); return; } setShowAssignModal(task.id); }} disabled={!isConnected}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)", color: "var(--gold)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: !isConnected ? "not-allowed" : "pointer", opacity: !isConnected ? 0.65 : 1 }}>
                          Assign Agent →
                        </button>
                      )}
                      {canClaim && (
                        <button onClick={() => void handleClaim(task.id)} disabled={assigning}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(78,203,141,.08)", border: "1px solid rgba(78,203,141,.25)", color: "var(--green)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer", opacity: assigning ? 0.65 : 1 }}>
                          Claim Task →
                        </button>
                      )}
                      {canStart && (
                        <button onClick={() => void handleStatusUpdate(task.id, "in_progress")} disabled={assigning}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(90,156,245,.1)", border: "1px solid rgba(90,156,245,.3)", color: "var(--blue)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer", opacity: assigning ? 0.65 : 1 }}>
                          Start Work →
                        </button>
                      )}
                      {canComplete && (
                        <button onClick={() => void handleStatusUpdate(task.id, "completed")} disabled={assigning}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(78,203,141,.08)", border: "1px solid rgba(78,203,141,.25)", color: "var(--green)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer", opacity: assigning ? 0.65 : 1 }}>
                          Submit Complete →
                        </button>
                      )}
                      {canPay && (
                        <button onClick={() => void handleStatusUpdate(task.id, "paid")} disabled={assigning}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(212,170,80,.1)", border: "1px solid var(--border-hi)", color: "var(--gold-hi)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer", opacity: assigning ? 0.65 : 1 }}>
                          Release Payment →
                        </button>
                      )}
                      {canDispute && (
                        <button onClick={() => { setShowDisputeModal(task.id); setDisputeStatus(""); }}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(245,166,35,.08)", border: "1px solid rgba(245,166,35,.25)", color: "var(--amber)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer" }}>
                          Raise Dispute ⚠
                        </button>
                      )}
                      {task.status === "open" && isCreator && (
                        <button onClick={() => void handleCancel(task.id)} disabled={assigning}
                          style={{ padding: "8px 18px", borderRadius: 6, background: "rgba(232,84,84,.08)", border: "1px solid rgba(232,84,84,.25)", color: "var(--red)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer", opacity: assigning ? 0.65 : 1 }}>
                          Cancel Task ✕
                        </button>
                      )}
                    </div>

                    {/* dispute respond */}
                    {canRespondToDispute && (
                      <div style={{ marginTop: 14, padding: 14, borderRadius: 8, background: "rgba(90,156,245,.04)", border: "1px solid rgba(90,156,245,.2)" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--blue)", marginBottom: 8 }}>RESPOND TO DISPUTE</div>
                        <textarea value={disputeResponse} onChange={e => setDisputeResponse(e.target.value)} placeholder="Describe the work you delivered..."
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, resize: "vertical", minHeight: 64, fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box" }} />
                        <button onClick={() => void handleDisputeResponse(task.id)}
                          style={{ marginTop: 8, padding: "7px 16px", borderRadius: 6, background: "rgba(90,156,245,.08)", border: "1px solid rgba(90,156,245,.25)", color: "var(--blue)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer" }}>
                          Submit Response →
                        </button>
                        {disputeStatus && <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>{disputeStatus}</p>}
                      </div>
                    )}

                    {/* dispute resolve */}
                    {canResolveDispute && (
                      <div style={{ marginTop: 14, padding: 14, borderRadius: 8, background: "rgba(245,166,35,.04)", border: "1px solid rgba(245,166,35,.2)" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--amber)", marginBottom: 10 }}>RESOLVE DISPUTE</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => void handleResolveDispute(task.id, "pay_agent")}
                            style={{ flex: 1, padding: "8px", borderRadius: 6, background: "rgba(78,203,141,.08)", border: "1px solid rgba(78,203,141,.25)", color: "var(--green)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer" }}>
                            Pay Agent →
                          </button>
                          <button onClick={() => void handleResolveDispute(task.id, "refund_creator")}
                            style={{ flex: 1, padding: "8px", borderRadius: 6, background: "rgba(232,84,84,.08)", border: "1px solid rgba(232,84,84,.25)", color: "var(--red)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-syne), sans-serif", cursor: "pointer" }}>
                            Refund Me →
                          </button>
                        </div>
                        {disputeStatus && <p style={{ marginTop: 8, fontSize: 11, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>{disputeStatus}</p>}
                      </div>
                    )}

                    {/* assigned agent chip */}
                    {task.agentId && (
                      <div style={{ marginTop: 12, padding: "7px 12px", borderRadius: 6, background: "rgba(78,203,141,.06)", border: "1px solid rgba(78,203,141,.25)", fontSize: 11, color: "var(--green)", fontFamily: "'DM Mono', monospace" }}>
                        Agent · {task.agentAddress?.slice(0, 10)}...
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Assign Modal */}
              {showAssignModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                  onClick={() => setShowAssignModal(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg1)", border: "1px solid var(--border-hi)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, margin: "0 24px" }}>
                    <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginBottom: 4 }}>Assign Agent</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 24 }}>Select a registered agent for this task</div>
                    {agents.length === 0 && <p style={{ fontSize: 13, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>No agents registered yet.</p>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                      {agents.map((agent, i: number) => (
                        <button key={i} onClick={() => { if (!showAssignModal || !agent.id || !agent.owner) return; handleAssign(showAssignModal, agent.id, agent.owner); }} disabled={assigning}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", textAlign: "left", transition: "border-color .15s" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hi)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                          <div>
                            <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{agent.name ?? `Agent #${i + 1}`}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)" }}>{agent.owner?.slice(0, 20)}...</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 18, color: "var(--gold-hi)" }}>{agent.reputation ?? 1}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--text3)", letterSpacing: ".06em" }}>REP</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {assignStatus && <p style={{ marginTop: 12, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>{assignStatus}</p>}
                    <button onClick={() => setShowAssignModal(null)} style={{ marginTop: 16, width: "100%", padding: "10px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text3)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Dispute Modal */}
            {showDisputeModal && (
              <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                onClick={() => setShowDisputeModal(null)}>
                <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg1)", border: "1px solid rgba(245,166,35,.3)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, margin: "0 24px" }}>
                  <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginBottom: 4, color: "var(--amber)" }}>Raise Dispute ⚠</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Describe why the submitted work does not meet requirements. The agent will be notified and can respond before you resolve.</div>
                  <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="e.g. The delivered report was incomplete — missing reentrancy analysis..."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--border-hi)", color: "var(--text)", fontSize: 13, resize: "vertical", minHeight: 100, fontFamily: "'Inter', sans-serif", outline: "none", fontWeight: 300, boxSizing: "border-box" }} />
                  {disputeStatus && <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)", fontFamily: "'DM Mono', monospace" }}>{disputeStatus}</p>}
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button onClick={() => void handleDispute(showDisputeModal)}
                      style={{ flex: 1, padding: "11px", borderRadius: 8, background: "rgba(245,166,35,.1)", border: "1px solid rgba(245,166,35,.3)", color: "var(--amber)", cursor: "pointer", fontFamily: "var(--font-syne), sans-serif", fontWeight: 600, fontSize: 13 }}>
                      Submit Dispute →
                    </button>
                    <button onClick={() => { setShowDisputeModal(null); setDisputeReason(""); setDisputeStatus(""); }}
                      style={{ padding: "11px 20px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text3)", cursor: "pointer", fontSize: 13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* post task panel */}
            <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, position: "sticky", top: 80 }}>
              <div style={{ fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginBottom: 4 }}>Post a Task</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 24 }}>USDC is locked in escrow until task completion</div>
              <button onClick={() => void authenticateWallet()} disabled={!isConnected || authenticating || isAuthed}
                style={{ width: "100%", marginBottom: 12, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: isAuthed ? "var(--green)" : "var(--gold)", cursor: !isConnected || authenticating || isAuthed ? "not-allowed" : "pointer", opacity: !isConnected || authenticating || isAuthed ? 0.65 : 1, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                {authenticating ? "Authenticating..." : isAuthed ? "✓ Wallet Authenticated" : "Authenticate Wallet"}
              </button>
              {(["title","description","reward"] as const).map(field => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                    {field === "reward" ? "USDC Reward" : field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  {field === "description" ? (
                    <textarea value={taskForm[field]} onChange={e => setTaskForm(p => ({ ...p, [field]: e.target.value }))} placeholder="Describe deliverables and timeline..."
                      style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)", outline: "none", resize: "vertical", minHeight: 80, fontWeight: 300 }} />
                  ) : (
                    <div style={{ position: "relative" }}>
                      {field === "reward" && (
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--gold-dim)" }}>$</span>
                      )}
                      <input type={field === "reward" ? "number" : "text"} value={taskForm[field]} onChange={e => setTaskForm(p => ({ ...p, [field]: e.target.value }))}
                        placeholder={field === "title" ? "e.g. Audit my staking contract" : "0.00"}
                        style={{ width: "100%", background: "var(--bg)", border: `1px solid ${field === "reward" ? "var(--border-hi)" : "var(--border)"}`, borderRadius: 6, padding: field === "reward" ? "10px 12px 10px 28px" : "10px 12px", fontFamily: field === "reward" ? "'DM Mono', monospace" : "'Inter', sans-serif", fontSize: field === "reward" ? 14 : 13, color: field === "reward" ? "var(--gold-hi)" : "var(--text)", outline: "none", fontWeight: field === "reward" ? 500 : 300 }} />
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Tags</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Solidity","Audit","DeFi","Analytics","Research","NLP","Trading","Security","Content","APIs"].map(tag => (
                    <button key={tag} type="button" onClick={() => setTaskForm(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag] }))}
                      style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace", border: taskForm.tags.includes(tag) ? "1px solid var(--gold)" : "1px solid var(--border)", background: taskForm.tags.includes(tag) ? "rgba(212,170,80,.1)" : "var(--bg2)", color: taskForm.tags.includes(tag) ? "var(--gold)" : "var(--text3)" }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                  Min Rep Score — <span style={{ color: "var(--gold)" }}>{taskForm.minRep}</span>
                </label>
                <input type="range" min={0} max={100} value={taskForm.minRep} onChange={e => setTaskForm(p => ({ ...p, minRep: Number(e.target.value) }))} style={{ width: "100%", accentColor: "var(--gold)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                  <span>0</span><span>100</span>
                </div>
              </div>
              <button onClick={handlePostTask} disabled={postingTask || !isConnected}
                style={{ width: "100%", padding: 13, background: "linear-gradient(135deg, var(--gold), var(--amber))", color: "#0a0905", border: "none", cursor: postingTask || !isConnected ? "not-allowed" : "pointer", fontFamily: "var(--font-syne), sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: ".04em", borderRadius: 10, opacity: postingTask || !isConnected ? 0.6 : 1, boxShadow: "0 4px 20px rgba(212,170,80,.2)" }}>
                {postingTask ? <><span className="spinner" />Posting...</> : isConnected ? "Lock Escrow & Post Task →" : "Connect Wallet to Post"}
              </button>
              {!isConnected && <p style={{ marginTop: 10, fontSize: 12, color: "var(--text3)", fontFamily: "'DM Mono', monospace" }}>Connect wallet to post.</p>}
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
