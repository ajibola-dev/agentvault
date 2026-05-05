import { createHash } from "crypto";

// Minimal wallet implementation using Node.js built-ins
// Signs Ethereum personal_sign messages without external dependencies

export function createWallet(privateKey: string) {
  return {
    signMessage: async (message: string): Promise<string> => {
      // Use viem if available in the project
      try {
        const { privateKeyToAccount } = await import("viem/accounts");
        const key = privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`;
        const account = privateKeyToAccount(key);
        return account.signMessage({ message });
      } catch {
        throw new Error("Could not sign message — ensure viem is available");
      }
    }
  };
}
