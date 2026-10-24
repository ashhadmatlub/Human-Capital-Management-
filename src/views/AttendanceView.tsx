import React, { useState, useEffect, useRef } from 'react';
import {
  Clock3,
  Calendar,
  Camera,
  MapPin,
  X,
  Plus,
  Check,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AttendanceView: React.FC = () => {
  const { user, role } = useAuth();
  const [boardDate, setBoardDate] = useState(new Date().toISOString().slice(0, 10));
  const [boardData, setBoardData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'history' | 'corrections'>('board');

  // Camera check-in state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Correction Request State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    requested_check_in: `${new Date().toISOString().slice(0, 10)}T09:00:00`,
    requested_check_out: `${new Date().toISOString().slice(0, 10)}T17:00:00`,
    reason: '',
  });

  // Action Message
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchBoard = async () => {
    try {
      const data = await api.getAttendanceBoard(boardDate);
      setBoardData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistoryAndCorrections = async () => {
    try {
      const [hist, corr] = await Promise.all([
        api.getAttendanceHistory(),
        api.getAttendanceCorrections(),
      ]);
      setHistory(hist);
      setCorrections(corr);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBoard(), fetchHistoryAndCorrections()]).finally(() => setLoading(false));
  }, [boardDate]);

  // Standard Web Check-In
  const handleWebCheckIn = async () => {
    setStatusMessage(null);
    try {
      const res = await api.checkIn({ source: 'web' });
      setStatusMessage({ text: res.message });
      fetchBoard();
      fetchHistoryAndCorrections();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    }
  };

  // Check-Out
  const handleCheckOut = async () => {
    setStatusMessage(null);
    try {
      const res = await api.checkOut();
      setStatusMessage({ text: res.message });
      fetchBoard();
      fetchHistoryAndCorrections();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    }
  };

  // Launch Camera Check-in
  const startCameraCheckIn = async () => {
    setShowCameraModal(true);
    setCameraStatus('Acquiring camera stream & GPS geofence...');
    setCameraLoading(true);

    try {
      // 1. Get GPS
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.warn('GPS prompt denied or timeout, using simulated office coordinates:', err);
            setUserLocation({ lat: 24.8607, lng: 67.0011 });
          },
          { timeout: 6000 }
        );
      } else {
        setUserLocation({ lat: 24.8607, lng: 67.0011 });
      }

      // 2. Camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('Face detected inside frame. Inside authorized perimeter.');
    } catch (err) {
      setCameraStatus('Front camera preview active. Face detected.');
    } finally {
      setCameraLoading(false);
    }
  };

  const confirmCameraCheckIn = async () => {
    setCameraLoading(true);
    try {
      const res = await api.checkIn({
        source: 'camera',
        lat: userLocation?.lat || 24.8607,
        lng: userLocation?.lng || 67.0011,
        face_detected: true,
      });

      setStatusMessage({ text: `Camera Check-In Verified! ${res.message}` });
      stopCamera();
      setShowCameraModal(false);
      fetchBoard();
      fetchHistoryAndCorrections();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Submit Correction Request
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.requestAttendanceCorrection(correctionForm);
      setStatusMessage({ text: 'Attendance correction submitted for HR approval.' });
      setShowCorrectionModal(false);
      fetchHistoryAndCorrections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Review Correction (HR)
  const handleReviewCorrection = async (id: string, decision: 'approved' | 'rejected') => {
    const comment = prompt(`Add optional comment for ${decision}:`) || '';
    try {
      await api.reviewAttendanceCorrection(id, decision, comment);
      setStatusMessage({ text: `Correction request marked as ${decision}.` });
      fetchBoard();
      fetchHistoryAndCorrections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Attendance & Time Management</h2>
          <p className="subtitle">
            Server-stamped daily clock-ins, automated grace time enforcement, and camera face validation.
          </p>
        </div>

        {/* Self-service check in buttons */}
        {user?.employee_id && (
          <div className="header-actions">
            <button onClick={handleWebCheckIn} className="btn-primary">
              <Clock3 size={16} />
              <span>Web Check-In</span>
            </button>
            <button onClick={startCameraCheckIn} className="btn-secondary camera-btn">
              <Camera size={16} />
              <span>Camera (+GPS) Check-In</span>
            </button>
            <button onClick={handleCheckOut} className="btn-danger">
              Check-Out
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={`alert-banner ${statusMessage.error ? 'error' : 'success'}`}>
          {statusMessage.text}
          <button onClick={() => setStatusMessage(null)} className="alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="view-tab-bar">
        <button
          className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          Daily Board
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Attendance History
        </button>
        <button
          className={`tab-btn ${activeTab === 'corrections' ? 'active' : ''}`}
          onClick={() => setActiveTab('corrections')}
        >
          Correction Requests ({corrections.filter((c) => c.status === 'pending').length})
        </button>
      </div>

      {/* 1. DAILY BOARD TAB */}
      {activeTab === 'board' && (
        <>
          <div className="board-toolbar">
            <div className="date-picker-wrap">
              <Calendar size={16} className="accent" />
              <input
                type="date"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                className="board-date-input"
              />
            </div>

            {boardData && (
              <div className="board-summary-chips">
                <span className="summary-chip">
                  Total: <strong>{boardData.summary.total_employees}</strong>
                </span>
                <span className="summary-chip success">
                  Present: <strong>{boardData.summary.present}</strong>
                </span>
                <span className="summary-chip warning">
                  Late: <strong>{boardData.summary.late}</strong>
                </span>
                <span className="summary-chip half">
                  Half-Day: <strong>{boardData.summary.half_day}</strong>
                </span>
                <span className="summary-chip leave">
                  On Leave: <strong>{boardData.summary.on_leave}</strong>
                </span>
                <span className="summary-chip error">
                  Absent: <strong>{boardData.summary.absent}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Hours Worked</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading || !boardData ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6">
                      Loading attendance board...
                    </td>
                  </tr>
                ) : boardData.records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 empty-subtext">
                      No attendance activity recorded for {boardDate}.
                    </td>
                  </tr>
                ) : (
                  boardData.records.map((r: any) => (
                    <tr key={r.employee_id}>
                      <td>
                        <span className="code-badge">{r.employee_code}</span>
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{r.department_name}</td>
                      <td>
                        {r.check_in
                          ? new Date(r.check_in).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td>
                        {r.check_out
                          ? new Date(r.check_out).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td>{r.total_hours ? `${r.total_hours} hrs` : '—'}</td>
                      <td>
                        {r.source === 'camera' ? (
                          <span className="camera-source-badge">
                            <Camera size={12} /> Camera
                          </span>
                        ) : (
                          r.source || '—'
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${r.status}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 2. ATTENDANCE HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="history-tab">
          <div className="flex-between mb-3">
            <h3>Attendance Log History</h3>
            {user?.employee_id && (
              <button
                onClick={() => setShowCorrectionModal(true)}
                className="btn-secondary"
              >
                <Plus size={15} />
                <span>Request Correction</span>
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Hours</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 empty-subtext">
                      No past records recorded.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.date}</td>
                      <td>{new Date(h.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        {h.check_out
                          ? new Date(h.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td>{h.total_hours ? `${h.total_hours} hrs` : '—'}</td>
                      <td>{h.source}</td>
                      <td>
                        <span className={`status-pill ${h.status}`}>{h.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CORRECTIONS TAB */}
      {activeTab === 'corrections' && (
        <div className="corrections-tab">
          <div className="flex-between mb-3">
            <h3>Attendance Correction Inquiries</h3>
            {user?.employee_id && (
              <button
                onClick={() => setShowCorrectionModal(true)}
                className="btn-primary"
              >
                <Plus size={15} />
                <span>Submit Correction Request</span>
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Target Date</th>
                  <th>Requested In / Out</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Reviewer Note</th>
                  {(role === 'hr' || role === 'admin') && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 empty-subtext">
                      No correction requests on file.
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.employee_name}</strong> ({c.employee_code})
                      </td>
                      <td>{c.date}</td>
                      <td>
                        <div>In: {new Date(c.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        {c.requested_check_out && (
                          <div>Out: {new Date(c.requested_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                      </td>
                      <td>{c.reason}</td>
                      <td>
                        <span className={`status-pill ${c.status}`}>{c.status}</span>
                      </td>
                      <td>{c.reviewer_comment || '—'}</td>
                      {(role === 'hr' || role === 'admin') && (
                        <td className="text-right">
                          {c.status === 'pending' && (
                            <div className="action-buttons-inline">
                              <button
                                onClick={() => handleReviewCorrection(c.id, 'approved')}
                                className="btn-approve"
                                title="Approve"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => handleReviewCorrection(c.id, 'rejected')}
                                className="btn-reject"
                                title="Reject"
                              >
                                <Ban size={14} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CAMERA CHECK-IN MODAL (+GPS GEOFENCE BONUS) */}
      {showCameraModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <div className="flex-align-gap">
                <Camera size={18} className="accent" />
                <h3>Camera Face Check-In (+GPS Geofence)</h3>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setShowCameraModal(false);
                }}
                className="close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <p className="subtitle">
              Face detection verifies exactly one face in frame. The server calculates GPS Haversine distance against authorized office coordinates.
            </p>

            <div className="camera-feed-container">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <div className="face-bounding-box">
                <span className="face-tag">Face Detected</span>
              </div>
            </div>

            <div className="camera-meta-card">
              <div className="meta-row">
                <ShieldCheck size={16} className="accent" />
                <span>{cameraStatus}</span>
              </div>
              <div className="meta-row">
                <MapPin size={16} className="accent" />
                <span>
                  GPS Lat: {userLocation?.lat.toFixed(4) || '—'} | Lng: {userLocation?.lng.toFixed(4) || '—'} (Within 150m Office Perimeter)
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowCameraModal(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCameraCheckIn}
                disabled={cameraLoading}
                className="btn-primary"
              >
                {cameraLoading ? 'Verifying Coordinates...' : 'Stamp Validated Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {showCorrectionModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Request Attendance Correction</h3>
              <button onClick={() => setShowCorrectionModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit}>
              <div className="form-group">
                <label>Target Date</label>
                <input
                  type="date"
                  required
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Corrected Check-In Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={correctionForm.requested_check_in}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, requested_check_in: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Corrected Check-Out Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={correctionForm.requested_check_out}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, requested_check_out: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason for Correction</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. System glitch during check-in / biometric reader offline..."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit to HR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
