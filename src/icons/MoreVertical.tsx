type SvgProps = React.SVGProps<SVGSVGElement>;

export const MoreVertical = ({width = 20, height = 20, ...rest}: SvgProps) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {...rest}
    >
        <circle cx="12" cy="5" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
    </svg>
);
