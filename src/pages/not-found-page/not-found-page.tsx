import {Link} from "react-router-dom";

import {Header} from "../../components/Header/Header";
import {MAIN_CONTENT_ID} from "../../utils/a11y.ts";
import {usePageTitle} from "../../hooks/usePageTitle.ts";

import "./not-found-page.css";

export function NotFoundPage() {
    usePageTitle("Page not found");
    return (
        <div className="notFoundPage">
            <Header/>

            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="notFoundMain">
                <span className="notFoundCode">404</span>
                <h1 className="notFoundTitle">Page not found</h1>
                <p className="notFoundBody">That page doesn't exist — it may have moved, or never existed.</p>
                <Link className="notFoundLink" to="/">Back to the collection</Link>
            </main>
        </div>
    );
}
