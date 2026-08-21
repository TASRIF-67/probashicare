import { useState } from "react";
import { Link } from "react-router-dom";
import { SearchIcon } from "./Icons.jsx";

/**
 * Provides a small client-side search for destinations in the current workspace.
 * @param {object} props - Workspace search properties.
 * @param {{to: string, label: string, icon: import("react").ComponentType}[]} props.links - Navigable workspace destinations.
 * @param {string} [props.placeholder] - Accessible hint shown inside the search input.
 * @returns {import("react").ReactElement} A search input with matching route links.
 * @sideEffects Updates local search text and clears it after a destination is selected.
 */
export function WorkspaceSearch({
  links,
  placeholder = "Search workspace",
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matchingLinks = [];

  if (normalizedQuery) {
    for (const link of links) {
      const normalizedLabel = link.label.toLowerCase();

      if (normalizedLabel.includes(normalizedQuery)) {
        matchingLinks.push(link);
      }
    }
  }

  /**
   * Stores the latest workspace search text.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Search input change event.
   * @returns {void}
   * @sideEffects Updates the local query state.
   */
  function handleQueryChange(event) {
    setQuery(event.target.value);
  }

  /**
   * Closes the result panel after a destination is selected.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {void}
   * @sideEffects Clears the local query state.
   */
  function clearQuery() {
    setQuery("");
  }

  /**
   * Lets keyboard users dismiss the search results with Escape.
   * @param {import("react").KeyboardEvent<HTMLInputElement>} event - Search input keyboard event.
   * @returns {void}
   * @sideEffects Clears the local query when Escape is pressed.
   */
  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setQuery("");
    }
  }

  const hasQuery = normalizedQuery.length > 0;

  return (
    <div className="workspace-search">
      <SearchIcon size={17} aria-hidden="true" />
      <label className="sr-only" htmlFor="workspace-search-input">
        Search workspace pages
      </label>
      <input
        id="workspace-search-input"
        type="search"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={hasQuery}
        aria-controls="workspace-search-results"
        onChange={handleQueryChange}
        onKeyDown={handleSearchKeyDown}
      />

      {hasQuery && (
        <div
          id="workspace-search-results"
          className="workspace-search__results"
          role="listbox"
          aria-label="Matching workspace pages"
        >
          {matchingLinks.length === 0 && (
            <span className="workspace-search__empty">
              No matching page found
            </span>
          )}

          {matchingLinks.map((link) => {
            const LinkIcon = link.icon;

            return (
              <Link
                key={link.to}
                to={link.to}
                role="option"
                aria-selected="false"
                onClick={clearQuery}
              >
                <LinkIcon size={16} aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
