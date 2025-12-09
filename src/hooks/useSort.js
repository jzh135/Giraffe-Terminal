import { useState, useMemo } from 'react';

/**
 * Custom hook for sorting table data
 * @param {Array} data - The array of data to sort
 * @param {Object} config - Initial sort configuration { key: string, direction: 'asc' | 'desc' }
 * @returns {Object} { sortedData, sortConfig, requestSort, getSortIndicator }
 */
export function useSort(data, config = { key: null, direction: 'asc' }) {
    const [sortConfig, setSortConfig] = useState(config);

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !data) return data;

        const sorted = [...data].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Handle nested properties (e.g., 'price.value')
            if (sortConfig.key.includes('.')) {
                const keys = sortConfig.key.split('.');
                aVal = keys.reduce((obj, key) => obj?.[key], a);
                bVal = keys.reduce((obj, key) => obj?.[key], b);
            }

            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
            if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

            // Handle different types
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const result = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
                return sortConfig.direction === 'asc' ? result : -result;
            }

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Handle dates
            if (aVal instanceof Date || (typeof aVal === 'string' && !isNaN(Date.parse(aVal)))) {
                const dateA = new Date(aVal);
                const dateB = new Date(bVal);
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }

            // Fallback
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        setSortConfig((current) => {
            if (current.key === key) {
                return {
                    key,
                    direction: current.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            return { key, direction: 'asc' };
        });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return ' ↕';
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };

    return { sortedData, sortConfig, requestSort, getSortIndicator };
}

export default useSort;
