import {Navigate, Route, Routes} from "react-router-dom";
import {CollectionPage} from "./pages/collection-page/collection-page";
import {LandingPage} from "./pages/landing-page/landing-page";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />}/>
            <Route path="/cars" element={<CollectionPage type="cars"/>}/>
            <Route path="/trucks" element={<CollectionPage type="trucks"/>}/>
            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}
