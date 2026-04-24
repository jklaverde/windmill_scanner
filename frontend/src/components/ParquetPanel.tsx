/**
 * Right panel: Parquet File Manager.
 *
 * Lists archive files with size, data range, modified date, in-use status.
 * Delete button per file (blocked if in-use; no confirmation dialog).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import type { ParquetFile } from "../domain/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}

export default function ParquetPanel() {
  const qc = useQueryClient();

  const { data: files, isLoading, isError } = useQuery({
    queryKey: ["parquet-files"],
    queryFn: () => api.get<ParquetFile[]>("/parquet-files").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (windmill_id: string) => api.delete(`/parquet-files/${windmill_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parquet-files"] }),
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Parquet Files</span>
      </div>

      <div className="flex-1 panel-scroll min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-sm text-gray-500 text-center mt-8">Failed to load files.</p>
        ) : !files || files.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">
            No archive files yet. Run ETL on a windmill to generate one.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">File</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600">Size</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600">First</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600">Last</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.windmill_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-800">
                    {f.windmill_id}.parquet
                    {f.in_use && (
                      <span className="ml-1 text-green-600 text-[10px]">●</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-500">{formatBytes(f.size_bytes)}</td>
                  <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">{fmtTs(f.first_timestamp)}</td>
                  <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">{fmtTs(f.last_timestamp)}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      disabled={f.in_use || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(f.windmill_id)}
                      title={f.in_use ? `Stop windmill ${f.windmill_id} first` : "Delete file"}
                      className="text-red-500 disabled:opacity-30 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
