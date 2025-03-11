const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult, check } = require("express-validator");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
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
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password must be at least 6 characters long").isLength({ min: 6 }).run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, specialization, experience,location } = req.body;
        
        const existingDoctor = await Doctor.findOne({ email });
        if (existingDoctor) {
            return res.status(400).json({ message: "Doctor already registered with this email" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const doctor = new Doctor({ name, email, password: hashedPassword, specialization, experience,location });
        await doctor.save();

        res.status(201).json({ message: "Doctor registered successfully" });
    } catch (error) {
        console.error("Error registering doctor:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Doctor Login
exports.loginDoctor = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password is required").notEmpty().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const doctor = await Doctor.findOne({ email });
        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: doctor._id, role: "doctor" }, process.env.JWT_SECRET, { expiresIn: "1d" });

        res.json({ message: "Login successful", token });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

//Get Profile
exports.viewProfile = async(req,res) => {
    try { 
        const { doctorId } = req.params;
        const doctor = await Doctor.findById(doctorId).select("-password");
        if(!doctor) { 
            return res.status(404).json({message : "Doctor not found"})
        }
        res.status(200).json({doctor});
    }
    catch (error) {
        console.error("Error updating details:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
} 

// Update Doctor Details
exports.updateDetails = async (req, res) => {
    try {
        await check("doctorId", "Doctor ID is required").notEmpty().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { doctorId, name, specialization, experience ,location } = req.body;

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctorId,
            { name, specialization, experience,location },
            { new: true, runValidators: true }
        );

        if (!updatedDoctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        res.status(200).json({ message: "Doctor details updated successfully", doctor: updatedDoctor });
    } catch (error) {
        console.error("Error updating details:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Add Availability
exports.addAvailability = async (req, res) => {
    try {
        await check("doctorId", "Doctor ID is required").notEmpty().run(req);
        await check("date", "Valid date is required").isISO8601().run(req);
        await check("slots", "Slots must be an array").isArray().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { doctorId, date, slots } = req.body;
        const formattedSlots = slots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            booked: slot.booked || false
        }));

        await Doctor.findByIdAndUpdate(doctorId, {
            $push: { availability: { date: new Date(date), slots: formattedSlots } }
        });

        res.status(200).json({ message: "Availability updated successfully" });
    } catch (error) {
        console.error("Error updating availability:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Fetch Doctor's Appointments
exports.getDoctorAppointments = async (req, res) => {
    try {
        const { doctorId } = req.params;
        if (!doctorId) {
            return res.status(400).json({ message: "Doctor ID is required" });
        }

        const appointments = await Appointment.find({ doctorId }).populate("patientId", "name age gender");
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Update Appointment
exports.updateAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { date, time, status } = req.body;
        
        if (!appointmentId) {
            return res.status(400).json({ message: "Appointment ID is required" });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        if (date) appointment.date = date;
        if (time) appointment.time = time;
        if (status) appointment.status = status;
        
        await appointment.save();
        res.status(200).json({ message: "Appointment updated successfully" });
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Cancel Appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        if (!appointmentId) {
            return res.status(400).json({ message: "Appointment ID is required" });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        await Appointment.findByIdAndDelete(appointmentId);
        res.status(200).json({ message: "Appointment cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Forgot Password
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
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Internal Server Error" });
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

        const hashedPassword = await bcrypt.hash(password, 10);
        doctor.password = hashedPassword;
        await doctor.save();

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
