import { Button } from "./Button.jsx";

/**
 * Displays accessible previous/next navigation for a paginated record list.
 * @param {{page: number, pages: number, total?: number, label?: string, onPageChange: (page: number) => void, disabled?: boolean}} props - Current pagination state and page-change handler.
 * @returns {import("react").ReactElement|null} Pagination controls or null for a single page.
 * @sideEffects Calls onPageChange when the user selects another page.
 */
export function Pagination({
  page,
  pages,
  total,
  label = "records",
  onPageChange,
  disabled = false,
}) {
  if (pages <= 1) {
    return null;
  }

  /**
   * Opens the previous page when one exists.
   * @returns {void}
   * @sideEffects Calls the supplied page-change handler.
   */
  function openPreviousPage() {
    if (page > 1) {
      onPageChange(page - 1);
    }
  }

  /**
   * Opens the next page when one exists.
   * @returns {void}
   * @sideEffects Calls the supplied page-change handler.
   */
  function openNextPage() {
    if (page < pages) {
      onPageChange(page + 1);
    }
  }

  return (
    <nav className="record-pagination" aria-label={label + " pagination"}>
      <Button
        variant="secondary"
        disabled={disabled || page <= 1}
        onClick={openPreviousPage}
      >
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {pages}
        {typeof total === "number" ? " · " + total + " " + label : ""}
      </span>
      <Button
        variant="secondary"
        disabled={disabled || page >= pages}
        onClick={openNextPage}
      >
        Next
      </Button>
    </nav>
  );
}
