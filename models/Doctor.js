const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, match: /^\S+@\S+\.\S+$/ },
    password: { type: String, required: true },
    specialization: { type: String, required: true },
    experience: { type: Number, required: true, min: 1 },
    location: { type: String, required: true },
    rating: { type: Number, default: 0, min: 0, max: 5 }, // Average rating
    ratingCount: { type: Number, default: 0 }, // Total number of reviews
    availability: [{ 
        date: { type: Date, required: true },
        slots: [{ 
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
            isBooked: { type: Boolean, default: false } // Tracks if slot is booked
        }],
        maxBookingsPerSlot: { type: Number, default: 5, min: 1 } // Doctor-defined limit
    }],
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model("Doctor", doctorSchema);
