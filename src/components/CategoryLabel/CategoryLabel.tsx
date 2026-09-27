import {categoryColorVar} from "../../utils/category.ts";
import "./CategoryLabel.css";

type CategoryLabelProps = {
    category: string;
};

export function CategoryLabel({category}: CategoryLabelProps) {
    return <span className="categoryLabel" style={{color: categoryColorVar(category)}}>{category}</span>;
}
