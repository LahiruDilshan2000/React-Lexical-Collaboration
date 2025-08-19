# Sharenest Backend

The backend server for the Sharenest collaborative text editor, built with Node.js, TypeScript, Yjs, and MongoDB.

## Features

- Real-time WebSocket communication
- MongoDB persistence for documents
- Yjs CRDT for conflict resolution
- TypeScript for type safety

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env .env
```

Edit the `.env` file with your MongoDB configuration:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=sharenest
MONGODB_COLLECTION=content

# JWT Authentication
JWT_SECRET=CHE_96_ED_$%_33

# Server Configuration
PORT=1234
HOST=localhost

# Yjs Configuration
GC=true
```

### 3. Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API

### WebSocket Endpoints

- `ws://localhost:1234/{documentId}` - Connect to a collaborative document

### HTTP Endpoints

- `GET /` - Health check endpoint

## Architecture

The backend uses:

- **Yjs** for conflict-free real-time collaboration
- **y-mongodb-provider** for MongoDB persistence
- **WebSocket** for real-time communication
- **TypeScript** for type safety

## MongoDB Setup

Make sure MongoDB is running and accessible. The server will automatically create the necessary collections and indexes.

## Production Deployment

1. Build the project: `npm run build`
2. Set production environment variables
3. Start the server: `npm start`

The server will run on the configured port (default: 1234).


