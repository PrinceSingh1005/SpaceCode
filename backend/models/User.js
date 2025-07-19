const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }, // Default role is admin
  projectsOwned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Projects created by the user
  projectsJoined: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Projects joined via invite (session-based)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  // Update timestamps
  this.updatedAt = Date.now();
  next();
});

// Method to update projectsOwned and projectsJoined
userSchema.methods.updateProjectAssociations = async function (projectId, isOwned = false) {
  this.updatedAt = Date.now();
  if (isOwned) {
    if (!this.projectsOwned.includes(projectId)) {
      this.projectsOwned.push(projectId);
    }
  } else {
    if (!this.projectsJoined.includes(projectId)) {
      this.projectsJoined.push(projectId);
    }
  }
  await this.save();
};

// Method to remove project from joined (on session end)
userSchema.methods.removeJoinedProject = async function (projectId) {
  this.updatedAt = Date.now();
  this.projectsJoined = this.projectsJoined.filter(id => id.toString() !== projectId.toString());
  await this.save();
};

module.exports = mongoose.model('User', userSchema);