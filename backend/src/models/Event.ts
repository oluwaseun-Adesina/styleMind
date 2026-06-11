import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Calendar date in the user's local timezone, stored as YYYY-MM-DD.
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, trim: true, maxlength: 5 }, // optional HH:MM
  },
  { timestamps: true }
);

EventSchema.index({ uid: 1, date: 1 });

export const Event = mongoose.model('Event', EventSchema);
