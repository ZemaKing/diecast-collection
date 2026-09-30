// Storage keys from a pattern like "models/{slug}/{position}-{variant}.{ext}".

// Each segment must be a plain file/folder name: no "..", no leading dot, no spaces or
// characters Storage would need encoded.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function renderPath(pattern: string, vars: Record<string, string | number>): string {
    const path = pattern.replace(/\{(\w+)\}/g, (_, name: string) => {
        const value = vars[name];
        if (value === undefined || value === null || value === "") {
            throw new Error(`Path pattern "${pattern}" needs a value for {${name}}.`);
        }
        return String(value);
    });
    for (const segment of path.split("/")) {
        if (!SAFE_SEGMENT.test(segment)) throw new Error(`Unsafe storage path "${path}" (segment "${segment}").`);
    }
    return path;
}
