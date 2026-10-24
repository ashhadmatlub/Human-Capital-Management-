import React, { useState, useEffect } from 'react';
import { Search, X, FileJson } from 'lucide-react';
import { api } from '../api/client';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await api.getAuditLogs();
        setLogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const s = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      l.actor_name.toLowerCase().includes(s) ||
      l.actor_role.toLowerCase().includes(s) ||
      l.entity.toLowerCase().includes(s)
    );
  });

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Security & Compliance Audit Trail</h2>
          <p className="subtitle">
            Tamper-proof log of create, update, approve and finalize actions. Only Administrator has viewing access.
          </p>
        </div>
      </div>

      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by action, actor, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Executed</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Target Entity</th>
              <th className="text-right">State Diff</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-6">
                  Loading security audit trail...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 empty-subtext">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="timestamp-badge">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span className="audit-action-tag">{log.action}</span>
                  </td>
                  <td>
                    <strong>{log.actor_name}</strong>
                  </td>
                  <td>
                    <span className={`role-badge ${log.actor_role}`}>{log.actor_role}</span>
                  </td>
                  <td>
                    <code>{log.entity}</code> {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                  </td>
                  <td className="text-right">
                    {(log.before_state || log.after_state) ? (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="table-action-btn"
                        title="View JSON Diff"
                      >
                        <FileJson size={15} /> View Diff
                      </button>
                    ) : (
                      <span className="muted-text">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* JSON DIFF MODAL */}
      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-box large">
            <div className="modal-header">
              <h3>Audit Event State Diff: {selectedLog.action}</h3>
              <button onClick={() => setSelectedLog(null)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="meta-text mb-3">
              Actor: <strong>{selectedLog.actor_name}</strong> ({selectedLog.actor_role}) on {new Date(selectedLog.created_at).toLocaleString()}
            </div>

            <div className="two-column-grid">
              <div className="panel">
                <h4>Before State</h4>
                <pre className="json-pre">
                  {selectedLog.before_state
                    ? JSON.stringify(selectedLog.before_state, null, 2)
                    : '// No prior state (New Entity Created)'}
                </pre>
              </div>

              <div className="panel">
                <h4>After State</h4>
                <pre className="json-pre">
                  {selectedLog.after_state
                    ? JSON.stringify(selectedLog.after_state, null, 2)
                    : '// No state recorded'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
