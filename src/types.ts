export type DiecastModel = {
    id: string;
    name: string;
    year: number;
    brand: string;
    manufacturer: string;
    category: "Rally" | "Racing" | "Supercar" | "Premium";
    // string, since Supabase's `models.car_number` is `text` so "00"/"07" round-trip (docs/SCHEMA.md).
    carNumber?: number | string;
    carDriver?: string;
    driverCountry?: string;
    color: string[];
    hex?: string[];
    thumbnail: string;
    imageUrl: string;
    scale?: string;
};
