"use client";
import { useState, useEffect } from "react";

type Page = "register" | "discover" | "tasks";
type Theme = "dark" | "light";

export default function Home() {
  const [page, setPage] = useState<Page>("register");
  const [theme, setTheme] = useState<Theme>("dark");
  const [wallets, setWallets] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", reward: "" });
  const [postingTask, setPostingTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState("");

  const d = theme === "dark";

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/get-agents");
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch (e) { console.error(e); }
    setLoadingAgents(false);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/get-tasks");
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (page === "discover") fetchAgents();
    if (page === "tasks") fetchTasks();
  }, [page]);

  const handleRegister = async () => {
    setLoading(true);
    setStatus("Registering agent onchain...");
    try {
      const res = await fetch("/api/register-agent", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWallets(data);
      setStatus("success");
    } catch (err: any) {
      setStatus("Error: " + err.message);
    }
    setLoading(false);
  };

  const handlePostTask = async () => {
    if (!taskForm.title || !taskForm.description || !taskForm.reward) return;
    setPostingTask(true);
    setTaskStatus("Posting task...");
    try {
      const res = await fetch("/api/post-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTasks(prev => [data.task, ...prev]);
      setTaskForm({ title: "", description: "", reward: "" });
      setTaskStatus("Task posted successfully!");
      setTimeout(() => setTaskStatus(""), 3000);
    } catch (err: any) {
      setTaskStatus("Error: " + err.message);
    }
    setPostingTask(false);
  };

  const bg = d ? "#080a0f" : "#f4f4f0";
  const text = d ? "#e8eaf0" : "#0d1117";
  const surface = d ? "#0d1117" : "#ffffff";
  const border = d ? "#1a2030" : "#d0d0c8";
  const muted = d ? "#4a5568" : "#888";
  const accent = "#00d4ff";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${bg}; color: ${text}; font-family: 'DM Mono', monospace; min-height: 100vh; transition: background 0.3s, color 0.3s; }
        .grid-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: linear-gradient(${border} 1px, transparent 1px), linear-gradient(90deg, ${border} 1px, transparent 1px); background-size: 60px 60px; opacity: 0.4; }
        .wrap { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 0 1.5rem; min-height: 100vh; display: flex; flex-direction: column; }
        nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 0; border-bottom: 1px solid ${border}; flex-wrap: wrap; gap: 0.75rem; }
        .nav-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; }
        .nav-logo span { color: ${accent}; }
        .nav-center { display: flex; gap: 0.25rem; }
        .nav-btn { background: none; border: none; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.4rem 0.8rem; border-radius: 2px; transition: all 0.15s; }
        .nav-btn.active { background: ${accent}; color: #080a0f; }
        .nav-btn:not(.active) { color: ${muted}; }
        .nav-btn:not(.active):hover { color: ${accent}; }
        .nav-right { display: flex; align-items: center; gap: 0.5rem; }
        .theme-btn { background: none; border: 1px solid ${border}; cursor: pointer; font-size: 0.7rem; padding: 0.3rem 0.6rem; border-radius: 3px; color: ${muted}; transition: all 0.15s; }
        .theme-btn:hover { border-color: ${accent}; color: ${accent}; }
        .badge { font-size: 0.6rem; letter-spacing: 0.1em; color: ${accent}; border: 1px solid rgba(0,212,255,0.3); padding: 0.2rem 0.5rem; border-radius: 2px; text-transform: uppercase; }
        .main { flex: 1; padding: 3rem 0 2rem; }
        .page-header { margin-bottom: 2.5rem; }
        .page-eyebrow { font-size: 0.65rem; letter-spacing: 0.2em; color: ${accent}; text-transform: uppercase; margin-bottom: 0.75rem; }
        .page-title { font-family: 'Syne', sans-serif; font-size: clamp(2rem, 6vw, 3.5rem); font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
        .page-title .outline { color: transparent; -webkit-text-stroke: 1px ${accent}; }
        .card { background: ${surface}; border: 1px solid ${border}; border-radius: 4px; padding: 1.5rem; }
        .card-label { font-size: 0.6rem; letter-spacing: 0.15em; color: ${muted}; text-transform: uppercase; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid ${border}; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid ${border}; font-size: 0.75rem; }
        .info-label { color: ${muted}; }
        .info-value { color: ${accent}; }
        .btn { display: block; width: 100%; margin-top: 1.25rem; padding: 0.9rem; background: transparent; border: 1px solid ${accent}; color: ${accent}; font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border-radius: 2px; transition: all 0.2s; }
        .btn:hover { background: rgba(0,212,255,0.08); box-shadow: 0 0 20px rgba(0,212,255,0.15); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .success-block { margin-top: 1.25rem; border: 1px solid rgba(0,255,136,0.2); border-radius: 2px; padding: 1rem; background: rgba(0,255,136,0.03); }
        .success-label { font-size: 0.6rem; letter-spacing: 0.15em; color: #00ff88; text-transform: uppercase; margin-bottom: 0.75rem; }
        .data-row { font-size: 0.68rem; color: ${muted}; margin-bottom: 0.35rem; word-break: break-all; }
        .data-row span { color: ${text}; }
        .status-msg { margin-top: 0.75rem; font-size: 0.7rem; color: ${muted}; }
        .agents-grid { display: flex; flex-direction: column; gap: 1px; }
        .agent-card { background: ${surface}; border: 1px solid ${border}; padding: 1.25rem; border-radius: 4px; transition: border-color 0.15s; }
        .agent-card:hover { border-color: ${accent}; }
        .agent-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .agent-num { font-size: 0.6rem; letter-spacing: 0.15em; color: ${accent}; text-transform: uppercase; }
        .agent-date { font-size: 0.6rem; color: ${muted}; }
        .agent-rep { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
        .rep-bar { flex: 1; height: 3px; background: ${border}; border-radius: 2px; }
        .rep-fill { height: 100%; background: ${accent}; border-radius: 2px; width: 10%; }
        .rep-label { font-size: 0.6rem; color: ${muted}; }
        .tasks-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .input { width: 100%; background: ${bg}; border: 1px solid ${border}; color: ${text}; font-family: 'DM Mono', monospace; font-size: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 2px; outline: none; transition: border-color 0.15s; margin-bottom: 0.75rem; }
        .input:focus { border-color: ${accent}; }
        .input::placeholder { color: ${muted}; }
        textarea.input { min-height: 80px; resize: vertical; }
        .task-card { background: ${surface}; border: 1px solid ${border}; padding: 1.25rem; border-radius: 4px; margin-bottom: 1px; }
        .task-title { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; }
        .task-desc { font-size: 0.72rem; color: ${muted}; margin-bottom: 0.75rem; line-height: 1.6; }
        .task-footer { display: flex; justify-content: space-between; align-items: center; }
        .task-reward { font-size: 0.7rem; color: ${accent}; }
        .task-status { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 2px; border: 1px solid; }
        .task-status.open { color: #00ff88; border-color: rgba(0,255,136,0.3); }
        .empty { font-size: 0.75rem; color: ${muted}; padding: 2rem 0; }
        .spinner { display: inline-block; width: 10px; height: 10px; border: 1px solid ${accent}; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 0.5rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
        footer { padding: 1.25rem 0; border-top: 1px solid ${border}; display: flex; justify-content: space-between; font-size: 0.6rem; color: ${muted}; }
        @media (max-width: 640px) {
          .tasks-layout { grid-template-columns: 1fr; }
          nav { gap: 0.5rem; }
          .page-title { font-size: 2rem; }
        }
      `}</style>

      <div className="grid-bg" />
      <div className="wrap">
        <nav>
          <div className="nav-logo">Agent<span>Vault</span></div>
          <div className="nav-center">
            {(["register", "discover", "tasks"] as Page[]).map(p => (
              <button key={p} className={`nav-btn${page === p ? " active" : ""}`} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="nav-right">
            <button className="theme-btn" onClick={() => setTheme(d ? "light" : "dark")}>
              {d ? "☀" : "☾"}
            </button>
            <div className="badge">Arc Testnet</div>
          </div>
        </nav>

        <div className="main">
          {page === "register" && (
            <>
              <div className="page-header">
                <div className="page-eyebrow">// ERC-8004 · Onchain Agent Identity</div>
                <div className="page-title">Trust that <span className="outline">compounds.</span></div>
              </div>
              <div className="card" style={{maxWidth: 520}}>
                <div className="card-label">Agent Registration</div>
                <div className="info-row"><span className="info-label">Protocol</span><span className="info-value">ERC-8004</span></div>
                <div className="info-row"><span className="info-label">Network</span><span className="info-value">Arc Testnet</span></div>
                <div className="info-row"><span className="info-label">Wallet type</span><span className="info-value">SCA (Circle)</span></div>
                <div className="info-row" style={{borderBottom:"none"}}><span className="info-label">Status</span><span className="info-value">{wallets ? "● Live" : "○ Ready"}</span></div>
                <button className="btn" onClick={handleRegister} disabled={loading}>
                  {loading ? <><span className="spinner"/>Registering...</> : "→ Register Agent"}
                </button>
                {status && status !== "success" && <div className="status-msg">{status}</div>}
                {wallets && (
                  <div className="success-block">
                    <div className="success-label">✓ Agent registered onchain</div>
                    <div className="data-row">Owner - <span>{wallets.owner}</span></div>
                    <div className="data-row">Validator - <span>{wallets.validator}</span></div>
                    {wallets.identityTx && <div className="data-row">Identity Tx - <span>{wallets.identityTx}</span></div>}
                    {wallets.reputationTx && <div className="data-row">Reputation Tx - <span>{wallets.reputationTx}</span></div>}
                  </div>
                )}
              </div>

              <div style={{display:"flex", gap:"1px", marginTop:"3rem"}}>
                {[["3","Registries"],["∞","Portable rep"],["0","Trust resets"]].map(([n,l]) => (
                  <div key={l} className="card" style={{flex:1, borderRadius:0}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontSize:"1.6rem", fontWeight:800, marginBottom:"0.25rem"}}>{n}</div>
                    <div style={{fontSize:"0.6rem", color:muted, letterSpacing:"0.1em", textTransform:"uppercase"}}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === "discover" && (
            <>
              <div className="page-header">
                <div className="page-eyebrow">// Registered Agents</div>
                <div className="page-title">Agent <span className="outline">directory.</span></div>
              </div>
              {loadingAgents && <div className="status-msg"><span className="spinner"/>Loading agents...</div>}
              {!loadingAgents && agents.length === 0 && <div className="empty">No agents found. Register one first.</div>}
              <div className="agents-grid">
                {agents.map((agent, i) => (
                  <div key={i} className="agent-card">
                    <div className="agent-header">
                      <span className="agent-num">Agent #{i + 1}</span>
                      <span className="agent-date">{new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="data-row">Owner - <span>{agent.owner}</span></div>
                    <div className="data-row">Validator - <span>{agent.validator}</span></div>
                    <div className="agent-rep">
                      <div className="rep-bar"><div className="rep-fill" /></div>
                      <span className="rep-label">Rep score: {agent.reputation ?? 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === "tasks" && (
            <>
              <div className="page-header">
                <div className="page-eyebrow">// Task Marketplace</div>
                <div className="page-title">Post a <span className="outline">task.</span></div>
              </div>
              <div className="tasks-layout">
                <div>
                  <div className="card">
                    <div className="card-label">New Task</div>
                    <input
                      className="input"
                      placeholder="Task title"
                      value={taskForm.title}
                      onChange={e => setTaskForm(p => ({...p, title: e.target.value}))}
                    />
                    <textarea
                      className="input"
                      placeholder="Describe what the agent needs to do"
                      value={taskForm.description}
                      onChange={e => setTaskForm(p => ({...p, description: e.target.value}))}
                    />
                    <input
                      className="input"
                      placeholder="Reward in USDC (e.g. 10)"
                      value={taskForm.reward}
                      onChange={e => setTaskForm(p => ({...p, reward: e.target.value}))}
                    />
                    <button className="btn" onClick={handlePostTask} disabled={postingTask}>
                      {postingTask ? <><span className="spinner"/>Posting...</> : "→ Post Task"}
                    </button>
                    {taskStatus && <div className="status-msg">{taskStatus}</div>}
                  </div>
                </div>
                <div>
                  <div className="card-label" style={{marginBottom:"1rem"}}>Open Tasks</div>
                  {tasks.length === 0 && <div className="empty">No tasks yet. Post the first one.</div>}
                  {tasks.map((task, i) => (
                    <div key={i} className="task-card">
                      <div className="task-title">{task.title}</div>
                      <div className="task-desc">{task.description}</div>
                      <div className="task-footer">
                        <span className="task-reward">{task.reward} USDC</span>
                        <span className={`task-status ${task.status}`}>{task.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <footer>
          <span>@devajibola · AgentVault</span>
          <span>Building at the intersection of AI and Web3</span>
        </footer>
      </div>
    </>
  );
}
