import type {ReactNode} from "react";
import {Link} from "react-router-dom";

import {ChevronRight} from "../../icons/ChevronRight.tsx";

import "./Charts.css";

// Chart building blocks for the Statistics page (ROADMAP Phase 23). Every chart here compares
// magnitudes, so every bar is the one `--chart-bar` hue — identity is carried by the text label
// (and a swatch/logo where it helps), never by color alone. Values are written at the bar ends,
// and the markup is a real table / list, so the numbers read without the bars.

export function StatTile({label, value, to, hint}: {label: string; value: number; to?: string; hint?: string}) {
    const body = (
        <>
            <span className="statTileLabel">{label}</span>
            <span className="statTileValue">{value.toLocaleString("en-US")}</span>
            {hint && <span className="statTileHint">{hint}</span>}
        </>
    );
    return to ? (
        <Link to={to} className="statTile statTileLink">
            {body}
            <ChevronRight className="statTileArrow" width={16} height={16}/>
        </Link>
    ) : (
        <div className="statTile">{body}</div>
    );
}

// A titled card around one chart; `footer` for a "See all" link.
export function ChartCard({title, subtitle, id, footer, className = "", children}: {
    title: string;
    subtitle?: string;
    id: string;
    footer?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={`chartCard ${className}`} aria-labelledby={id}>
            <header className="chartCardHeader">
                <h2 id={id} className="chartCardTitle">{title}</h2>
                {subtitle && <p className="chartCardSubtitle">{subtitle}</p>}
            </header>
            {children}
            {footer && <div className="chartCardFooter">{footer}</div>}
        </section>
    );
}

export type BarRow = {
    key: string;
    label: string;
    count: number;
    to?: string;
    // A swatch or logo before the label.
    leading?: ReactNode;
};

// Horizontal bars, one row per item, as a table: row header = label (a link when `to` is set),
// cell = bar + value at its tip. Bars are scaled to the largest row, from one shared baseline.
export function BarList({rows, labelledBy, valueLabel = "Models"}: {rows: BarRow[]; labelledBy: string; valueLabel?: string}) {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
        <table className="barList" aria-labelledby={labelledBy}>
            <thead className="visuallyHidden">
                <tr>
                    <th scope="col">Name</th>
                    <th scope="col">{valueLabel}</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.key} className="barListRow">
                        <th scope="row" className="barListLabel">
                            {row.to ? (
                                <Link to={row.to} className="barListLink">
                                    {row.leading}
                                    <span className="barListName">{row.label}</span>
                                </Link>
                            ) : (
                                <span className="barListLink">
                                    {row.leading}
                                    <span className="barListName">{row.label}</span>
                                </span>
                            )}
                        </th>
                        <td className="barListCell">
                            <span className="barListTrack">
                                <span className="barListBar" style={{width: `${(row.count / max) * 100}%`}}/>
                                <span className="barListValue">{row.count}</span>
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// Vertical columns along an ordered axis (decades). Each column's value sits on its cap and its
// label below the baseline; screen readers get one "1990s: 31 models" item per column.
export function ColumnChart({columns, labelledBy, unit}: {
    columns: {key: string; label: string; count: number}[];
    labelledBy: string;
    unit: (count: number) => string;
}) {
    const max = Math.max(1, ...columns.map((c) => c.count));
    return (
        <ol className="columnChart" aria-labelledby={labelledBy}>
            {columns.map((c) => (
                <li key={c.key} className="columnChartItem">
                    <span className="visuallyHidden">{c.label}: {c.count} {unit(c.count)}</span>
                    <span className="columnChartPlot" aria-hidden="true">
                        <span className="columnChartValue">{c.count}</span>
                        <span className="columnChartBar" style={{height: `${(c.count / max) * 100}%`}}/>
                    </span>
                    <span className="columnChartLabel" aria-hidden="true">{c.label}</span>
                </li>
            ))}
        </ol>
    );
}

// A single share of a whole (racing vs road): the fill is the part, the track the rest — a lighter
// step of the same hue. The legend below carries both numbers as text.
export function Meter({value, total, label}: {value: number; total: number; label: string}) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div
            className="meter"
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={value}
            aria-valuetext={`${value} of ${total}`}
        >
            <span className="meterFill" style={{width: `${pct}%`}}/>
        </div>
    );
}
