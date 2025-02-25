const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});


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

        // Date is passed as a string, we can convert it to a Date object
        const formattedDate = new Date(date); 

        // Ensure slots are in the correct format
        const formattedSlots = slots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            booked: slot.booked || false  // Default to false if not provided
        }));

        // Add availability to the doctor's schedule
        await Doctor.findByIdAndUpdate(doctorId, { 
            $push: { availability: { date: formattedDate, slots: formattedSlots } } 
        });

        res.status(200).json({ message: "Availability updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating availability", error });
    }
};

exports.forgotPasswordDoctor = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Please provide email" });
        
        const doctor = await Doctor.findOne({ email });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Password Reset Request",
            text: `Please click on the link to reset your password: http://localhost:5000/api/doctors/reset-password/${token}`
        };
        
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Password reset link sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending email", error });
    }
};

// Reset Password
exports.resetPasswordDoctor = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) return res.status(400).json({ message: "Invalid or expired token" });

        const doctor = await Doctor.findOne({ email: decoded.email });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // Hash and update password
        const hashedPassword = await bcrypt.hash(password, 10);
        doctor.password = hashedPassword;
        await doctor.save();

        // ✅ Verify the stored password
        const updatedDoctor = await Doctor.findOne({ email: decoded.email });

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
};


