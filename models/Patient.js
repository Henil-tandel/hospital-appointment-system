const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true },
    age: { type: Number, required: true, min: 1 },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    reviews: [{
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true }, 
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
        rating: { type: Number, required: true, min: 0, max: 5 },
        comment: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model("Patient", patientSchema);
