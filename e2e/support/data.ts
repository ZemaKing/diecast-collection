// The expected side of the E2E assertions: the published models read straight from PostgREST with
// the public anon key (GET only — exactly what a signed-out visitor can see). Deliberately does
// not reuse src/services: a bug in the app's mapping or filtering must not also move the oracle.
import {loadEnv} from "./env.ts";

export type PublishedModel = {
    slug: string;
    name: string;
    year: number;
    brand_slug: string;
    brand_name: string;
    manufacturer_slug: string;
    manufacturer_name: string;
    category_slug: string;
    category_name: string;
    color_slugs: string[];
    image_count: number;
};

export type Collection = {
    models: PublishedModel[];
    bySlug: Map<string, PublishedModel>;
    // slug → number of published models, per kind.
    brands: Map<string, {name: string; count: number}>;
    manufacturers: Map<string, {name: string; count: number}>;
    categories: Map<string, {name: string; count: number}>;
};

const COLUMNS = "slug,name,year,brand_slug,brand_name,manufacturer_slug,manufacturer_name,category_slug,category_name,color_slugs,image_count";

export function supabaseOrigin(): string {
    return new URL(loadEnv().url).origin;
}

// GET /rest/v1/<path> in the `diecast` schema as the anon role.
export async function restGet(path: string): Promise<Response> {
    const {url, anonKey} = loadEnv();
    return fetch(`${url}/rest/v1/${path}`, {
        headers: {apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "diecast"},
    });
}

export async function fetchCollection(): Promise<Collection> {
    const response = await restGet(`model_summaries?select=${COLUMNS}&is_published=eq.true&order=name`);
    if (!response.ok) throw new Error(`Couldn't load the collection for the E2E oracle: HTTP ${response.status} ${await response.text()}`);
    const models = (await response.json()) as PublishedModel[];
    if (models.length === 0) throw new Error("The collection is empty — the E2E journeys need published models.");

    const tally = (key: (m: PublishedModel) => [string, string]) => {
        const map = new Map<string, {name: string; count: number}>();
        for (const model of models) {
            const [slug, name] = key(model);
            const entry = map.get(slug) ?? {name, count: 0};
            entry.count += 1;
            map.set(slug, entry);
        }
        return map;
    };

    return {
        models,
        bySlug: new Map(models.map((m) => [m.slug, m])),
        brands: tally((m) => [m.brand_slug, m.brand_name]),
        manufacturers: tally((m) => [m.manufacturer_slug, m.manufacturer_name]),
        categories: tally((m) => [m.category_slug, m.category_name]),
    };
}

// The entry with the most models — a stable, well-populated pick for filter/browse journeys.
export function largest(map: Map<string, {name: string; count: number}>): {slug: string; name: string; count: number} {
    const [slug, entry] = [...map.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0]!;
    return {slug, ...entry};
}

export function pluralModels(count: number): string {
    return `${count} ${count === 1 ? "model" : "models"}`;
}
