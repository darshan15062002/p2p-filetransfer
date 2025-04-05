import React, { useEffect, useRef, useState } from 'react';
import background from "../src/assets/bg.jpg"
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from "framer-motion";
const App = () => {
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [peerId, setPeerId] = useState('');
  console.log(peerId, "-----------------------------------");
  const [isReceiver, setIsReceiver] = useState(false);
  const [receivedChunks, setReceivedChunks] = useState([]);
  const [receivedMetadata, setReceivedMetadata] = useState(null)
  const [myId, setMyId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socket, setSocket] = useState(null);
  const peerConnection = useRef(null);
  const dataChannelRef = useRef(null);

  const handleFileSelect = (e) => {
    e.preventDefault()
    setFile(e.target.files[0])
  }

  const connectToPeer = async (peerId) => {
    try {
      if (!socket) return
      const offer = await peerConnection.current.createOffer()
      await peerConnection.current.setLocalDescription(offer)
      socket?.send(JSON.stringify({ type: 'signal', to: peerId, signal: offer }))
      console.log("send offer to peer", offer);

    } catch (error) {
      console.log("Error sendding offer to peer", error);

    }
  }

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
      fileType: file.type
    };
    dataChannelRef?.current?.send(JSON.stringify(fileMetadata));

    fileReader.onload = (e) => {
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
    if (!peerConnection.current && !peerId && !socket) return console.log("No peer connection or peer id");

    peerConnection.current.onicecandidate = async (event) => {
      console.log("onicecandidate", { type: 'signal', to: peerId, signal: { type: "candidate", candidate: event.candidate } });

      socket?.send(JSON.stringify({ type: 'signal', to: peerId, signal: { type: "candidate", candidate: event.candidate } }))
    }
    peerConnection.current.onconnectionstatechange = (event) => {
      console.log("Connection state:", peerConnection.current.connectionState);
    };


    peerConnection.current.ondatachannel = (event) => {
      const rdc = event.channel;

      // Create a separate array for tracking chunks that persists between renders
      let fileChunks = [];
      let fileMetadata = null;

      rdc.onmessage = (e) => {
        console.log("Received message:", e.data);
        try {
          if (typeof e.data === 'string') {
            const data = JSON.parse(e.data);
            console.log("Received string data:", data);

            if (data.type === 'metadata') {
              console.log("Received metadata:", data);
              fileMetadata = data;
              fileChunks = []; // Reset chunks for new file
              setReceivedMetadata(data);
              setReceivedChunks([]);
            }

            if (data.type === 'complete') {
              console.log("Transfer complete, creating file...");
              console.log(`Assembled ${fileChunks.length} chunks with total size: ${fileChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)} bytes`);

              // Combine all chunks and create file
              const blob = new Blob(fileChunks, {
                type: fileMetadata?.fileType || 'application/octet-stream'
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
            console.log("Received chunk size:", e.data.byteLength);

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
              console.log(`Progress: ${progress.toFixed(1)}% (${totalReceived}/${fileMetadata.size} bytes)`);
              setProgress(progress);
            }
          }
        } catch (error) {
          console.error('Error in onmessage:', error);
        }
      };
    };
  }, [peerConnection.current, peerId, dataChannelRef.current])

  useEffect(() => {

    const urlParams = new URLSearchParams(window.location.search);
    const peerIdFromUrl = urlParams.get('peerId');
    setIsReceiver(!!peerIdFromUrl);
    setPeerId(peerIdFromUrl);

    setTimeout(() => {
      if (peerIdFromUrl && peerConnection.current && dataChannelRef.current && socket && myId) {
        connectToPeer(peerIdFromUrl);
      }
    }, 4000)

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
          urls: "turn:relay.metered.ca:80",
          username: "free",
          credential: "free"
        },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "open",
          credential: "open"
        }
      ],
    })
    let dc = pc.createDataChannel('fileTransfer');
    peerConnection.current = pc


    dataChannelRef.current = dc


    dc.onopen = () => {
      setConnectionStatus('connected');
    };

    dc.onclose = () => {
      setConnectionStatus('disconnected');
    };




    // const _socket = new WebSocket('ws://localhost:3001')
    const _socket = new WebSocket('https://p2p-filetransfer.onrender.com')


    setSocket(_socket)

    _socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connect') {
          setMyId(data.clientId);
        }

        else if (data.type === 'signal') {
          if (data.signal.type === 'offer') {
            setPeerId(data.from)
            await peerConnection?.current?.setRemoteDescription(data.signal)
            const answer = await peerConnection.current.createAnswer()
            await peerConnection.current.setLocalDescription(answer)
            _socket?.send(JSON.stringify({ type: 'signal', to: data.from, signal: answer }))
            console.log("send answer to peer", answer);

          }
          else if (data.signal.type === 'answer') {
            await peerConnection?.current?.setRemoteDescription(data.signal)
            console.log("set answer from peer", data.signal);

          }
          else if (data.signal.type === "candidate") {
            if (!data.signal.candidate) return;
            await peerConnection.current.addIceCandidate(data.signal.candidate)
            console.log("add ice candidate", data.signal.candidate);
          }
        }



      } catch (error) {
        console.log(error);

      }

    }

  }, [])

  useEffect(() => {
    connectionStatus === 'connected' && sendFile()
  }, [connectionStatus])

  const link = `${window.location.origin}/?peerId=${myId}`;


  return (
    <div className="font-sans min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
      <motion.div
        className="bg-white/90 backdrop-blur-sm text-gray-900 w-full max-w-lg rounded-2xl shadow-2xl p-8 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {!file && !isReceiver && (
          <>
            <h2 className="text-2xl font-bold text-center">Share Files Securely</h2>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-400 bg-gray-50/50 rounded-xl cursor-pointer h-52 hover:bg-gray-100 transition-all group">
              <input type="file" className="hidden" onChange={handleFileSelect} />
              <svg className="w-12 h-12 text-gray-400 group-hover:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-center text-gray-600 group-hover:text-gray-800">Drop your file here or click to upload</span>
            </label>
          </>
        )}

        {file && !isReceiver && (
          <>
            <h3 className="text-xl font-semibold text-center">Ready to Share: {file.name}</h3>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  className="w-full border-2 rounded-lg px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  value={link}
                  readOnly
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    alert('Link copied!');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors"
                >
                  Copy Link
                </button>
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-gray-600 font-medium">Or scan QR code</p>
                <div className="p-2 bg-white rounded-lg shadow-md">
                  <QRCodeCanvas value={link} size={160} />
                </div>
              </div>

              <div className="text-center p-3 rounded-lg bg-gray-50">
                {connectionStatus === 'connected' ? (
                  <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Connected to receiver
                  </p>
                ) : (
                  <p className="text-yellow-600 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    Waiting for connection...
                  </p>
                )}
              </div>

              {progress > 0 && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full transition-all duration-300 relative"
                      style={{ width: `${progress}%` }}
                    >
                      <span className="absolute right-0 -top-6 text-sm">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isReceiver && (
          <>
            <h3 className="text-xl font-semibold text-center">Receiving File</h3>
            {receivedMetadata ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">File: {receivedMetadata.name}</p>
                  <p className="text-gray-600">Size: {Math.round(receivedMetadata.size / 1024)} KB</p>
                </div>

                {progress > 0 && (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-green-500 h-4 rounded-full transition-all duration-300 relative"
                        style={{ width: `${progress}%` }}
                      >
                        <span className="absolute right-0 -top-6 text-sm">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Waiting for sender to share file...</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default App;
