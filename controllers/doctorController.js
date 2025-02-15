const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");

// Register Doctor
exports.registerDoctor = async (req, res) => {
    try {
        const { name, email, password, specialization, experience } = req.body;

        if (!name || !email || !password || !specialization || !experience) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const doctor = new Doctor({ name, email, password: hashedPassword, specialization, experience });
        await doctor.save();

        res.status(201).json({ message: "Doctor registered successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error registering doctor", error });
    }
};

// Doctor Login
exports.loginDoctor = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const doctor = await Doctor.findOne({ email });
        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: doctor._id, role: "doctor" }, process.env.JWT_SECRET, { expiresIn: "1d" });

        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error });
    }
};

// Add Availability
exports.addAvailability = async (req, res) => {
    try {
        const { doctorId, date, slots } = req.body;
        await Doctor.findByIdAndUpdate(doctorId, { $push: { availability: { date, slots } } });
        res.status(200).json({ message: "Availability updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating availability", error });
    }
};

