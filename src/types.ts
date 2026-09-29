export type DiecastModel = {
    id: string;
    name: string;
    year: number;
    brand: string;
    manufacturer: string;
    category: "Rally" | "Racing" | "Supercar" | "Premium";
    // string when sourced from Supabase (`models.car_number` is `text` so "00"/"07" round-trip;
    // see docs/SCHEMA.md), number for the legacy truck JSON which is still read as-is.
    carNumber?: number | string;
    carDriver?: string;
    driverCountry?: string;
    color: string[];
    hex?: string[];
    thumbnail: string;
    imageUrl: string;
    scale?: string;
};

export type DiecastType = "cars" | "trucks";
