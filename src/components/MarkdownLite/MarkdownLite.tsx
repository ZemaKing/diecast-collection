import type {ReactNode} from "react";

import {parseMarkdownLite, type Inline} from "../../utils/markdown-lite.ts";

import "./MarkdownLite.css";

// Renders a markdown-lite description (Phase 26) as React elements — never through
// dangerouslySetInnerHTML, so markup typed into the text shows up as text. Links open in a new tab
// and are marked nofollow (they're the owner's, but the page shouldn't vouch for them).
export function MarkdownLite({source, className}: {source: string; className?: string}) {
    const blocks = parseMarkdownLite(source);
    return (
        <div className={`markdownLite${className ? ` ${className}` : ""}`}>
            {blocks.map((block, i) =>
                block.type === "paragraph" ? (
                    <p key={i}>{renderInline(block.children)}</p>
                ) : block.ordered ? (
                    <ol key={i} start={block.start === 1 ? undefined : block.start}>
                        {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
                    </ol>
                ) : (
                    <ul key={i}>
                        {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
                    </ul>
                ),
            )}
        </div>
    );
}

function renderInline(nodes: Inline[]): ReactNode[] {
    return nodes.map((node, i) => {
        switch (node.type) {
            case "text":
                return node.text;
            case "break":
                return <br key={i}/>;
            case "strong":
                return <strong key={i}>{renderInline(node.children)}</strong>;
            case "em":
                return <em key={i}>{renderInline(node.children)}</em>;
            case "link":
                return (
                    <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
                        {renderInline(node.children)}
                    </a>
                );
        }
    });
}
