const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Register Patient
exports.registerPatient = async (req, res) => {
    try {
        const { name, email, password, age, gender } = req.body;
        if (!name || !email || !password || !age || !gender) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patient = new Patient({ name, email, password: hashedPassword, age, gender });
        await patient.save();

        res.status(201).json({ message: "Patient registered successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error registering patient", error });
    }
};

// Patient Login
exports.loginPatient = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(400).json({ message: "Invalid credentials (user not found)" });
        }

        console.log("Stored Hashed Password:", patient.password);

        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials (password mismatch)" });
        }

        const token = jwt.sign({ id: patient._id, role: "patient" }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error });
    }
};


// Search for Doctors by Specialization & Availability
exports.searchDoctors = async (req, res) => {
    try {
        const { specialization, date, timeSlot } = req.query;
        if (!specialization || !date || !timeSlot) {
            return res.status(400).json({ message: "Specialization, date, and timeSlot are required" });
        }

        const availableDoctors = await Doctor.find({
            specialization,
            "availability.date": date,
            "availability.slots.startTime": timeSlot,
            "availability.slots.booked": false
        });

        res.json(availableDoctors);
    } catch (error) {
        res.status(500).json({ message: "Error fetching available doctors", error });
    }
};

// Search for Doctors by Specialization
exports.searchDoctorsBySpecialzation = async (req, res) => {
    try {
        const { specialization } = req.query;
        if (!specialization) {
            return res.status(400).json({ message: "Specialization is required" });
        }
        const doctors = await Doctor.find({ specialization });
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doctors by specialization", error });
    }
};

// Book an Appointment
exports.bookAppointment = async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot } = req.body;
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        let slotFound = false;
        doctor.availability.forEach((avail) => {
            if (avail.date.toISOString().split("T")[0] === date) {
                avail.slots.forEach((slot) => {
                    if (slot.startTime === timeSlot && !slot.booked) {
                        slot.booked = true;
                        slotFound = true;
                    }
                });
            }
        });

        if (!slotFound) return res.status(400).json({ message: "Time slot not available" });
        await doctor.save();

        const appointment = new Appointment({ patientId, doctorId, date, timeSlot });
        await appointment.save();

        res.status(201).json({ message: "Appointment booked successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error booking appointment", error });
    }
};

// View Patient's Appointments
exports.getAppointments = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!patientId) return res.status(400).json({ message: "Patient ID is required" });
        const appointments = await Appointment.find({ patientId }).populate("doctorId", "name specialization");
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching appointments", error });
    }
};

//Cancel appointment
exports.cancelAppointment = async(req,res) => {
    try{
        const  { appointmentId } = req.params;
    if(!appointmentId) return res.status(400).json({message : "Appointment ID is required"});
    const appointment = await Appointment.findById(appointmentId);

    if(!appointment) return res.status(404).json({message : "Appointment not found"});

    const doctor = await Doctor.findById(appointment.doctorId);
    if(!doctor) return res.status(404).json({message : "Doctor not found"});

    doctor.availability.forEach((avail) => {
        if(avail.date.toISOString().split('T')[0] === appointment.date.toISOString().split('T')[0]){
            avail.slots.forEach((slot) => {
                if(slot.startTime === appointment.timeSlot){
                    slot.booked = false;
                }
            });
        } 
    })
    await doctor.save();

     // Remove appointment from DB
     await Appointment.findByIdAndDelete(appointmentId);
     res.json({ message: "Appointment cancelled successfully" });
    }
    catch(error){
        res.status(500).json({message : "Error cancelling appointment", error});
    }
}


// Forgot Password
exports.forgotPasswordPatient = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Please provide email" });
        
        const patient = await Patient.findOne({ email });
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Password Reset Request",
            text: `Please click on the link to reset your password: http://localhost:5000/api/patients/reset-password/${token}`
        };
        
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Password reset link sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending email", error });
    }
};

// Reset Password
exports.resetPasswordPatient = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) return res.status(400).json({ message: "Invalid or expired token" });

        const patient = await Patient.findOne({ email: decoded.email });
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        // Hash and update password
        const hashedPassword = await bcrypt.hash(password, 10);
        patient.password = hashedPassword;
        await patient.save();

        // ✅ Verify the stored password
        const updatedPatient = await Patient.findOne({ email: decoded.email });

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
};

