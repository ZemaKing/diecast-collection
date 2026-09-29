type SvgProps = React.SVGProps<SVGSVGElement>;

export const Filter = ({width = 16, height = 16, ...rest}: SvgProps) => (
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
        <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
    </svg>
);
