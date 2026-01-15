import "./Sidebar.css";

type FilterOptions = {
    brands: string[];
    manufacturers: string[];
    categories: string[];
    colors: string[];
};

type SidebarProps = {
    brand: string;
    manufacturer: string;
    category: string;
    color: string;

    options: FilterOptions;

    onBrandChange: (value: string) => void;
    onManufacturerChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onColorChange: (value: string) => void;

    onClear: () => void;

    filteredCount: number;
};

export function Sidebar({
                            brand,
                            manufacturer,
                            category,
                            color,
                            options,
                            onBrandChange,
                            onManufacturerChange,
                            onCategoryChange,
                            onColorChange,
                            onClear,
                            filteredCount,
                        }: SidebarProps) {
    return (
        <aside className="sidebar">
            <img src="/logo.png" alt="ZemaKing logo" className="siteLogo"/>

            <div className="sidebarTopRow">
                <div className="sidebarTitle">Filters</div>
                <div className="countPill countPill--small">{filteredCount}</div>
            </div>

            <div className="filters">
                <label className="field">
                    <span className="fieldLabel">Brand</span>
                    <select value={brand} onChange={(e) => onBrandChange(e.target.value)}>
                        <option value="All">All</option>
                        {options.brands.map(brand => (
                            <option key={brand} value={brand}>{brand}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Manufacturer</span>
                    <select
                        value={manufacturer}
                        onChange={(e) => onManufacturerChange(e.target.value)}
                    >
                        <option value="All">All</option>
                        {options.manufacturers.map(manufacturer => (
                            <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Category</span>
                    <select
                        value={category}
                        onChange={(e) => onCategoryChange(e.target.value)}
                    >
                        <option value="All">All</option>
                        {options.categories.map(category => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Color</span>
                    <select value={color} onChange={(e) => onColorChange(e.target.value)}>
                        <option value="All">All</option>
                        {options.colors.map(color => (
                            <option key={color} value={color}>{color}</option>
                        ))}
                    </select>
                </label>
            </div>

            <button className="clearButton" onClick={onClear}>Clear</button>
        </aside>
    );
}