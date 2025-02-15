const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        unique: true, 
        required: true, 
        match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true },
    specialization: { type: String, required: true },
    experience: { type: Number, required: true, min: 1 },
    availability: [{ 
        date: { type: Date, required: true },
        slots: [{ startTime: String, endTime: String, booked: Boolean }]
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Doctor", doctorSchema);
