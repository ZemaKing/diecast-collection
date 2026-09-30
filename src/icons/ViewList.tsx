type SvgProps = React.SVGProps<SVGSVGElement>;

export const ViewList = ({width = 16, height = 16, ...rest}: SvgProps) => (
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
        <rect x="3" y="5" width="5" height="4" rx="1"/>
        <rect x="3" y="15" width="5" height="4" rx="1"/>
        <line x1="11" y1="7" x2="21" y2="7"/>
        <line x1="11" y1="17" x2="21" y2="17"/>
    </svg>
);
