type SvgProps = React.SVGProps<SVGSVGElement>;

export const Expand = ({width = 20, height = 20, ...rest}: SvgProps) => (
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
        aria-hidden="true"
        {...rest}
    >
        <polyline points="4 9 4 4 9 4"/>
        <polyline points="20 9 20 4 15 4"/>
        <polyline points="4 15 4 20 9 20"/>
        <polyline points="20 15 20 20 15 20"/>
    </svg>
);
