import { useState, useEffect } from 'react';

function NoteModal({ initialNote, onSave, onClose }) {
  const [note, setNote] = useState(initialNote || '');

  useEffect(() => {
    setNote(initialNote || '');
  }, [initialNote]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(note);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Note</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <textarea
              className="form-input"
              rows="5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter notes here..."
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NoteModal;
