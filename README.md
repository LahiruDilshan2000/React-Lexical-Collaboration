# Collaborative Text Editor

A powerful real-time collaborative text editor built with React, TypeScript, Lexical, Yjs, and MongoDB.

## Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Rich Text Editing**: Built with Lexical editor framework
- **Persistent Storage**: Documents are stored in MongoDB
- **WebSocket Communication**: Real-time updates via WebSocket connections
- **Authentication**: Token-based authentication system
- **Modern UI**: Clean and responsive user interface

## Project Structure

```
├── frontend/          # React frontend application
│   ├── src/          # Source code
│   ├── package.json  # Frontend dependencies
│   └── ...
├── backend/          # Node.js backend server
│   ├── src/          # Source code
│   ├── package.json  # Backend dependencies
│   └── ...
├── package.json      # Root package.json with scripts
└── README.md         # This file
```

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or accessible)
- npm or yarn

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-text-editor
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   
   Create `.env` files in both frontend and backend directories:
   
   **Backend (.env)**
   ```env
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=sharenest
   MONGODB_COLLECTION=content
   PORT=1234
   HOST=localhost
   ```
   
   **Frontend (.env)**
   ```env
   VITE_WS_URL=ws://localhost:1234
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   ```

5. **Run the application**
   ```bash
   npm run dev
   ```

   This will start both frontend and backend servers concurrently.

## Development

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only the frontend
- `npm run dev:backend` - Start only the backend
- `npm run build` - Build both frontend and backend for production
- `npm run install:all` - Install dependencies for both frontend and backend

### Frontend

The frontend is built with:
- React 18
- TypeScript
- Lexical (rich text editor)
- Yjs (collaborative editing)
- Vite (build tool)
- Tailwind CSS (styling)

### Backend

The backend is built with:
- Node.js
- TypeScript
- Express
- WebSocket (y-websocket)
- MongoDB (with custom persistence)
- Yjs

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Set an authentication token (required for collaboration)
3. Enter a document ID to load an existing document or create a new one
4. Start editing! Changes will be synchronized in real-time

## API Endpoints

- `GET /` - Health check
- `WebSocket /` - Real-time collaboration endpoint

## Environment Variables

### Backend
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name
- `MONGODB_COLLECTION` - Collection name for documents
- `PORT` - Server port (default: 1234)
- `HOST` - Server host (default: localhost)

### Frontend
- `VITE_WS_URL` - WebSocket server URL

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
