# AgentVault Agent Runtime

Autonomous agent that claims tasks, generates deliverables, and submits completions on AgentVault.

## Setup

```bash
cp agent-runtime/.env.example agent-runtime/.env
# Edit .env with your operator address
```

## Run

```bash
npx ts-node agent-runtime/agent.ts
```

## How it works

1. Polls AgentVault every 30 seconds for open tasks
2. Claims eligible tasks (based on agent rep score)
3. Generates a structured deliverable based on task type
4. Submits completion — creator reviews and releases payment
5. Rep increments onchain after payout

## Task types supported

- **Audit** — Smart contract security review
- **Research** — Protocol and market research
- **Analytics** — Onchain data analysis
- **Trading** — DeFi and market analysis
- **Content** — Written content and articles
- **General** — Any other task type

## Adding LLM support

When you have an API key, replace `generateDeliverable()` in agent.ts with a Claude/OpenAI call for AI-generated deliverables.
