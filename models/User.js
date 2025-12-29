// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  psid: { type: String, required: true, unique: true }, // The Facebook Sender ID
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);