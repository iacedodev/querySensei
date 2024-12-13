import React, { useEffect } from 'react';

interface SQLResultTableProps {
  data: any[];
}


export const SQLResultTable: React.FC<SQLResultTableProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  useEffect(() => {
    if (data && data.length > 0) {
      const columnCount = Object.keys(data[0]).length;
      document.documentElement.style.setProperty('--column-count', columnCount.toString());
    }
  }, [data]);

  return (
    <div className="sql-result-table">
        <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={`${index}-${column}`}>{row[column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}; 