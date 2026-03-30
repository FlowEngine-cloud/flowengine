interface RetryOptions {
  retries: number;
  delay: number;
  backoff: number;
}

const defaultOptions: RetryOptions = {
  retries: 3,
  delay: 1000,
  backoff: 2,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { retries, delay, backoff } = { ...defaultOptions, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt
      if (attempt === retries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const waitTime = delay * Math.pow(backoff, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}
