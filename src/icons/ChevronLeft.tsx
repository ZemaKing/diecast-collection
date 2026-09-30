type SvgProps = React.SVGProps<SVGSVGElement>;

export const ChevronLeft = ({width = 20, height = 20, ...rest}: SvgProps) => (
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
        <polyline points="15 6 9 12 15 18"/>
    </svg>
);
