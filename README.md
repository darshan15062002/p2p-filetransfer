# P2P File Transfer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)
![WebRTC](https://img.shields.io/badge/WebRTC-Supported-orange.svg)

A modern, secure peer-to-peer file transfer application that enables direct file sharing between browsers without uploading files to any server. Built with React and WebRTC technology for fast, private file transfers.

## ✨ Features

- **🔒 Secure & Private**: Files are transferred directly between peers using WebRTC - no server storage
- **⚡ Fast Transfer**: Direct peer-to-peer connection for optimal transfer speeds
- **📱 Cross-Platform**: Works on any modern web browser (desktop & mobile)
- **🎯 Easy to Use**: Simple drag-and-drop interface or click to select files
- **📊 Real-time Progress**: Live progress tracking during file transfers
- **🔗 QR Code Sharing**: Generate QR codes for easy connection between devices
- **🎨 Modern UI**: Beautiful, responsive interface with smooth animations
- **📋 Copy Links**: One-click link copying for easy sharing

## 🏗️ Architecture

This application consists of two main components:

1. **Frontend (React)**: Modern web interface for file selection and transfer management
2. **Signaling Server (Node.js)**: WebSocket server for establishing peer-to-peer connections

The application uses WebRTC for direct browser-to-browser communication, with the signaling server only facilitating the initial connection handshake.

## 🚀 Quick Start

### Prerequisites

- Node.js 16 or higher
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/darshan15062002/p2p-filetransfer.git
   cd p2p-filetransfer
   ```

2. **Setup the server**
   ```bash
   cd server
   npm install
   ```

3. **Setup the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the signaling server**
   ```bash
   cd server
   npm start
   # Or for development with nodemon:
   node server.js
   ```
   The server will run on `http://localhost:3001`

2. **Start the frontend (in a new terminal)**
   ```bash
   cd frontend
   npm start
   ```
   The application will open in your browser at `http://localhost:3000`

### Building for Production

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy the server**
   The server is ready for production deployment. Set the `PORT` environment variable as needed.

## 📖 Usage

### Sending Files

1. Open the application in your browser
2. Drag and drop a file onto the upload area, or click to browse and select a file
3. Copy the generated link or scan the QR code with the recipient's device
4. Wait for the recipient to connect
5. File transfer will begin automatically once connected

### Receiving Files

1. Click the link provided by the sender or scan their QR code
2. The application will automatically connect to the sender
3. File transfer will begin and you'll see progress updates
4. Once complete, the file will automatically download to your device

## 🛠️ Technology Stack

### Frontend
- **React 19.0.0** - UI framework
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **QRCode.react** - QR code generation
- **WebRTC** - Peer-to-peer communication

### Backend
- **Node.js** - Server runtime
- **Express** - Web framework
- **WebSocket (ws)** - Real-time signaling
- **CORS** - Cross-origin resource sharing

### Infrastructure
- **Firebase Hosting** - Frontend deployment
- **WebRTC STUN/TURN servers** - NAT traversal

## 🌐 Deployment

### Frontend (Firebase Hosting)

The project is configured for Firebase Hosting:

```bash
cd frontend
npm run build
firebase deploy
```

### Server Deployment

The signaling server can be deployed to any Node.js hosting platform:

- **Render** (current): Configured for easy deployment
- **Heroku**: Add `package.json` to root or use server folder
- **Railway**: Direct deployment from server folder
- **DigitalOcean App Platform**: Container or buildpack deployment

Set the following environment variables:
- `PORT`: Server port (defaults to 3001)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/YOUR_USERNAME/p2p-filetransfer.git
   ```
3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Guidelines

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Test your changes thoroughly before submitting
- Update documentation if needed

### Code Style

- **Frontend**: Follow React best practices and hooks patterns
- **Backend**: Use consistent async/await patterns
- **Comments**: Add comments for complex logic
- **Formatting**: Use consistent indentation (2 spaces)

### Testing

```bash
# Test frontend
cd frontend
npm test

# Test frontend build
npm run build
```

### Submitting Changes

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Screenshots for UI changes
   - Any breaking changes noted

### Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce the issue
- Provide browser/system information
- Add screenshots if applicable

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WebRTC technology for enabling peer-to-peer connections
- Create React App for the initial project setup
- Firebase for hosting infrastructure
- Open source community for various dependencies

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/darshan15062002/p2p-filetransfer/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your setup and the issue

---

**Made with ❤️ for secure, private file sharing**