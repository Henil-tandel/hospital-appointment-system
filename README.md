# Hospital Appointment System

This is a Hospital Appointment System API built with Node.js, Express, and MongoDB. It allows patients to register, login, search for doctors, and book appointments. Doctors can register, login, and add their availability.

## Features

- Patient registration and login
- Doctor registration and login
- Search for doctors by specialization and availability
- Book appointments
- View and cancel patient appointments
- View and update doctor appointments
- Forgot and reset password for patients and doctors

## Technologies Used

- Node.js
- Express
- MongoDB
- Mongoose
- JWT for authentication
- bcrypt for password hashing
- dotenv for environment variables

## Getting Started

### Prerequisites

- Node.js installed
- MongoDB installed and running

### Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/hospital-appointment-system.git
    cd hospital-appointment-system
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add the following environment variables:
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    EMAIL=your_email
    EMAIL_PASSWORD=your_email_password
    ```

4. Start the server:
    ```bash
    npm start
    ```

The server will start on `http://localhost:5000`.

## API Endpoints

### Patient Routes

- `POST /api/patients/register` - Register a new patient
- `POST /api/patients/login` - Login a patient
- `GET /api/patients/search-doctors` - Search for doctors by specialization and availability
- `POST /api/patients/book-appointment` - Book an appointment (requires authentication)
- `GET /api/patients/appointments/:patientId` - View patient appointments (requires authentication)
- `DELETE /api/patients/delete-appointment/:appointmentId` - Cancel an appointment (requires authentication)
- `POST /api/patients/forgot-password` - Forgot password for patient
- `POST /api/patients/reset-password/:token` - Reset password for patient

### Doctor Routes

- `POST /api/doctors/register` - Register a new doctor
- `POST /api/doctors/login` - Login a doctor
- `POST /api/doctors/add-availability` - Add availability (requires authentication)
- `GET /api/doctors/appointments/:doctorId` - View doctor's appointments (requires authentication)
- `PUT /api/doctors/update-appointment/:appointmentId` - Update an appointment
- `POST /api/doctors/forgot-password` - Forgot password for doctor
- `POST /api/doctors/reset-password/:token` - Reset password for doctor

## License

This project is licensed under the MIT License.
