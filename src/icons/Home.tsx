type SvgProps = React.SVGProps<SVGSVGElement>;

export const Home = ({width = 20, height = 20, ...rest}: SvgProps) => (
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
        <path d="M3 10.5 12 3l9 7.5"/>
        <path d="M5 9.5V21h5v-6h4v6h5V9.5"/>
    </svg>
);
