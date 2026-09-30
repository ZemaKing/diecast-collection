import {useMemo} from "react";
import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {BrowseLogo} from "../../components/Browse/Browse.tsx";
import {BarList, ChartCard, ColumnChart, Meter, StatTile, type BarRow} from "../../components/Charts/Charts.tsx";
import {ColorCircle} from "../../components/ColorCircle/ColorCircle.tsx";
import {Header} from "../../components/Header/Header";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";

import {useScrollRestoration} from "../../hooks/useScrollRestoration.ts";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import type {AppError} from "../../lib/errors.ts";
import type {BrowseEntry, BrowseKind} from "../../services/browse.ts";
import {getColors} from "../../services/lookups.ts";
import {getModels} from "../../services/models.ts";
import {formatShare, getCollectionBreakdown, getCollectionStats, topEntries} from "../../services/stats.ts";
import type {ModelSummary} from "../../services/types.ts";
import {BROWSE_LABELS, browseIndexPath, browsePath} from "../../utils/browse-link.ts";
import {colorSwatchHex} from "../../utils/color.ts";
import {pluralizeModels} from "../../utils/collection-summary.ts";
import {logoSrc} from "../../utils/model-display.ts";

import "../collection-page/collection-page.css";
import "./statistics-page.css";

// How many brands/manufacturers the ranked lists show before "See all".
const TOP_N = 10;

function filterPath(key: "category" | "color", slug: string): string {
    return `/?${key}=${encodeURIComponent(slug)}`;
}

// `/statistics` (ROADMAP Phase 23). Every number is computed from the cached summary list the
// rest of the app shares (getCollectionBreakdown()) — nothing is hard-coded, so a newly imported
// model is counted on the next load. `npm run verify:stats` cross-checks each number against the
// database. Chart forms follow the dataviz guidance: the totals are stat tiles, racing vs road is
// a meter (one share of a whole), everything else compares magnitudes with single-hue bars.
// No pie charts, no per-color bars: the color chart's identity is its real swatch beside the name.
export function StatisticsPage() {
    const modelsQuery = useQuery<ModelSummary[], AppError>({queryKey: ["models", "cars"], queryFn: getModels});
    // Same query key as the Color filter's, so the swatches are usually already cached.
    const colorsQuery = useQuery({queryKey: ["colors"], queryFn: getColors});

    const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
    const stats = useMemo(() => getCollectionStats(models), [models]);
    const breakdown = useMemo(() => getCollectionBreakdown(models), [models]);
    const hexBySlug = useMemo(() => new Map((colorsQuery.data ?? []).map((c) => [c.slug, c.hex])), [colorsQuery.data]);

    useScrollRestoration({ready: modelsQuery.isSuccess});

    const total = stats.totalModels;

    return (
        <div className="layout">
            <Header count={total}/>

            <div className="content">
                <main className="main">
                    <PageIntro
                        eyebrow="Statistics"
                        title="The collection in numbers"
                        subtitle={modelsQuery.isSuccess ? `Counted live from all ${total} ${pluralizeModels(total)}` : null}
                    />

                    {modelsQuery.isPending ? (
                        <StatisticsSkeleton/>
                    ) : modelsQuery.isError ? (
                        <div className="contentError">
                            <p>{modelsQuery.error.message}</p>
                            <button type="button" className="retryButton" onClick={() => modelsQuery.refetch()}>
                                Try again
                            </button>
                        </div>
                    ) : total === 0 ? (
                        <div className="contentEmpty">No models in the collection yet.</div>
                    ) : (
                        <>
                            <div className="statsKpis">
                                <StatTile label="Models" value={total} to="/"/>
                                <StatTile label="Brands" value={stats.totalBrands} to={browseIndexPath("brands")}/>
                                <StatTile label="Manufacturers" value={stats.totalManufacturers} to={browseIndexPath("manufacturers")}/>
                                <StatTile label="Categories" value={stats.totalCategories}/>
                            </div>

                            <div className="statsHighlights">
                                <TopCard kind="brands" entries={topEntries(breakdown.brands)} total={total}/>
                                <TopCard kind="manufacturers" entries={topEntries(breakdown.manufacturers)} total={total}/>
                                <RacingCard racing={breakdown.racing.racing} road={breakdown.racing.road}/>
                            </div>

                            <div className="statsCharts">
                                <ChartCard
                                    id="stats-decades"
                                    title="Models by decade"
                                    subtitle="By the year of the real car"
                                    className="statsChartWide"
                                >
                                    <ColumnChart
                                        labelledBy="stats-decades"
                                        columns={breakdown.decades.map((d) => ({key: String(d.decade), label: d.label, count: d.count}))}
                                        unit={pluralizeModels}
                                    />
                                </ChartCard>

                                <ChartCard id="stats-categories" title="By category">
                                    <BarList
                                        labelledBy="stats-categories"
                                        rows={breakdown.categories.map((c) => ({key: c.slug, label: c.name, count: c.count, to: filterPath("category", c.slug)}))}
                                    />
                                </ChartCard>

                                <RankedCard kind="brands" entries={breakdown.brands}/>
                                <RankedCard kind="manufacturers" entries={breakdown.manufacturers}/>

                                <ChartCard
                                    id="stats-colors"
                                    title="By color"
                                    subtitle="A two-tone livery counts once for each color"
                                >
                                    <BarList
                                        labelledBy="stats-colors"
                                        rows={breakdown.colors.map((c) => ({
                                            key: c.slug,
                                            label: c.name,
                                            count: c.count,
                                            to: filterPath("color", c.slug),
                                            leading: <span className="barListSwatch"><ColorCircle hex={colorSwatchHex(hexBySlug.get(c.slug))}/></span>,
                                        }))}
                                    />
                                </ChartCard>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

// "Top brand: Ford — 22 models, 10% of the collection". A tie lists everyone sharing the top.
function TopCard({kind, entries, total}: {kind: BrowseKind; entries: BrowseEntry[]; total: number}) {
    const label = `Top ${BROWSE_LABELS[kind].singular.toLowerCase()}`;
    const [first] = entries;
    if (!first) return null;

    return (
        <section className="statsHighlight" aria-label={label}>
            <span className="statsHighlightLabel">{label}{entries.length > 1 && ` (${entries.length}-way tie)`}</span>
            <div className="statsTopList">
                {entries.map((entry) => (
                    <Link key={entry.slug} to={browsePath(kind, entry.slug)} className="statsTop">
                        <BrowseLogo entry={entry} size="tile"/>
                        <span className="statsTopText">
                            <span className="statsTopName">{entry.name}</span>
                            <span className="statsTopMeta">
                                <span className="statsTopCount">{entry.count}</span> {pluralizeModels(entry.count)}
                                {" · "}{formatShare(entry.count, total)} of the collection
                            </span>
                        </span>
                        <ChevronRight className="statsTopArrow" width={16} height={16}/>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function RacingCard({racing, road}: {racing: number; road: number}) {
    const total = racing + road;
    return (
        <section className="statsHighlight" aria-labelledby="stats-racing">
            <span id="stats-racing" className="statsHighlightLabel">Racing vs road</span>
            <p className="statsRacingHeadline">
                <span className="statsRacingShare">{formatShare(racing, total)}</span> are race or rally cars
            </p>
            <Meter value={racing} total={total} label="Racing models"/>
            <ul className="statsLegend">
                <li><span className="statsLegendKey statsLegendKeyFill" aria-hidden="true"/>Racing <strong>{racing}</strong></li>
                <li><span className="statsLegendKey statsLegendKeyTrack" aria-hidden="true"/>Road <strong>{road}</strong></li>
            </ul>
        </section>
    );
}

function RankedCard({kind, entries}: {kind: BrowseKind; entries: BrowseEntry[]}) {
    const labels = BROWSE_LABELS[kind];
    const id = `stats-top-${kind}`;
    const rows: BarRow[] = entries.slice(0, TOP_N).map((e) => {
        const src = logoSrc(e.logoPath);
        return {
            key: e.slug,
            label: e.name,
            count: e.count,
            to: browsePath(kind, e.slug),
            leading: src ? <img className="barListLogo" src={src} alt="" aria-hidden="true"/> : undefined,
        };
    });

    return (
        <ChartCard
            id={id}
            title={`Top ${labels.plural.toLowerCase()}`}
            subtitle={entries.length > TOP_N ? `The ${TOP_N} with the most models` : undefined}
            footer={
                <Link to={browseIndexPath(kind)} className="statsSeeAll">
                    All {entries.length} {labels.plural.toLowerCase()}
                    <ChevronRight width={14} height={14}/>
                </Link>
            }
        >
            <BarList labelledBy={id} rows={rows}/>
        </ChartCard>
    );
}

// Same footprint as the loaded page, so nothing jumps when the numbers land.
function StatisticsSkeleton() {
    return (
        <div aria-hidden="true">
            <div className="statsKpis">
                {["a", "b", "c", "d"].map((key) => <div key={key} className="statTile statsSkeleton statsSkeletonTile"/>)}
            </div>
            <div className="statsHighlights">
                {["a", "b", "c"].map((key) => <div key={key} className="statsHighlight statsSkeleton statsSkeletonHighlight"/>)}
            </div>
            <div className="statsCharts">
                <div className="chartCard statsChartWide statsSkeleton statsSkeletonChart"/>
            </div>
        </div>
    );
}
