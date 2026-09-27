// Types for the `diecast` schema, in the exact format of `supabase gen types typescript --schema diecast`.
// Written from supabase/migrations/2026092714*.sql because the migrations were applied in the dashboard
// SQL editor (CLI not linked). Every column name was checked against the live database
// (`npm run verify:types`). Once the CLI is linked, regenerate instead of editing: `npm run db:types`.

export type Json =
    | string
    | number
    | boolean
    | null
    | {[key: string]: Json | undefined}
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "13.0.5"
    }
    diecast: {
        Tables: {
            admin_users: {
                Row: {
                    created_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    user_id?: string
                }
                Relationships: []
            }
            brands: {
                Row: {
                    created_at: string
                    id: string
                    logo_path: string | null
                    name: string
                    slug: string
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    logo_path?: string | null
                    name: string
                    slug: string
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    logo_path?: string | null
                    name?: string
                    slug?: string
                    updated_at?: string
                }
                Relationships: []
            }
            categories: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                    slug: string
                    sort_order: number
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                    slug: string
                    sort_order?: number
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                    slug?: string
                    sort_order?: number
                    updated_at?: string
                }
                Relationships: []
            }
            colors: {
                Row: {
                    created_at: string
                    hex: string | null
                    id: string
                    name: string
                    slug: string
                    sort_order: number
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    hex?: string | null
                    id?: string
                    name: string
                    slug: string
                    sort_order?: number
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    hex?: string | null
                    id?: string
                    name?: string
                    slug?: string
                    sort_order?: number
                    updated_at?: string
                }
                Relationships: []
            }
            drivers: {
                Row: {
                    country_code: string | null
                    created_at: string
                    id: string
                    name: string
                    slug: string
                    updated_at: string
                }
                Insert: {
                    country_code?: string | null
                    created_at?: string
                    id?: string
                    name: string
                    slug: string
                    updated_at?: string
                }
                Update: {
                    country_code?: string | null
                    created_at?: string
                    id?: string
                    name?: string
                    slug?: string
                    updated_at?: string
                }
                Relationships: []
            }
            manufacturers: {
                Row: {
                    created_at: string
                    id: string
                    logo_path: string | null
                    name: string
                    slug: string
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    logo_path?: string | null
                    name: string
                    slug: string
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    logo_path?: string | null
                    name?: string
                    slug?: string
                    updated_at?: string
                }
                Relationships: []
            }
            model_colors: {
                Row: {
                    color_id: string
                    model_id: string
                    position: number
                }
                Insert: {
                    color_id: string
                    model_id: string
                    position: number
                }
                Update: {
                    color_id?: string
                    model_id?: string
                    position?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "model_colors_color_id_fkey"
                        columns: ["color_id"]
                        isOneToOne: false
                        referencedRelation: "colors"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_colors_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "model_summaries"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_colors_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "models"
                        referencedColumns: ["id"]
                    },
                ]
            }
            model_images: {
                Row: {
                    alt: string | null
                    created_at: string
                    external_url: string | null
                    height: number | null
                    id: string
                    is_primary: boolean
                    model_id: string
                    position: number
                    storage_path: string | null
                    thumb_external_url: string | null
                    thumb_storage_path: string | null
                    updated_at: string
                    width: number | null
                }
                Insert: {
                    alt?: string | null
                    created_at?: string
                    external_url?: string | null
                    height?: number | null
                    id?: string
                    is_primary?: boolean
                    model_id: string
                    position: number
                    storage_path?: string | null
                    thumb_external_url?: string | null
                    thumb_storage_path?: string | null
                    updated_at?: string
                    width?: number | null
                }
                Update: {
                    alt?: string | null
                    created_at?: string
                    external_url?: string | null
                    height?: number | null
                    id?: string
                    is_primary?: boolean
                    model_id?: string
                    position?: number
                    storage_path?: string | null
                    thumb_external_url?: string | null
                    thumb_storage_path?: string | null
                    updated_at?: string
                    width?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "model_images_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "model_summaries"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_images_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "models"
                        referencedColumns: ["id"]
                    },
                ]
            }
            model_private_notes: {
                Row: {
                    created_at: string
                    model_id: string
                    notes: string
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    model_id: string
                    notes: string
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    model_id?: string
                    notes?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "model_private_notes_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: true
                        referencedRelation: "model_summaries"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_private_notes_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: true
                        referencedRelation: "models"
                        referencedColumns: ["id"]
                    },
                ]
            }
            model_tags: {
                Row: {
                    model_id: string
                    tag_id: string
                }
                Insert: {
                    model_id: string
                    tag_id: string
                }
                Update: {
                    model_id?: string
                    tag_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "model_tags_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "model_summaries"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_tags_model_id_fkey"
                        columns: ["model_id"]
                        isOneToOne: false
                        referencedRelation: "models"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "model_tags_tag_id_fkey"
                        columns: ["tag_id"]
                        isOneToOne: false
                        referencedRelation: "tags"
                        referencedColumns: ["id"]
                    },
                ]
            }
            models: {
                Row: {
                    added_at: string | null
                    brand_id: string
                    car_number: string | null
                    category_id: string
                    condition: string | null
                    created_at: string
                    description: string | null
                    driver_id: string | null
                    event: string | null
                    id: string
                    is_published: boolean
                    is_racing: boolean
                    key_features: string[]
                    livery_hex: string[]
                    location: string | null
                    manufacturer_id: string
                    name: string
                    scale: string
                    series: string | null
                    slug: string
                    team: string | null
                    updated_at: string
                    year: number
                }
                Insert: {
                    added_at?: string | null
                    brand_id: string
                    car_number?: string | null
                    category_id: string
                    condition?: string | null
                    created_at?: string
                    description?: string | null
                    driver_id?: string | null
                    event?: string | null
                    id?: string
                    is_published?: boolean
                    is_racing?: boolean
                    key_features?: string[]
                    livery_hex?: string[]
                    location?: string | null
                    manufacturer_id: string
                    name: string
                    scale?: string
                    series?: string | null
                    slug: string
                    team?: string | null
                    updated_at?: string
                    year: number
                }
                Update: {
                    added_at?: string | null
                    brand_id?: string
                    car_number?: string | null
                    category_id?: string
                    condition?: string | null
                    created_at?: string
                    description?: string | null
                    driver_id?: string | null
                    event?: string | null
                    id?: string
                    is_published?: boolean
                    is_racing?: boolean
                    key_features?: string[]
                    livery_hex?: string[]
                    location?: string | null
                    manufacturer_id?: string
                    name?: string
                    scale?: string
                    series?: string | null
                    slug?: string
                    team?: string | null
                    updated_at?: string
                    year?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "models_brand_id_fkey"
                        columns: ["brand_id"]
                        isOneToOne: false
                        referencedRelation: "brands"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "models_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "models_driver_id_fkey"
                        columns: ["driver_id"]
                        isOneToOne: false
                        referencedRelation: "drivers"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "models_manufacturer_id_fkey"
                        columns: ["manufacturer_id"]
                        isOneToOne: false
                        referencedRelation: "manufacturers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tags: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                    slug: string
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                    slug: string
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                    slug?: string
                    updated_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            model_summaries: {
                Row: {
                    added_at: string | null
                    brand_logo_path: string | null
                    brand_name: string | null
                    brand_slug: string | null
                    car_number: string | null
                    category_name: string | null
                    category_slug: string | null
                    category_sort_order: number | null
                    color_names: string[] | null
                    color_slugs: string[] | null
                    condition: string | null
                    created_at: string | null
                    driver_country_code: string | null
                    driver_name: string | null
                    driver_slug: string | null
                    event: string | null
                    id: string | null
                    image_count: number | null
                    image_external_url: string | null
                    image_height: number | null
                    image_storage_path: string | null
                    image_width: number | null
                    is_published: boolean | null
                    is_racing: boolean | null
                    livery_hex: string[] | null
                    location: string | null
                    manufacturer_logo_path: string | null
                    manufacturer_name: string | null
                    manufacturer_slug: string | null
                    name: string | null
                    scale: string | null
                    series: string | null
                    slug: string | null
                    team: string | null
                    thumb_external_url: string | null
                    thumb_storage_path: string | null
                    updated_at: string | null
                    year: number | null
                }
                Relationships: []
            }
        }
        Functions: {
            import_collection: {
                Args: {p_dry_run?: boolean; p_fail_after?: string; p_payload: Json}
                Returns: Json
            }
            is_admin: {Args: never; Returns: boolean}
            is_hex_palette: {Args: {p: string[]}; Returns: boolean}
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "diecast">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | {schema: keyof DatabaseWithoutInternals},
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof DatabaseWithoutInternals
        }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
                Row: infer R
            }
            ? R
            : never
        : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | {schema: keyof DatabaseWithoutInternals},
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof DatabaseWithoutInternals
        }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
        }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Insert: infer I
            }
            ? I
            : never
        : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | {schema: keyof DatabaseWithoutInternals},
    TableName extends DefaultSchemaTableNameOrOptions extends {
            schema: keyof DatabaseWithoutInternals
        }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
        }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Update: infer U
            }
            ? U
            : never
        : never

export const Constants = {
    diecast: {
        Enums: {},
    },
} as const
