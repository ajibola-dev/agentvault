export type Task = {
  id: string;
  title: string;
  description: string;
  reward: string;
  minRep: number;
  agentId: string | null;
  agentAddress?: string | null;
  status: "open" | "assigned";
  escrowAddress: string | null;
  escrowId: string | null;
  escrowStatus: "wallet_created" | "pending";
  ciphertext: string;
  createdAt: string;
  assignedAt?: string;
};

export const tasks: Task[] = [];
