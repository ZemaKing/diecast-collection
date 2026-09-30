import {useState} from "react";

import {logoSrc} from "../../utils/model-display.ts";

type LogoOrTextProps = {
    logoPath: string | null;
    name: string;
    imgClassName?: string;
    textClassName?: string;
};

// A brand/manufacturer logo that falls back to its name as text — when there's no logo path, or
// the image fails to load. Each instance tracks its own failure, so one broken logo never hides
// another on the same card.
export function LogoOrText({logoPath, name, imgClassName, textClassName}: LogoOrTextProps) {
    const [broken, setBroken] = useState(false);
    const src = logoSrc(logoPath);

    if (src && !broken) {
        return <img src={src} alt={name} className={imgClassName} onError={() => setBroken(true)}/>;
    }

    return <span className={textClassName}>{name}</span>;
}
