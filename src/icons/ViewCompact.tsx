type SvgProps = React.SVGProps<SVGSVGElement>;

export const ViewCompact = ({width = 16, height = 16, ...rest}: SvgProps) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        {...rest}
    >
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="4" y2="6"/>
        <line x1="3" y1="12" x2="4" y2="12"/>
        <line x1="3" y1="18" x2="4" y2="18"/>
    </svg>
);
