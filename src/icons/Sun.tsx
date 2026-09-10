type SvgProps = React.SVGProps<SVGSVGElement>;

export const Sun = ({width = 16, height = 16, ...rest}: SvgProps) => (
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
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="4.5"/>
        <line x1="12" y1="19.5" x2="12" y2="22"/>
        <line x1="4.22" y1="4.22" x2="5.94" y2="5.94"/>
        <line x1="18.06" y1="18.06" x2="19.78" y2="19.78"/>
        <line x1="2" y1="12" x2="4.5" y2="12"/>
        <line x1="19.5" y1="12" x2="22" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.94" y2="18.06"/>
        <line x1="18.06" y1="5.94" x2="19.78" y2="4.22"/>
    </svg>
);
