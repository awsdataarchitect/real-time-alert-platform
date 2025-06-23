import React from 'react';
import { useFilter } from '../../context/FilterContext';

const Pagination = () => {
  const {
    paginationInfo,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    loading
  } = useFilter();

  const {
    totalItems,
    totalPages,
    currentPage,
    pageSize,
    hasNextPage,
    hasPreviousPage
  } = paginationInfo;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if there are fewer than maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first page
      pages.push(1);
      
      // Calculate start and end of page range
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at the beginning
      if (currentPage <= 2) {
        endPage = Math.min(totalPages - 1, 4);
      }
      
      // Adjust if at the end
      if (currentPage >= totalPages - 1) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Always include last page if there's more than one page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} alerts
      </div>
      
      <div className="pagination-controls">
        {/* Previous button */}
        <button
          className="pagination-button"
          onClick={prevPage}
          disabled={!hasPreviousPage || loading}
          aria-label="Previous page"
        >
          &laquo;
        </button>
        
        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
          ) : (
            <button
              key={`page-${page}`}
              className={`pagination-button ${currentPage === page ? 'active' : ''}`}
              onClick={() => goToPage(page)}
              disabled={loading}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )
        ))}
        
        {/* Next button */}
        <button
          className="pagination-button"
          onClick={nextPage}
          disabled={!hasNextPage || loading}
          aria-label="Next page"
        >
          &raquo;
        </button>
      </div>
      
      <div className="pagination-size">
        <label htmlFor="page-size">Items per page:</label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => changePageSize(Number(e.target.value))}
          disabled={loading}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
};

export default Pagination;