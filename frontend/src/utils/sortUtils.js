/**
 * Sort data array by a specific key
 * @param {Array} data - Array of objects to sort
 * @param {string} key - Key to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export const sortData = (data, key, direction) => {
  return [...data].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    // Handle null/undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
    
    // Date sorting (for fields with _at or date in name)
    if (key.includes('_at') || key.includes('date')) {
      const dateA = new Date(aVal);
      const dateB = new Date(bVal);
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    // Number sorting
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Parse numeric strings (e.g., "123.45", "1,234")
    const numA = parseFloat(String(aVal).replace(/,/g, ''));
    const numB = parseFloat(String(bVal).replace(/,/g, ''));
    if (!isNaN(numA) && !isNaN(numB)) {
      return direction === 'asc' ? numA - numB : numB - numA;
    }
    
    // String sorting (case-insensitive)
    const strA = String(aVal).toLowerCase();
    const strB = String(bVal).toLowerCase();
    if (direction === 'asc') {
      return strA.localeCompare(strB);
    } else {
      return strB.localeCompare(strA);
    }
  });
};

/**
 * Toggle sort direction or reset to ascending for new column
 * @param {string} currentKey - Current sort key
 * @param {string} newKey - New sort key being clicked
 * @param {string} currentDirection - Current sort direction
 * @returns {string} New direction ('asc' or 'desc')
 */
export const toggleSortDirection = (currentKey, newKey, currentDirection) => {
  if (currentKey === newKey) {
    return currentDirection === 'asc' ? 'desc' : 'asc';
  }
  return 'asc'; // Default to ascending for new column
};
