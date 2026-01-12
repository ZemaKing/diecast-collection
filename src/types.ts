export type DiecastModel = {
    id: string;
    name: string;
    year: number;
    brand: string;
    manufacturer: string;
    category: "Rally" | "Racing" | "Supercar" | "Premium";
    carNumber?: number;
    carDriver?: string;
    color: string[];
    hex?: string[];
    thumbnail: string;
    imageUrl: string;
};
