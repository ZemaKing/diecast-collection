import "./CategoryLabel.css";

type Category = "Rally" | "Racing" | "Supercar" | "Premium";

const CATEGORY_COLOR: Record<Category, string> = {
    Rally: "#D97706",
    Racing: "#DC2626",
    Supercar: "#2563EB",
    Premium: "#7C3AED",
};

type CategoryLabelProps = {
    category: Category;
};

export function CategoryLabel({category}: CategoryLabelProps) {
    return <span className="categoryLabel" style={{color: CATEGORY_COLOR[category]}}>{category}</span>;
}
