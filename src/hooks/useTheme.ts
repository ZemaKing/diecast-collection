import {useCallback, useEffect, useState} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "zk-theme";

function getInitialTheme(): Theme {
    const current = document.documentElement.dataset.theme;

    if (current === "light" || current === "dark") {
        return current;
    }

    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return "dark";
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;

        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // localStorage unavailable (e.g. private browsing) — theme still applies for this session
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    }, []);

    return {theme, toggleTheme};
}
