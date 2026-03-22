'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  List,
  Braces,
  Table2,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ExecutionDataViewerProps {
  input?: any;
  output?: any;
  executionId?: string;
}

export default function ExecutionDataViewer({
  input,
  output,
  executionId,
}: ExecutionDataViewerProps) {
  const [dataTab, setDataTab] = useState<'input' | 'output'>('output');
  const [viewMode, setViewMode] = useState<'schema' | 'json' | 'table'>('schema');
  const [copied, setCopied] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const currentData = dataTab === 'input' ? input : output;

  const handleCopy = () => {
    if (!currentData) return;
    const jsonStr = typeof currentData === 'string'
      ? currentData
      : JSON.stringify(currentData, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'json' | 'csv') => {
    if (!currentData) return;

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = typeof currentData === 'string'
        ? currentData
        : JSON.stringify(currentData, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      // CSV format
      const data = Array.isArray(currentData) ? currentData : [currentData];
      if (data.length === 0 || typeof data[0] !== 'object') {
        content = String(currentData);
      } else {
        const keys = [...new Set(data.flatMap(item => Object.keys(item || {})))];
        const header = keys.join(',');
        const rows = data.map(row =>
          keys.map(key => {
            const val = row?.[key];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          }).join(',')
        );
        content = [header, ...rows].join('\n');
      }
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId || 'data'}-${dataTab}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleCellExpand = (cellId: string) => {
    setExpandedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      return newSet;
    });
  };

  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-500">[] (empty)</span>;
      return (
        <div className="space-y-1">
          <span className="text-purple-400">Array[{value.length}]</span>
          <div className="pl-4 border-l border-gray-700 space-y-1">
            {value.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-gray-600 text-xs">[{idx}]</span>
                {renderValue(item, depth + 1)}
              </div>
            ))}
            {value.length > 5 && (
              <span className="text-gray-500 text-xs">... and {value.length - 5} more items</span>
            )}
          </div>
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return <span className="text-gray-500">{'{}'} (empty)</span>;
      return (
        <div className="space-y-1">
          {depth > 0 && <span className="text-blue-400">Object</span>}
          <div className={cn(depth > 0 && "pl-4 border-l border-gray-700", "space-y-1")}>
            {entries.map(([key, val]) => (
              <div key={key} className="flex gap-2 items-start">
                <span className="text-green-400 text-sm font-medium">{key}:</span>
                {renderValue(val, depth + 1)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof value === 'string') {
      return <span className="text-yellow-300">&quot;{value.length > 100 ? value.slice(0, 100) + '...' : value}&quot;</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-cyan-400">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-orange-400">{String(value)}</span>;
    }

    return <span className="text-gray-300">{String(value)}</span>;
  };

  const renderTable = () => {
    const data = Array.isArray(currentData) ? currentData : [currentData];

    if (data.length === 0) {
      return <p className="p-4 text-gray-500 text-sm text-center">No data to display</p>;
    }

    const allKeys = new Set<string>();
    data.forEach((item: any) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });
    const keys = Array.from(allKeys);

    if (keys.length === 0) {
      return <p className="p-4 text-gray-500 text-sm text-center">No structured data available</p>;
    }

    return (
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-800">
              {keys.map((key, i) => (
                <th
                  key={key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider border-b-2 border-gray-600",
                    i !== keys.length - 1 && "border-r border-gray-700"
                  )}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-900/50">
            {data.map((row: any, rowIdx: number) => (
              <tr
                key={rowIdx}
                className={cn(
                  "hover:bg-gray-800/50 transition-colors",
                  rowIdx % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"
                )}
              >
                {keys.map((key, colIdx) => {
                  const cellId = `${rowIdx}-${colIdx}`;
                  const cellValue = row?.[key];
                  const isObject = cellValue && typeof cellValue === 'object';
                  const stringValue = isObject
                    ? JSON.stringify(cellValue, null, 2)
                    : String(cellValue ?? '');
                  const isLong = stringValue.length > 50;
                  const isExpanded = expandedCells.has(cellId);

                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-4 py-3 text-gray-300 border-b border-gray-800 align-top",
                        colIdx !== keys.length - 1 && "border-r border-gray-800"
                      )}
                    >
                      {isLong ? (
                        <div>
                          <button
                            onClick={() => toggleCellExpand(cellId)}
                            className="flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-1"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                          {isExpanded ? (
                            <pre className={cn(
                              "text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto",
                              isObject ? "text-gray-400 font-mono" : ""
                            )}>
                              {stringValue}
                            </pre>
                          ) : (
                            <span className={cn(
                              "text-xs",
                              isObject ? "text-gray-400 font-mono" : ""
                            )}>
                              {stringValue.slice(0, 50)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={isObject ? "text-gray-400 text-xs font-mono" : ""}>
                          {stringValue}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!input && !output) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-500 text-sm">No execution data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Input/Output Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setDataTab('input')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            dataTab === 'input'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )}
        >
          Input
        </button>
        <button
          onClick={() => setDataTab('output')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            dataTab === 'output'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )}
        >
          Output
        </button>
      </div>

      {/* View mode tabs, Copy, and Download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('schema')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'schema'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <List className="h-3 w-3" />
            Schema
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'json'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <Braces className="h-3 w-3" />
            JSON
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'table'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <Table2 className="h-3 w-3" />
            Table
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={!currentData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>

          {/* Download Dropdown */}
          <div className="relative group">
            <button
              disabled={!currentData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3 w-3" />
              Download
              <ChevronDown className="h-3 w-3" />
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => handleDownload('json')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-white rounded-t-lg"
              >
                JSON
              </button>
              <button
                onClick={() => handleDownload('csv')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-white rounded-b-lg"
              >
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {!currentData ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-sm">No {dataTab} data available</p>
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          {viewMode === 'json' && (
            <div className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap break-words font-mono">
                {typeof currentData === 'string'
                  ? currentData
                  : JSON.stringify(currentData, null, 2)}
              </pre>
            </div>
          )}

          {viewMode === 'table' && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              {renderTable()}
            </div>
          )}

          {viewMode === 'schema' && (
            <div className="p-4 max-h-[400px] overflow-y-auto">
              <div className="text-sm font-mono">
                {renderValue(currentData)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
