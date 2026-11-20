import { useEffect, useState } from "react";

// Css query rule
export const MOBILE_QUERY = "(max-width: 767px)";

// Hook that returns a boolean, of wether the window is in a mobile format
// query is the CSS media query that is checked
export function useMediaQuery(query: string): boolean {
  // matches : bool of wether it matches the CSS query or not
  const [matches, setMatches] = useState(
    // Defaut value to current value
    () => window.matchMedia(query).matches,
  );

  // Runs once after the first render, and again only if query changes
  useEffect(() => {
    // mql : the object the browser gives us to follow this media query
    const mql = window.matchMedia(query);
    // onChange : called by the browser on resize, updates matches -> re-render
    // so basically we update the matches with the new current value
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync once again, in case the window changed between render and this effect
    setMatches(mql.matches);
    // subscribes the change of the size of the window to the onChange function up there
    mql.addEventListener("change", onChange);

    // cleanup : runs when the component unmounts (or query changes), unsubscribe
    return () => mql.removeEventListener("change", onChange);

    // query here = if query changes, run this whole block again
  }, [query]);

  // Gives the result back to the component that calls the hook
  return matches;
}

// Shortcut for the question "are we on mobile ?"
export function useIsMobile(): boolean {
  // Reuses the general hook with our width constant
  return useMediaQuery(MOBILE_QUERY);
}
