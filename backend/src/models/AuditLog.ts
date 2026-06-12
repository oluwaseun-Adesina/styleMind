import mongoose from 'mongoose';

// Persistent audit trail. Audit events (logins, wardrobe changes, etc.) are
// written in every environment; warn/error log entries are written in
// production, where nothing is printed to the console.
const RETENTION_DAYS = Number(process.env.AUDIT_LOG_RETENTION_DAYS || 90);

const AuditLogSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['audit', 'warn', 'error'], required: true, index: true },
    // Top-level area the entry belongs to, e.g. 'auth', 'wardrobe', 'app'.
    category: { type: String, required: true, trim: true, maxlength: 40, index: true },
    // Machine-readable event name, e.g. 'auth.login' or 'wardrobe.item_added'.
    action: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 4000 },
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String, trim: true, maxlength: 64 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });
AuditLogSchema.index({ uid: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
