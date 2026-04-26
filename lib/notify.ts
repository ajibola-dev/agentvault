/**
 * AgentVault Notification Helper
 * Called internally by API routes when task lifecycle events occur.
 * Stores notifications in Supabase for in-app display.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentvault-ecru.vercel.app";

type NotificationType =
  | "task_claimed"
  | "task_assigned"
  | "task_started"
  | "task_completed"
  | "payment_released"
  | "dispute_raised"
  | "dispute_responded"
  | "dispute_resolved";

interface NotifyParams {
  recipientAddress: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
}

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_address: params.recipientAddress,
        type: params.type,
        title: params.title,
        message: params.message,
        task_id: params.taskId,
      }),
    });
  } catch {
    // Notifications are non-fatal — never block the main flow
    console.warn("[notify] Failed to send notification:", params.type);
  }
}

// ── Convenience functions for each event ─────────────────────────────────────

export async function notifyTaskClaimed(
  creatorAddress: string,
  taskTitle: string,
  taskId: string
) {
  return notify({
    recipientAddress: creatorAddress,
    type: "task_claimed",
    title: "Your task was claimed",
    message: `An agent has claimed your task "${taskTitle}" and will begin work shortly.`,
    taskId,
  });
}

export async function notifyTaskAssigned(
  agentAddress: string,
  taskTitle: string,
  taskId: string
) {
  return notify({
    recipientAddress: agentAddress,
    type: "task_assigned",
    title: "You were assigned a task",
    message: `You have been assigned to "${taskTitle}". Start work when ready.`,
    taskId,
  });
}

export async function notifyTaskCompleted(
  creatorAddress: string,
  taskTitle: string,
  taskId: string
) {
  return notify({
    recipientAddress: creatorAddress,
    type: "task_completed",
    title: "Task marked complete",
    message: `The agent has marked "${taskTitle}" as complete. Review and release payment or raise a dispute.`,
    taskId,
  });
}

export async function notifyPaymentReleased(
  agentAddress: string,
  taskTitle: string,
  reward: string,
  taskId: string
) {
  return notify({
    recipientAddress: agentAddress,
    type: "payment_released",
    title: "Payment released",
    message: `${reward} USDC has been released to your wallet for "${taskTitle}". Reputation updated onchain.`,
    taskId,
  });
}

export async function notifyDisputeRaised(
  agentAddress: string,
  taskTitle: string,
  taskId: string
) {
  return notify({
    recipientAddress: agentAddress,
    type: "dispute_raised",
    title: "Dispute raised on your task",
    message: `The creator has raised a dispute on "${taskTitle}". Respond with your delivery evidence.`,
    taskId,
  });
}

export async function notifyDisputeResponded(
  creatorAddress: string,
  taskTitle: string,
  taskId: string
) {
  return notify({
    recipientAddress: creatorAddress,
    type: "dispute_responded",
    title: "Agent responded to dispute",
    message: `The agent has responded to your dispute on "${taskTitle}". Review their response and resolve.`,
    taskId,
  });
}

export async function notifyDisputeResolved(
  agentAddress: string,
  creatorAddress: string,
  taskTitle: string,
  outcome: "pay_agent" | "refund_creator",
  taskId: string
) {
  if (outcome === "pay_agent") {
    await notify({
      recipientAddress: agentAddress,
      type: "dispute_resolved",
      title: "Dispute resolved in your favor",
      message: `The dispute on "${taskTitle}" was resolved. Payment has been released to your wallet.`,
      taskId,
    });
  } else {
    await notify({
      recipientAddress: creatorAddress,
      type: "dispute_resolved",
      title: "Dispute resolved — refund issued",
      message: `The dispute on "${taskTitle}" was resolved. Escrow has been refunded to your wallet.`,
      taskId,
    });
  }
}