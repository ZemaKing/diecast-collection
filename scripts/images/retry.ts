// Retries with exponential backoff. The source audit saw transient fetch failures, so every
// network call in the pipeline (download, upload, stat, verify) goes through withRetry().

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

// Not worth retrying: the same input will fail the same way (not an image, bad path, …).
export class PermanentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PermanentError";
    }
}

const RETRYABLE_STATUS = new Set([408, 425, 429]);

// Network errors and timeouts (no HTTP status) are retried; so are 408/425/429 and 5xx.
// Any other HTTP status (404, 403, 400 …) is final. Works for HttpError and for errors from
// supabase-js, which carry a numeric `status`.
export function isRetryable(error: unknown): boolean {
    if (error instanceof PermanentError) return false;
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : NaN;
    if (!Number.isFinite(status) || status === 0) return true;
    return RETRYABLE_STATUS.has(status) || status >= 500;
}

export type RetryOptions = {
    retries: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
    sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Backoff: base · 2^(attempt-1), capped, plus up to 50% jitter.
export function backoffDelay(attempt: number, baseDelayMs = 500, maxDelayMs = 15_000, random = Math.random): number {
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    return Math.round(exponential * (1 + random() / 2));
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
    const {retries, baseDelayMs, maxDelayMs, shouldRetry = isRetryable, onRetry, sleep = defaultSleep} = options;
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            if (attempt > retries || !shouldRetry(error)) throw error;
            const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
            onRetry?.(attempt, error, delay);
            await sleep(delay);
        }
    }
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
