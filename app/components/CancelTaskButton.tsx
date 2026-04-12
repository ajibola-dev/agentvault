"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface Props {
  taskId: string;
  taskStatus: string;
  creatorAddress: string;
  onCancelled?: () => void;
}

export default function CancelTaskButton({
  taskId,
  taskStatus,
  creatorAddress,
  onCancelled,
}: Props) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate 1: only show to the creator
  if (!address || address.toLowerCase() !== creatorAddress.toLowerCase()) {
    return null;
  }

  // Gate 2: only show for open tasks
  if (taskStatus !== "open") {
    return null;
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      "Cancel this task? If escrow was funded, USDC will be returned to your wallet."
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerAddress: address }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Cancellation failed.");
        return;
      }

      onCancelled?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {loading ? "Cancelling…" : "Cancel Task"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
