import {Link} from "react-router-dom";

import {Header} from "../../components/Header/Header";

import "./not-found-page.css";

export function NotFoundPage() {
    return (
        <div className="notFoundPage">
            <Header/>

            <main className="notFoundMain">
                <span className="notFoundCode">404</span>
                <h1 className="notFoundTitle">Page not found</h1>
                <p className="notFoundBody">That page doesn't exist — it may have moved, or never existed.</p>
                <Link className="notFoundLink" to="/">Back to the collection</Link>
            </main>
        </div>
    );
}
