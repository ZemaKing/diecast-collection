type SvgProps = React.SVGProps<SVGSVGElement>;

export const ViewGrid = ({width = 16, height = 16, ...rest}: SvgProps) => (
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
        <rect x="4" y="4" width="7" height="7" rx="1"/>
        <rect x="13" y="4" width="7" height="7" rx="1"/>
        <rect x="4" y="13" width="7" height="7" rx="1"/>
        <rect x="13" y="13" width="7" height="7" rx="1"/>
    </svg>
);
