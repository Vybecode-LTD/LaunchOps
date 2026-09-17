import { describe, expect, it } from "vitest";
import { MutationObserver } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { createQueryClient } from "./queryClient";

/** Fetches once through the app's query client and counts how many attempts were made. */
async function attemptsFor(error: Error) {
  const client = createQueryClient();
  let attempts = 0;
  await expect(
    client.fetchQuery({
      queryKey: ["attempts"],
      retryDelay: 0,
      queryFn: () => {
        attempts += 1;
        throw error;
      },
    }),
  ).rejects.toBe(error);
  return attempts;
}

describe("query retries", () => {
  it("doesn't retry a request the server refused, because asking again won't change the answer", async () => {
    expect(await attemptsFor(new ApiError(401, "Invalid or expired token"))).toBe(1);
    expect(await attemptsFor(new ApiError(404, "Product not found"))).toBe(1);
    expect(await attemptsFor(new ApiError(422, "Field required"))).toBe(1);
  });

  it("retries twice when the server fails or can't be reached", async () => {
    expect(await attemptsFor(new ApiError(503, "Database unavailable"))).toBe(3);
    expect(await attemptsFor(new ApiError(0, "Can't reach the LaunchOps server."))).toBe(3);
  });

  it("never retries a change, so nothing (an email, say) is sent twice", async () => {
    const client = createQueryClient();
    let attempts = 0;
    const send = new MutationObserver(client, {
      retryDelay: 0,
      mutationFn: async () => {
        attempts += 1;
        throw new ApiError(503, "Database unavailable");
      },
    });

    await expect(send.mutate()).rejects.toThrow("Database unavailable");
    expect(attempts).toBe(1);
  });
});
