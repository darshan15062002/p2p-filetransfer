# P2P File Transfer

A peer-to-peer file transfer application built with React frontend and Node.js backend with WebSocket support.

## Project Structure

```
├── frontend/          # React application
├── server/           # Node.js Express server with WebSocket
├── .eslintrc.js      # ESLint configuration (root)
├── .prettierrc       # Prettier configuration
└── .prettierignore   # Prettier ignore file
```

## Development Setup

### Prerequisites
- Node.js (>= 16.0.0)
- npm

### Installation

1. Clone the repository
2. Install dependencies for both frontend and server:

```bash
# Install frontend dependencies
cd frontend
npm install

# Install server dependencies
cd ../server
npm install
```

## Code Quality Tools

This project uses ESLint and Prettier to ensure consistent code style and formatting.

### ESLint Configuration

- **Root configuration**: `.eslintrc.js` (base rules)
- **Server configuration**: `server/.eslintrc.js` (Node.js specific)
- **Frontend configuration**: Built-in Create React App ESLint config with React-specific rules

### Prettier Configuration

- Configuration file: `.prettierrc`
- Ignore file: `.prettierignore`

### Available Scripts

#### Frontend (in `frontend/` directory)

```bash
# Development
npm start              # Start development server
npm run build          # Build for production
npm test              # Run tests

# Code Quality
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
npm run format        # Format code with Prettier
npm run format:check  # Check if code is formatted correctly
```

#### Server (in `server/` directory)

```bash
# Development
npm start             # Start server

# Code Quality
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
npm run format        # Format code with Prettier
npm run format:check  # Check if code is formatted correctly
```

### Running Code Quality Checks

To ensure code quality, run these commands before committing:

```bash
# Check and fix linting issues
cd frontend && npm run lint:fix
cd ../server && npm run lint:fix

# Format all code
cd frontend && npm run format
cd ../server && npm run format
```

### Pre-commit Workflow

1. **Lint your code**: `npm run lint` in both frontend and server directories
2. **Format your code**: `npm run format` in both frontend and server directories  
3. **Test the build**: `npm run build` in frontend directory
4. **Commit your changes**

### ESLint Rules

- **Frontend**: Uses Create React App ESLint configuration with React-specific rules
- **Server**: Uses standard ESLint recommended rules for Node.js
- **Common rules**: 
  - `no-unused-vars`: warn
  - `no-console`: off (allowed)
  - `prefer-const`: warn
  - `no-var`: error

### Prettier Configuration

- **Semi-colons**: Required
- **Quotes**: Single quotes preferred
- **Trailing commas**: ES5 compatible
- **Print width**: 80 characters
- **Tab width**: 2 spaces
- **Arrow function parentheses**: Avoid when possible

## Development

### Running the Application

1. **Start the server**:
```bash
cd server
npm start
```

2. **Start the frontend** (in a new terminal):
```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:3000` and the server will run on its configured port.

## Contributing

1. Follow the existing code style
2. Run `npm run lint:fix` and `npm run format` before committing
3. Ensure all tests pass and the build succeeds
4. Keep changes focused and minimal

## License

[Add your license information here]