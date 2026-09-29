import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";

import {Header} from "../../components/Header/Header";
import {getModels} from "../../services/models.ts";

import "./not-found-page.css";

export function NotFoundPage() {
    const {data} = useQuery({queryKey: ["models", "cars"], queryFn: getModels});
    const count = data?.length ?? 0;

    return (
        <div className="notFoundPage">
            <Header count={count}/>

            <main className="notFoundMain">
                <span className="notFoundCode">404</span>
                <h1 className="notFoundTitle">Page not found</h1>
                <p className="notFoundBody">That page doesn't exist — it may have moved, or never existed.</p>
                <Link className="notFoundLink" to="/">Back to the collection</Link>
            </main>
        </div>
    );
}
