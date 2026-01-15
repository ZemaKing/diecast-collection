import "./Header.css";

type Props = {
    title: string;
    count: number;
    rightSlot?: React.ReactNode;
};

export function Header({ title, count, rightSlot }: Props) {
    return (
        <header className="topHeader">
            <div className="logo">{title}</div>

            <div className="headerRight">
                <div className="countPill">{count} models</div>
                {rightSlot}
                {/* rightSlot → future-proof (theme toggle, search, profile, etc.) */}
            </div>
        </header>
    );
}
