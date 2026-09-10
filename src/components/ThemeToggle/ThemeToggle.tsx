import "./ThemeToggle.css";
import {useTheme} from "../../hooks/useTheme";
import {Sun} from "../../icons/Sun";
import {Moon} from "../../icons/Moon";

export function ThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    const isDark = theme === "dark";
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";

    return (
        <div className="countPill countPillTotal">
            <button
                type="button"
                className="linkPill themeToggle"
                onClick={toggleTheme}
                aria-label={label}
                title={label}
            >
                {isDark ? <Sun/> : <Moon/>}
            </button>
        </div>
    );
}
