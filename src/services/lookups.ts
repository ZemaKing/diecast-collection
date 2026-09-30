// Lookup-table reads: brands, manufacturers, categories, colors, drivers. Small, rarely-changing tables —
// each is one unfiltered `select *`.
import {supabase} from "../lib/supabase.ts";

import {mapCategory} from "./mappers.ts";
import {unwrap} from "./supabase-query.ts";
import type {Category, Driver, LookupRef, Tag} from "./types.ts";

export async function getBrands(): Promise<LookupRef[]> {
    const rows = await unwrap(supabase.from("brands").select("*").order("name"));
    return rows.map((r) => ({slug: r.slug, name: r.name, logoPath: r.logo_path}));
}

export async function getManufacturers(): Promise<LookupRef[]> {
    const rows = await unwrap(supabase.from("manufacturers").select("*").order("name"));
    return rows.map((r) => ({slug: r.slug, name: r.name, logoPath: r.logo_path}));
}

export async function getCategories(): Promise<Category[]> {
    const rows = await unwrap(supabase.from("categories").select("*").order("sort_order"));
    return rows.map(mapCategory);
}

export async function getColors(): Promise<{slug: string; name: string; hex: string | null}[]> {
    const rows = await unwrap(supabase.from("colors").select("*").order("sort_order"));
    return rows.map((r) => ({slug: r.slug, name: r.name, hex: r.hex}));
}

// Every driver, for the admin form's driver picker (Phase 25). ~140 rows — one small read.
export async function getDrivers(): Promise<Driver[]> {
    const rows = await unwrap(supabase.from("drivers").select("*").order("name"));
    return rows.map((r) => ({slug: r.slug, name: r.name, countryCode: r.country_code}));
}

// Every tag, for the admin form's tag picker (Phase 26). Public table; empty until tags are added.
export async function getTags(): Promise<Tag[]> {
    const rows = await unwrap(supabase.from("tags").select("*").order("name"));
    return rows.map((r) => ({slug: r.slug, name: r.name}));
}
