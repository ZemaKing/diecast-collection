import {useQuery} from "@tanstack/react-query";

import {Header} from "../../components/Header/Header";
import {getModels} from "../../services/models.ts";

import "./about-page.css";

// Placeholder copy (ROADMAP Phase 12 — "About page (content from owner)"): everything here is
// sourced only from copy already approved in the mockup (diecast-details/Mockup Overall.png),
// not invented. Replace with the owner's own words about the collection whenever they're ready.
export function AboutPage() {
    const {data} = useQuery({queryKey: ["models", "cars"], queryFn: getModels});
    const count = data?.length ?? 0;

    return (
        <div className="aboutPage">
            <Header count={count}/>

            <main className="aboutMain">
                <div className="aboutCard">
                    <span className="aboutEyebrow">About</span>
                    <h1 className="aboutTitle">More than models.</h1>
                    <p className="aboutLead">A collection of automotive history in 1:43 scale.</p>
                    <p className="aboutBody">
                        ZemaKing Diecast Collection is a personal collection of 1:43 scale models — small cars,
                        big stories. This page is a placeholder; the owner's own write-up about the collection
                        goes here.
                    </p>
                </div>
            </main>
        </div>
    );
}
