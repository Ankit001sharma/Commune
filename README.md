# CommuneX - Campus Marketplace & Service Exchange Platform

CommuneX is a full-stack platform designed for campus communities to buy, sell, and exchange services. It features a secure escrow payment system, AI-powered recommendations, real-time chat, and location-based tracking.

## Features

- **Marketplace:** Post and browse products for sale with campus-specific categories.
- **Service Exchange:** Find or offer services like tutoring, freelancing, and more.
- **Community:** Campus bulletin board for announcements, lost & found, and discussions.
- **AI Assistant:** Groq-powered chatbot and natural language search for easy navigation.
- **Secure Transactions:** Escrow-based payment system using a token economy.
- **Real-time Chat:** Instant messaging between buyers and sellers.
- **Location Tracking:** OpenStreetMap integration for item locations and live tracking.

## Tech Stack

- **Frontend:** React, React Router, Leaflet, Socket.io-client, Axios.
- **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.io.
- **AI:** Groq API (Llama models).
- **Storage:** Cloudinary for image management.
- **Security:** JWT Authentication, Helmet, Rate Limiting.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB
- Cloudinary Account
- Groq API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Commune--X.git
   cd Commune--X
   ```

2. Install Backend Dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Install Frontend Dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

### Configuration

1. Create a `.env` file in the `backend` directory based on `.env.example`.
2. Update the environment variables with your credentials.

### Running the Application

1. Start the Backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the Frontend:
   ```bash
   cd frontend
   npm start
   ```

3. Access the application at `http://localhost:3000`.

## Project Structure

- `backend/`: Express server, controllers, models, and services.
- `frontend/`: React application, components, and pages.


