import React, { use, useCallback, useEffect, useRef, useState } from 'react';
import background from "../src/assets/bg.jpg"
const App = () => {
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [peerId, setPeerId] = useState('');
  console.log(peerId, "-----------------------------------");

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
      const offer = await peerConnection.current.createOffer()
      await peerConnection.current.setLocalDescription(offer)
      socket.send(JSON.stringify({ type: 'signal', to: peerId, signal: offer }))
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
    dataChannelRef.current.send(JSON.stringify(fileMetadata));

    fileReader.onload = (e) => {
      const chunk = e.target.result;
      dataChannelRef.current.send(chunk);
      offset += chunk.byteLength;

      // Calculate and update progress
      const progress = (offset / file.size) * 100;
      setProgress(progress);

      // Check if we have more chunks to send
      if (offset < file.size) {
        readNextChunk();
      } else {
        // Send transfer complete message
        dataChannelRef.current.send(JSON.stringify({ type: 'complete' }));
        setProgress(0);
        setFile(null);
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
    if (!peerConnection.current && !peerId) return console.log("No peer connection or peer id");

    peerConnection.current.onicecandidate = async (event) => {
      console.log("onicecandidate", { type: 'signal', to: peerId, signal: { type: "candidate", candidate: event.candidate } });
      socket.send(JSON.stringify({ type: 'signal', to: peerId, signal: { type: "candidate", candidate: event.candidate } }))
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
              setReceivedMetadata(null);
              setProgress(0);
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
    let pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
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
      const data = JSON.parse(event.data);
      if (data.type === 'connect') {
        setMyId(data.clientId);
      }

      else if (data.type === 'signal') {
        if (data.signal.type === 'offer') {
          setPeerId(data.from)
          await peerConnection.current.setRemoteDescription(data.signal)
          const answer = await peerConnection.current.createAnswer()
          await peerConnection.current.setLocalDescription(answer)
          _socket.send(JSON.stringify({ type: 'signal', to: data.from, signal: answer }))
          console.log("send answer to peer", answer);

        }
        else if (data.signal.type === 'answer') {
          await peerConnection.current.setRemoteDescription(data.signal)
          console.log("set answer from peer", data.signal);

        }
        else if (data.signal.type === "candidate") {
          if (!data.signal.candidate) return;
          await peerConnection.current.addIceCandidate(data.signal.candidate)
          console.log("add ice candidate", data.signal.candidate);
        }
      }



    }

  }, [])

  return (
    <div style={{ backgroundImage: `url(${background})`, margin: 0, padding: 0, gap: 20, height: "100vh", width: "100vw", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <div style={{ backgroundColor: "rgba(255, 255, 255, 0.5)", padding: 20, borderRadius: 10, height: "70vh", width: "50vw", display: "flex", alignItems: 'center', flexDirection: "column" }}>
        <h1 style={{ color: "white" }}>P2P File Transfer</h1>
        <p>Your ID: {myId}</p>
        <p>Status: {connectionStatus}</p>
        <input type="text" placeholder="Enter peer ID to connect" onChange={(e) => setPeerId(e.target.value)} />
        <button onClick={() => connectToPeer(peerId)}>Connect to Peer</button>
        <input type="file" onChange={handleFileSelect} />
        <button onClick={sendFile} disabled={!file || connectionStatus !== 'connected'}>Send File</button>
        {progress > 0 && <p>Progress: {progress.toFixed(2)}%</p>}
      </div>
    </div >
  );
};

export default App;
