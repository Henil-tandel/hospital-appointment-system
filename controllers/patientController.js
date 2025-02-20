const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

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
        if (!patient || !(await bcrypt.compare(password, patient.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
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

//Search for Doctors by Specialization
exports.searchDoctorsBySpecialzation = async (req,res) => {
    try{
        const {specialization} = req.query;
        if(!specialization){
            return res.status(400).json({message:"Specialization is required"});
        }
        const doctor = await Doctor.find({specialization});
        res.json(doctor);
    }
    catch(error){
        res.status(500).json({message:"Error fetching doctors by specialization",error});
    }    
}

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
