import { Link } from "react-router-dom";
import { ColorModeToggle } from "./ColorModeToggle";

/**
 * Game top bar: the Bompers title (home link) and the color-mode toggle.
 * Kept minimal so the arena gets the screen; game menus belong to the lobby.
 */
export const Topbar = () => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-card text-foreground elevation-md">
      <div className="flex h-toolbar items-center px-4 sm:px-6">
        <div className="flex-1 font-heading text-xl font-bold">
          <Link to="/" className="text-primary no-underline">
            Bompers
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ColorModeToggle />
        </div>
      </div>
    </header>
  );
};
