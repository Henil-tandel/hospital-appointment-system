const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Patient", patientSchema);
