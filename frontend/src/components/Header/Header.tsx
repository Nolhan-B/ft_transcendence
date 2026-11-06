export type HeaderProps = {variant: "simple" | "logged-out" | "default"}

import { Drawer } from "./components/Drawer";
import { SiteTitle } from "./components/SiteTitle";

export function Header({ variant }: HeaderProps) {
    if (variant == "simple") {
        return (
            <div className="navbar bg-base-200 shadow-sm">
                <div className="flex-none">
                    <Drawer />
                </div>
                <div className="flex-1">
                    <SiteTitle />
                </div>
                <div className="flex-none">
                    <button className="btn btn-square btn-ghost">
                    <svg aria-label="More" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block h-5 w-5 stroke-current"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path> </svg>
                    </button>
                </div>
            </div>
        );
    }
    if (variant == "logged-out") {
        return (
            <div className="navbar bg-base-200 shadow-sm">
                <div className="flex-none">
                    <Drawer />
                </div>
                <div className="flex-1">
                    <SiteTitle />
                </div>
            </div>
        );
    }
    return (
        <div className="navbar bg-base-200 shadow-sm">
            <div className="flex-none">
                <Drawer />
            </div>
            <div className="flex-1">
                <SiteTitle />
            </div>
            <div className="flex-none">
                <button className="btn btn-square btn-ghost">
                <svg aria-label="More" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block h-5 w-5 stroke-current"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path> </svg>
                </button>
            </div>
        </div>
    );
}
