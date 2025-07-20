import React, { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import background from '../src/assets/bg.jpg';
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
const App = () => {
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [peerId, setPeerId] = useState('');
  console.log(peerId, '-----------------------------------');
  const [isReceiver, setIsReceiver] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [receivedChunks, setReceivedChunks] = useState([]);
  const [receivedMetadata, setReceivedMetadata] = useState(null);
  const [myId, setMyId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socket, setSocket] = useState(null);
  const peerConnection = useRef(null);
  const dataChannelRef = useRef(null);

  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect({ target: { files: [droppedFile] } });
    }
  };

  const handleFileSelect = e => {
    e.preventDefault?.(); // This line won't break if `e` is a mock
    const file = e.target?.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const connectToPeer = async peerId => {
    try {
      if (!socket) return;
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket?.send(
        JSON.stringify({ type: 'signal', to: peerId, signal: offer })
      );
      console.log('send offer to peer', offer);
    } catch (error) {
      console.log('Error sendding offer to peer', error);
    }
  };

  const sendFile = async () => {
    if (!file || !dataChannelRef.current) return;

    const CHUNK_SIZE = 16384; // 16KB chunks
    const fileReader = new FileReader();
    let offset = 0;

    // First send the file metadata
    const fileMetadata = {
      type: 'metadata',
      name: file.name,
      size: file.size,
      fileType: file.type,
    };
    dataChannelRef?.current?.send(JSON.stringify(fileMetadata));

    fileReader.onload = e => {
      try {
        const chunk = e.target.result;
        dataChannelRef.current?.send(chunk);
        offset += chunk.byteLength;

        // Calculate and update progress
        const progress = (offset / file.size) * 100;
        setProgress(progress);

        // Check if we have more chunks to send
        if (offset < file.size) {
          readNextChunk();
        } else {
          // Send transfer complete message
          dataChannelRef?.current?.send(JSON.stringify({ type: 'complete' }));
          setProgress(0);
          setFile(null);
        }
      } catch (error) {
        console.log(error);
      }
    };

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      fileReader.readAsArrayBuffer(slice);
    };

    // Start the transfer
    readNextChunk();
  };

  useEffect(() => {
    if (!peerConnection.current && !peerId && !socket)
      return console.log('No peer connection or peer id');

    peerConnection.current.onicecandidate = async event => {
      console.log('onicecandidate', {
        type: 'signal',
        to: peerId,
        signal: { type: 'candidate', candidate: event.candidate },
      });

      socket?.send(
        JSON.stringify({
          type: 'signal',
          to: peerId,
          signal: { type: 'candidate', candidate: event.candidate },
        })
      );
    };
    peerConnection.current.onconnectionstatechange = event => {
      console.log('Connection state:', peerConnection.current.connectionState);
    };

    peerConnection.current.ondatachannel = event => {
      const rdc = event.channel;

      // Create a separate array for tracking chunks that persists between renders
      let fileChunks = [];
      let fileMetadata = null;

      rdc.onmessage = e => {
        console.log('Received message:', e.data);
        try {
          if (typeof e.data === 'string') {
            const data = JSON.parse(e.data);
            console.log('Received string data:', data);

            if (data.type === 'metadata') {
              console.log('Received metadata:', data);
              fileMetadata = data;
              fileChunks = []; // Reset chunks for new file
              setReceivedMetadata(data);
              setReceivedChunks([]);
            }

            if (data.type === 'complete') {
              console.log('Transfer complete, creating file...');
              console.log(
                `Assembled ${fileChunks.length} chunks with total size: ${fileChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)} bytes`
              );

              // Combine all chunks and create file
              const blob = new Blob(fileChunks, {
                type: fileMetadata?.fileType || 'application/octet-stream',
              });

              console.log(`Created blob with size: ${blob.size} bytes`);

              // Create and trigger download
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileMetadata?.name || 'downloaded_file';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              // Cleanup
              URL.revokeObjectURL(url);
              fileChunks = [];
              fileMetadata = null;
              setReceivedChunks([]);
              // setReceivedMetadata(null);
              // setProgress(0);
            }
          } else {
            // Handle binary chunk
            console.log('Received chunk size:', e.data.byteLength);

            // Store chunk in both local variable and state
            fileChunks.push(e.data);
            setReceivedChunks(chunks => [...chunks, e.data]);

            // Update progress if we have metadata
            if (fileMetadata) {
              const totalReceived = fileChunks.reduce(
                (acc, chunk) => acc + chunk.byteLength,
                0
              );

              const progress = (totalReceived / fileMetadata.size) * 100;
              console.log(
                `Progress: ${progress.toFixed(1)}% (${totalReceived}/${fileMetadata.size} bytes)`
              );
              setProgress(progress);
            }
          }
        } catch (error) {
          console.error('Error in onmessage:', error);
        }
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerConnection.current, peerId, dataChannelRef.current]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const peerIdFromUrl = urlParams.get('peerId');
    setIsReceiver(!!peerIdFromUrl);
    setPeerId(peerIdFromUrl);

    setTimeout(() => {
      if (
        peerIdFromUrl &&
        peerConnection.current &&
        dataChannelRef.current &&
        socket &&
        myId
      ) {
        connectToPeer(peerIdFromUrl);
      }
    }, 4000);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerConnection.current, dataChannelRef.current, socket, myId]);

  useEffect(() => {
    let pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
        {
          urls: 'turn:relay.metered.ca:80',
          username: 'free',
          credential: 'free',
        },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'open',
          credential: 'open',
        },
      ],
    });
    let dc = pc.createDataChannel('fileTransfer');
    peerConnection.current = pc;

    dataChannelRef.current = dc;

    dc.onopen = () => {
      setConnectionStatus('connected');
    };

    dc.onclose = () => {
      setConnectionStatus('disconnected');
    };

    // const _socket = new WebSocket('ws://localhost:3001')
    const _socket = new WebSocket('https://p2p-filetransfer.onrender.com');

    setSocket(_socket);

    _socket.onmessage = async event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connect') {
          setMyId(data.clientId);
        } else if (data.type === 'signal') {
          if (data.signal.type === 'offer') {
            setPeerId(data.from);
            await peerConnection?.current?.setRemoteDescription(data.signal);
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            _socket?.send(
              JSON.stringify({ type: 'signal', to: data.from, signal: answer })
            );
            console.log('send answer to peer', answer);
          } else if (data.signal.type === 'answer') {
            await peerConnection?.current?.setRemoteDescription(data.signal);
            console.log('set answer from peer', data.signal);
          } else if (data.signal.type === 'candidate') {
            if (!data.signal.candidate) return;
            await peerConnection.current.addIceCandidate(data.signal.candidate);
            console.log('add ice candidate', data.signal.candidate);
          }
        }
      } catch (error) {
        console.log(error);
      }
    };
  }, []);

  useEffect(() => {
    connectionStatus === 'connected' && sendFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

  const link = `${window.location.origin}/?peerId=${myId}`;

  return (
    <div className="min-h-screen bg-[#0B1120] bg-gradient-to-br from-[#0B1120] via-[#1E293B] to-[#0B1120] text-white flex items-center justify-center p-6">
      <motion.div
        className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 w-full max-w-xl rounded-2xl shadow-2xl p-8 border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {!file && !isReceiver && (
          <>
            <h2 className="text-4xl font-bold text-center bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-8">
              Secure File Transfer
            </h2>

            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative flex flex-col items-center justify-center border-2 border-dashed ${
                isDragActive ? 'border-blue-400/50' : 'border-white/20'
              } bg-gradient-to-br from-white/5 to-transparent rounded-xl cursor-pointer h-64 transition-all duration-300`}
            >
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="absolute inset-0 bg-blue-500/5 rounded-xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center space-y-4 z-10"
              >
                <svg
                  className="w-16 h-16 text-blue-400 group-hover:text-blue-500 transition-colors duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-lg text-white/70 group-hover:text-white font-medium">
                  Drop your file here or click to browse
                </span>
              </motion.div>
            </label>
          </>
        )}
        {file && !isReceiver && (
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {file.name}
            </h3>
            <div className="space-y-6">
              <div className="relative group">
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3.5 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none"
                  value={link}
                  readOnly
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    alert('Link copied!');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-2 rounded-md font-medium transition-all duration-300"
                >
                  Copy Link
                </motion.button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <p className="text-white/80 font-medium">
                  Scan QR Code to Connect
                </p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 bg-white rounded-lg shadow-xl"
                >
                  <QRCodeCanvas value={link} size={180} />
                </motion.div>
              </div>

              <div className="bg-gradient-to-r from-white/10 to-white/5 rounded-lg p-5">
                {connectionStatus === 'connected' ? (
                  <p className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    Connected and Ready
                  </p>
                ) : (
                  <p className="text-amber-400 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"></span>
                    Awaiting Connection...
                  </p>
                )}
              </div>

              {progress > 0 && (
                <div className="space-y-2">
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    />
                  </div>
                  <p className="text-right text-sm text-white/70 font-medium">
                    {Math.round(progress)}% Complete
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {isReceiver && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Receiving File
            </h3>
            {receivedMetadata ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-white/10 to-white/5 rounded-lg p-6 space-y-3">
                  <p className="text-white/80">
                    File:{' '}
                    <span className="text-white font-medium">
                      {receivedMetadata.name}
                    </span>
                  </p>
                  <p className="text-white/80">
                    Size:{' '}
                    <span className="text-white font-medium">
                      {(receivedMetadata.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </p>
                </div>

                {progress > 0 && (
                  <div className="space-y-2">
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                      />
                    </div>
                    <p className="text-right text-sm text-white/70 font-medium">
                      {Math.round(progress)}% Complete
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white/70 font-medium">
                  Waiting for sender to connect...
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default App;
