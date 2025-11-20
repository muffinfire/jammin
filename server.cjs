const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();
const clients = new Map();
const generateId = () => Math.random().toString(36).substring(2, 9);

const broadcast = (room, message, excludeWs = null) => {
  if (!room || !room.clients) return;
  for (const clientWs of room.clients) {
    if (clientWs !== excludeWs) {
      clientWs.send(JSON.stringify(message));
    }
  }
};

wss.on('connection', (ws) => {
  const clientId = generateId();
  clients.set(ws, { id: clientId, username: null });
  console.log(`Client ${clientId} connected.`);

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return;
    }

    const clientInfo = clients.get(ws);
    if (!clientInfo) return;

    const roomCode = clientInfo.room;
    const room = roomCode ? rooms.get(roomCode) : undefined;

    switch (data.type) {
      case 'join': {
        const newRoomCode = data.code;
        const username = data.username || 'Anonymous';

        clientInfo.room = newRoomCode;
        clientInfo.username = username;

        if (!rooms.has(newRoomCode)) {
          rooms.set(newRoomCode, {
            clients: new Set(),
            recordingState: 'idle',
            recordingStartTime: null,
            participants: {},
            recordings: [],
            currentRecordingId: null,
            pendingRecordings: []
          });
        }

        const newRoom = rooms.get(newRoomCode);

        // Add participant to room
        newRoom.participants[clientId] = username;

        // Get existing client IDs (excluding the new joiner)
        const existingClientIds = Array.from(newRoom.clients)
          .map(clientWs => {
            const info = clients.get(clientWs);
            return info ? info.id : null;
          })
          .filter(id => id);

        // Notify others about new user
        broadcast(newRoom, {
          type: 'user-joined',
          id: clientId,
          username: username
        }, ws);

        newRoom.clients.add(ws);

        // Send room state to new user (including their own ID)
        ws.send(JSON.stringify({
          type: 'room-state',
          myId: clientId,
          users: existingClientIds,
          participants: newRoom.participants,
          recordings: newRoom.recordings,
          recording: {
            state: newRoom.recordingState,
            startTime: newRoom.recordingStartTime
          }
        }));

        console.log(`Client ${clientId} (${username}) joined room ${newRoomCode}. Size: ${newRoom.clients.size}`);
        break;
      }

      case 'offer':
      case 'answer':
      case 'candidate': {
        if (!room) return;
        const targetId = data.id;
        for (const clientWs of room.clients) {
          const info = clients.get(clientWs);
          if (info && info.id === targetId) {
            clientWs.send(JSON.stringify({ ...data, from: clientId }));
            break;
          }
        }
        break;
      }

      case 'start-recording': {
        if (room && room.recordingState === 'idle') {
          room.recordingState = 'recording';
          room.recordingStartTime = Date.now();
          room.currentRecordingId = `recording-${Date.now()}`;
          room.pendingRecordings = [];

          broadcast(room, {
            type: 'recording-started',
            startTime: room.recordingStartTime
          });
          console.log(`Recording started in room ${roomCode} with ID ${room.currentRecordingId}`);
        }
        break;
      }

      case 'stop-recording': {
        if (room && room.recordingState === 'recording') {
          room.recordingState = 'idle';

          broadcast(room, {
            type: 'recording-stopped'
          });

          console.log(`Recording stopped in room ${roomCode}, waiting for submissions...`);
        }
        break;
      }

      case 'submit-recording': {
        if (room && data.audioData) {
          // Store the submission
          room.pendingRecordings.push({
            clientId: clientId,
            username: clientInfo.username,
            audioData: data.audioData,
            myDuration: data.myDuration,
            totalDuration: data.totalDuration,
            quality: data.quality,
            createdBy: data.createdBy
          });

          console.log(`Received recording from ${clientInfo.username}: ${data.myDuration}s (of ${data.totalDuration}s total)`);

          // Wait a bit to collect all submissions, then pick the longest
          setTimeout(() => {
            if (room.pendingRecordings.length > 0) {
              // Find the recording with the longest duration
              const longestRecording = room.pendingRecordings.reduce((longest, current) => {
                return current.myDuration > longest.myDuration ? current : longest;
              });

              console.log(`Selected longest recording: ${longestRecording.myDuration}s from ${longestRecording.username}`);

              // Create the final recording with consistent ID
              const finalRecording = {
                id: room.currentRecordingId,
                audioData: longestRecording.audioData,
                duration: longestRecording.totalDuration,
                timestamp: new Date().toLocaleString(),
                quality: longestRecording.quality,
                createdBy: `${longestRecording.createdBy} (${longestRecording.myDuration}s)`
              };

              // Store it
              room.recordings.push(finalRecording);

              // Broadcast to everyone
              broadcast(room, {
                type: 'new-recording',
                recording: finalRecording
              });

              // Clear pending
              room.pendingRecordings = [];

              console.log(`Recording ${finalRecording.id} finalized and broadcast`);
            }
          }, 2000); // Wait 2 seconds for all submissions
        }
        break;
      }

      case 'chat': {
        if (room) {
          broadcast(room, {
            type: 'chat',
            from: clientId,
            username: clientInfo.username,
            message: data.message,
            timestamp: Date.now()
          });
        }
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }

      case 'rename-recording': {
        if (room) {
          const rec = room.recordings.find(r => r.id === data.id);
          if (rec) {
            rec.id = data.newName; // Ideally we'd have a separate display name, but ID works for now if unique
            // Or better, add a name field
            rec.name = data.newName;

            broadcast(room, {
              type: 'update-recording',
              recordingId: data.id,
              newName: data.newName
            });
          }
        }
        break;
      }

      case 'delete-recording': {
        if (room) {
          room.recordings = room.recordings.filter(r => r.id !== data.id);
          broadcast(room, {
            type: 'delete-recording',
            recordingId: data.id
          });
        }
        break;
      }

      case 'kick-user': {
        if (room) {
          const targetId = data.targetId;
          // Find the client WS
          let targetWs = null;
          for (const clientWs of room.clients) {
            const info = clients.get(clientWs);
            if (info && info.id === targetId) {
              targetWs = clientWs;
              break;
            }
          }

          if (targetWs) {
            targetWs.close(1000, 'Kicked by host');
            // The close handler will take care of broadcasting user-left
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const clientInfo = clients.get(ws);
    if (clientInfo && clientInfo.room) {
      const room = rooms.get(clientInfo.room);
      if (room) {
        room.clients.delete(ws);

        // Remove from participants
        delete room.participants[clientInfo.id];

        broadcast(room, {
          type: 'user-left',
          id: clientInfo.id
        });

        if (room.clients.size === 0) {
          rooms.delete(clientInfo.room);
          console.log(`Room ${clientInfo.room} deleted (empty)`);
        } else {
          console.log(`Client ${clientInfo.id} left room ${clientInfo.room}. Remaining: ${room.clients.size}`);
        }
      }
    }
    clients.delete(ws);
    console.log(`Client ${(clientInfo && clientInfo.id) || 'unknown'} disconnected.`);
  });
});

server.listen(8080, () => {
  console.log('Server running. Open http://localhost:8080 in your browser.');
});