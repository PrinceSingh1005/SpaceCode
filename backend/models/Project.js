const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Current session collaborators
  inviteCode: { type: String }, // Unique code for joining, null when session ends
  sessionActive: { type: Boolean, default: true }, // Tracks if the session is active
  files: [{
    name: String,
    content: String,
    lastModified: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

projectSchema.pre('save', async function (next) {
  // Update timestamps
  this.updatedAt = Date.now();
  next();
});

// Method to end session (reset collaborators and invite code)
projectSchema.methods.endSession = async function () {
  this.updatedAt = Date.now();
  this.collaborators = [this.owner]; // Reset to only owner
  this.inviteCode = null; // Invalidate invite code
  this.sessionActive = false;
  await this.save();

  // Remove project from joined lists of collaborators
  const User = mongoose.model('User');
  await User.updateMany(
    { _id: { $in: this.collaborators }, projectsJoined: this._id },
    { $pull: { projectsJoined: this._id } }
  );
};

module.exports = mongoose.model('Project', projectSchema);