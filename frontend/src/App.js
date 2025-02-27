import React, { use, useCallback, useEffect, useRef, useState } from 'react';
import background from "../src/assets/bg.jpg"
import { QRCodeCanvas } from 'qrcode.react';

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
    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const peerIdFromUrl = urlParams.get('peerId');
      if (peerIdFromUrl && peerConnection.current && dataChannelRef.current && socket && myId) {
        connectToPeer(peerIdFromUrl);
      }
    }, 4000)

  }, [peerConnection.current, dataChannelRef.current, socket, myId]);


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

  const link = `${window.location.origin}/?peerId=${myId}`;


  return (
    <div className=" font-mono min-h-screen flex gap-5 justify-center flex-col sm:flex-row items-center bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">


      <div className="bg-[#FBFFE4]  p-6 rounded-2xl shadow-lg w-full max-w-md flex flex-col items-center gap-4">




        {!file ? <div class="flex items-center justify-center w-full">
          <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div class="flex flex-col items-center justify-center pt-5 pb-6">
              <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
              </svg>
              <p class="mb-2 text-sm text-gray-500 dark:text-gray-400"><span class="font-semibold">Click to upload</span> or drag and drop</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
            </div>
            <input id="dropzone-file" type="file" class="hidden" onChange={handleFileSelect} />
          </label>
        </div> : <div className='h-80 w-80 flex justify-center items-center border-4 bg-white border-[#3D8D7A] rounded-full'><h1 className='text-black font-sans font-bold' >{file.name}</h1></div>}
        {connectionStatus === "connected" && <p className='text-green-400'>connected</p>}

        <button disabled={connectionStatus !== 'connected'} className="bg-[#3D8D7A] hover:bg-[#459885] text-white font-bold py-2 px-4 rounded w-full" onClick={sendFile} disabled={!file}>Send File</button>
        {progress > 0 && <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
          <div className="bg-blue-600 h-4" style={{ width: `${progress}%` }}></div>
        </div>}


      </div>

      <div className="bg-[#FBFFE4]  p-6 rounded-2xl shadow-lg w-full max-w-md flex flex-col items-center gap-4">
        <p className='text-black font-mono font-semibold'>Share this link with your peer:</p>
        <div className="w-4/5 md:w-[300px] bg-[hsl(0,0%,100%)] p-[15px] rounded-[20px]">
          <div class="w-full max-w-[16rem]">
            <div class="relative">
              <label for={link} class="sr-only">Label</label>
              <input id={link} type="text" class="col-span-6 bg-gray-50 border border-gray-300 text-gray-500 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-2.5 py-4 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500" value={link} disabled readonly />
              <button data-copy-to-clipboard-target={link} class="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 rounded-lg py-2 px-2.5 inline-flex items-center justify-center bg-white border-gray-200 border h-8">
                <span id="default-message" onClick={() => navigator.clipboard.writeText(link)}>
                  <span class="inline-flex items-center">
                    <svg class="w-3 h-3 me-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 20">
                      <path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z" />
                    </svg>
                    <span class="text-xs font-semibold">Copy</span>
                  </span>
                </span>
                <span id="success-message" class="hidden">
                  <span class="inline-flex items-center">
                    <svg class="w-3 h-3 text-blue-700 dark:text-blue-500 me-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5.917 5.724 10.5 15 1.5" />
                    </svg>
                    <span class="text-xs font-semibold text-blue-700 dark:text-blue-500">Copied</span>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <p className='text-black font-mono font-semibold'>Or Scan QR code:</p>
        <div className="w-4/5 md:w-[300px] bg-[hsl(0,0%,100%)] p-[15px] rounded-[20px]">
          <QRCodeCanvas value={link} size={150} bgColor="#fff" fgColor="#000" alt="qr-code" className="w-full rounded-[10px]" loading="lazy" />


        </div>


      </div>





    </div>
  );
};

export default App;
