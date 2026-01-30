import { config } from "./config.js";
import { AIFactoryError } from "./errors.js";

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = config.REQUEST_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    setTimeout(() => {
      reject(new AIFactoryError("Request timeout", "TIMEOUT"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}
