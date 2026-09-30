type SvgProps = React.SVGProps<SVGSVGElement>;

export const ArrowRight = ({width = 20, height = 20, ...rest}: SvgProps) => (
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
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="13 6 19 12 13 18"/>
    </svg>
);
