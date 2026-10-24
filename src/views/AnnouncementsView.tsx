import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, X, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AnnouncementsView: React.FC = () => {
  const { role } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'normal' | 'important' | 'urgent',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAnnouncement(form);
      setStatusMessage('Announcement posted to all user portals.');
      setShowModal(false);
      setForm({ title: '', content: '', priority: 'normal' });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Company Noticeboard & Announcements</h2>
          <p className="subtitle">
            Broadcast official operational updates, holiday notices and policy revisions across all dashboards.
          </p>
        </div>

        {(role === 'admin' || role === 'hr') && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Post Announcement
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="alert-banner success">
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="announcements-grid">
        {loading ? (
          <p className="text-center py-8">Loading notices...</p>
        ) : announcements.length === 0 ? (
          <p className="text-center py-8 empty-subtext">No company announcements posted.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="announcement-full-card">
              <div className="announcement-card-header">
                <div className="flex-align-gap">
                  <Megaphone size={16} className="accent" />
                  <h3>{a.title}</h3>
                </div>
                <span className={`priority-tag ${a.priority}`}>{a.priority}</span>
              </div>
              <p className="announcement-card-body">{a.content}</p>
              <div className="announcement-card-footer">
                <span>By: <strong>{a.author_name}</strong></span>
                <span>{new Date(a.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POST ANNOUNCEMENT MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Post Company Announcement</h3>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePostSubmit}>
              <div className="form-group">
                <label>Notice Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid-ul-Fitr Holiday Schedule"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Priority Level</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label>Announcement Details</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write message to broadcast..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
