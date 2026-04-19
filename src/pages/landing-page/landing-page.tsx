import { Link } from "react-router-dom";
import "./landing-page.css";

export function LandingPage() {
    return (
        <div className="landingPage">
            <header className="landingHeader">
                <div className="landingHeader__inner">
                    <div className="landingHero">
                        <div className="landingEyebrow">ZemaKing Diecast Collection</div>
                        <h1 className="landingTitle">Choose your collection</h1>
                        <p className="landingSubtitle">
                            Select the collection you want to explore.
                        </p>
                    </div>
                </div>
            </header>

            <main className="landingMain">
                <div className="landingGrid">
                    <Link className="landingCard" to="/cars">
                        <img
                            className="landingCard__image"
                            src="/cars-logo.png"
                            alt="Cars collection"
                        />
                        <div className="landingCard__overlay" />
                        <div className="landingCard__content">
                            <span className="landingCard__label">Collection</span>
                            <h2 className="landingCard__title">Cars</h2>
                        </div>
                    </Link>

                    <Link className="landingCard" to="/trucks">
                        <img
                            className="landingCard__image"
                            src="/trucks-logo.png"
                            alt="Trucks collection"
                        />
                        <div className="landingCard__overlay" />
                        <div className="landingCard__content">
                            <span className="landingCard__label">Collection</span>
                            <h2 className="landingCard__title">Trucks</h2>
                        </div>
                    </Link>
                </div>
            </main>
        </div>
    );
}
