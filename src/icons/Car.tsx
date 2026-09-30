type SvgProps = React.SVGProps<SVGSVGElement>;

export const Car = ({width = 20, height = 20, ...rest}: SvgProps) => (
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
        <path d="M5 16H3v-4l2-5h14l2 5v4h-2"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <circle cx="7.5" cy="16.5" r="1.5"/>
        <circle cx="16.5" cy="16.5" r="1.5"/>
        <line x1="9" y1="16.5" x2="15" y2="16.5"/>
    </svg>
);
