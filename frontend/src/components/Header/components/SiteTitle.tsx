import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";

export function SiteTitle() {
    return (
        <Link to="/">
            <a className="btn btn-ghost text-xl">{WEBSITE_NAME}</a>
        </Link>
    );
}
