// Compile-time checks that the client is typed against the `diecast` schema. No network: the
// queries are only built, never awaited. (Doesn't import ./supabase.ts, which validates real env.)
import {createClient} from "@supabase/supabase-js";
import {describe, expectTypeOf, it} from "vitest";

import type {Database, Tables, TablesInsert} from "./database.types.ts";

const client = createClient<Database, "diecast">("https://abcdefghijklmnopqrst.supabase.co", "sb_publishable_x", {
    db: {schema: "diecast"},
});

describe("database types", () => {
    it("types model_summaries rows", () => {
        type Summary = Tables<"model_summaries">;
        expectTypeOf<Summary["slug"]>().toEqualTypeOf<string | null>();
        expectTypeOf<Summary["color_slugs"]>().toEqualTypeOf<string[] | null>();
        expectTypeOf<Summary["image_count"]>().toEqualTypeOf<number | null>();
    });

    it("requires the right columns on insert", () => {
        expectTypeOf<TablesInsert<"models">>().toHaveProperty("slug").toEqualTypeOf<string>();
        expectTypeOf<TablesInsert<"models">>().toHaveProperty("scale").toEqualTypeOf<string | undefined>();
        // @ts-expect-error — brand_id is required
        const missingBrand: TablesInsert<"models"> = {slug: "x", name: "X", year: 2000, manufacturer_id: "m", category_id: "c"};
        void missingBrand;
    });

    it("types selected columns from the builder", () => {
        const query = client.from("models").select("slug, year, livery_hex");
        void query; // built, never sent
        type Row = Awaited<typeof query>["data"];
        expectTypeOf<Row>().toEqualTypeOf<{slug: string; year: number; livery_hex: string[]}[] | null>();
    });

    it("rejects unknown tables at compile time", () => {
        // @ts-expect-error — not a table in the diecast schema
        void client.from("recipes");
    });
});
