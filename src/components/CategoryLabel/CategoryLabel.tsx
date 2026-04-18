import "./CategoryLabel.css";

type Category =
  "Rally"
  | "Racing"
  | "Supercar"
  | "Premium"
  | "Retro"
  | "Transport"
  | "Construction"
  | "Utility"
  | "Off-Road";

const CATEGORY_COLOR: Record<Category, string> = {
    Rally: "#D97706",
    Racing: "#DC2626",
    Supercar: "#2563EB",
    Premium: "#7C3AED",
    Retro: "#1c9326",
    Transport: "#0EA5E9",
    Construction: "#F59E0B",
    Utility: "#10B981",
    "Off-Road": "#8B5E34",
};

type CategoryLabelProps = {
    category: Category;
};

export function CategoryLabel({category}: CategoryLabelProps) {
    return <span className="categoryLabel" style={{color: CATEGORY_COLOR[category]}}>{category}</span>;
}
