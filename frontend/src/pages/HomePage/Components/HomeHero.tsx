

import unoLogo from "../../../assets/images/uno-logo.svg";
import { StartPlayingButton } from "../Components/StartPlayingButton";

export function HomeHero() {
  return (
    <div className="">
      <div className="relative grid grid-cols-1 items-center gap-10 overflow-hidden p-5 __bg-rays md:grid-cols-2 rounded-3xl __border-4 border-success-50">
        <div className="flex flex-col gap-3">
          <h1 className="text-6xl sm:text-8xl font-black uppercase tracking-tight text-accent">
            Ready to use your +4 ?
          </h1>
          <p className="text-2xl text-base-content/70">
            Challenge your friends in real time, chain special cards and be
            the first to empty your hand. All of it, right in your browser.
          </p>
          <ul>
            <li className="flex flex-row items-center gap-2">
              <div aria-label="status" className="status status-neutral-content"></div>
              <p className="color-neutral">Up to four players !</p>
            </li>
            <li className="flex flex-row items-center gap-2">
              <div aria-label="status" className="status status-neutral-content"></div>
              <p className="color-neutral">Certified fun !</p>
            </li>
            <li className="flex flex-row items-center gap-2">
              <div aria-label="status" className="status status-neutral-content"></div>
              <p className="color-neutral">Certified fun !</p>
            </li>
          </ul>
          <StartPlayingButton>Start playing now !</StartPlayingButton>
        </div>
        <img src={unoLogo} alt="UNO" className="mx-auto h-auto max-h-56 w-auto max-w-full object-contain md:max-h-72" />
      </div>
    </div>
  );
}
