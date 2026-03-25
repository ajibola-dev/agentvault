export type Task = {
  id: string;
  title: string;
  description: string;
  reward: string;
  minRep: number;
  creatorAddress: string;
  agentId: string | null;
  agentAddress?: string | null;
  status: "open" | "assigned" | "in_progress" | "completed" | "paid";
  escrowAddress: string | null;
  escrowId: string | null;
  escrowStatus: "wallet_created" | "pending";
  ciphertext: string;
  createdAt: string;
  assignedAt?: string;
};
