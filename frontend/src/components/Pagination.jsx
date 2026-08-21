import { Button } from "./Button.jsx";

/**
 * Builds a compact list of page numbers around the current page.
 * @param {number} page - Current page number.
 * @param {number} pages - Total number of pages.
 * @returns {number[]} Ordered page numbers to display.
 * @sideEffects None.
 */
function getVisiblePageNumbers(page, pages) {
  const visiblePages = [];
  let startPage = Math.max(1, page - 1);
  let endPage = Math.min(pages, page + 1);

  if (page <= 2) {
    endPage = Math.min(pages, 3);
  }

  if (page >= pages - 1) {
    startPage = Math.max(1, pages - 2);
  }

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    visiblePages.push(pageNumber);
  }

  return visiblePages;
}

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

  const visiblePageNumbers = getVisiblePageNumbers(page, pages);

  return (
    <nav className="record-pagination" aria-label={label + " pagination"}>
      <Button
        variant="secondary"
        disabled={disabled || page <= 1}
        onClick={openPreviousPage}
      >
        Previous
      </Button>
      <div className="record-pagination__pages">
        {visiblePageNumbers[0] > 1 && (
          <>
            <button
              type="button"
              className="record-pagination__page"
              disabled={disabled}
              aria-label="Open page 1"
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {visiblePageNumbers[0] > 2 && (
              <span aria-hidden="true">…</span>
            )}
          </>
        )}
        {visiblePageNumbers.map((pageNumber) => (
          <button
            type="button"
            className={
              pageNumber === page
                ? "record-pagination__page record-pagination__page--active"
                : "record-pagination__page"
            }
            disabled={disabled}
            aria-current={pageNumber === page ? "page" : undefined}
            aria-label={`Open page ${pageNumber}`}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        {visiblePageNumbers[visiblePageNumbers.length - 1] < pages && (
          <>
            {visiblePageNumbers[visiblePageNumbers.length - 1] < pages - 1 && (
              <span aria-hidden="true">…</span>
            )}
            <button
              type="button"
              className="record-pagination__page"
              disabled={disabled}
              aria-label={`Open page ${pages}`}
              onClick={() => onPageChange(pages)}
            >
              {pages}
            </button>
          </>
        )}
      </div>
      <Button
        variant="secondary"
        disabled={disabled || page >= pages}
        onClick={openNextPage}
      >
        Next
      </Button>
      <span className="record-pagination__summary" aria-live="polite">
        Page {page} of {pages}
        {typeof total === "number" ? ` · ${total} ${label}` : ""}
      </span>
    </nav>
  );
}
