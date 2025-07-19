const mongoose = require('mongoose');
const codeSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  fileName: { type: String, required: true },
  code: { type: String, required: true },
});
module.exports = mongoose.model('Code', codeSchema);