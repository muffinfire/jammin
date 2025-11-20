import React, { useState, useEffect, useRef, useCallback } from 'react';
import ParticipantAudio from './ParticipantAudio';
import Chat from './Chat';
import RecordingControls, { QUALITY_PRESETS } from './RecordingControls';

const WEBSOCKET_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const JamRoom = ({ sessionCode, username, isHost, onLeave, onKicked }) => {
    const [recordings, setRecordings] = useState([]);
    const [recordingState, setRecordingState] = useState('idle');
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingStartTimeRef = useRef(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [participants, setParticipants] = useState(new Map());
    const [localStream, setLocalStream] = useState(null);
    const [audioQuality, setAudioQuality] = useState('high');
    const audioQualityRef = useRef('high');
    const [messages, setMessages] = useState([]);
    const [hostId, setHostId] = useState(null);
    const [hostConnected, setHostConnected] = useState(false);
    const [editingNameId, setEditingNameId] = useState(null);
    const [tempName, setTempName] = useState('');
    const [copyLinkText, setCopyLinkText] = useState('COPY LINK');

    const wsRef = useRef(null);
    const pingIntervalRef = useRef(null);
    const myClientIdRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);

    const mixedAudioContextRef = useRef(null);
    const mixedDestinationNodeRef = useRef(null);
    const sourceNodesRef = useRef(new Map());

    useEffect(() => {
        const initMic = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setLocalStream(stream);
            } catch (err) {
                alert("Microphone access denied. This app requires a microphone.");
            }
        };
        initMic();
        mixedAudioContextRef.current = new AudioContext();
        mixedDestinationNodeRef.current = mixedAudioContextRef.current.createMediaStreamDestination();
    }, []);

    useEffect(() => {
        audioQualityRef.current = audioQuality;
    }, [audioQuality]);

    // WAV Export with Resampling
    const convertToFormat = async (webmBlob, format) => {
        return new Promise((resolve) => {
            const audioContext = new AudioContext();
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    if (format === 'wav') {
                        // Determine target sample rate based on quality
                        let targetSampleRate = 48000;
                        if (audioQuality === 'low') targetSampleRate = 16000;
                        else if (audioQuality === 'medium') targetSampleRate = 24000;
                        else if (audioQuality === 'high') targetSampleRate = 44100;

                        // Resample if needed
                        let finalBuffer = audioBuffer;
                        if (audioBuffer.sampleRate !== targetSampleRate) {
                            const offlineCtx = new OfflineAudioContext(
                                audioBuffer.numberOfChannels,
                                audioBuffer.duration * targetSampleRate,
                                targetSampleRate
                            );
                            const source = offlineCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(offlineCtx.destination);
                            source.start(0);
                            finalBuffer = await offlineCtx.startRendering();
                        }

                        const wav = audioBufferToWav(finalBuffer);
                        resolve(new Blob([wav], { type: 'audio/wav' }));
                    } else {
                        resolve(webmBlob);
                    }
                } catch (err) {
                    console.error('Conversion error:', err);
                    resolve(webmBlob);
                }
            };

            reader.readAsArrayBuffer(webmBlob);
        });
    };

    const audioBufferToWav = (buffer) => {
        const length = buffer.length * buffer.numberOfChannels * 3; // 24-bit = 3 bytes
        const arrayBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
        const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };

        setUint32(0x46464952); // "RIFF"
        setUint32(36 + length);
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1); // PCM
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 3 * buffer.numberOfChannels); // 24-bit byte rate
        setUint16(buffer.numberOfChannels * 3); // Block align
        setUint16(24); // 24-bit
        setUint32(0x61746164); // "data"
        setUint32(length);

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < arrayBuffer.byteLength) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                // 24-bit conversion
                sample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
                const intSample = Math.floor(sample);

                view.setUint8(pos, intSample & 0xFF);
                view.setUint8(pos + 1, (intSample >> 8) & 0xFF);
                view.setUint8(pos + 2, (intSample >> 16) & 0xFF);
                pos += 3;
            }
            offset++;
        }

        return arrayBuffer;
    };

    const startLocalRecording = useCallback((startTime) => {
        const streamToRecord = mixedDestinationNodeRef.current && mixedDestinationNodeRef.current.stream;
        if (!streamToRecord) return;

        recordingStartTimeRef.current = Date.now();
        const qualitySettings = QUALITY_PRESETS[audioQualityRef.current];

        mediaRecorderRef.current = new MediaRecorder(streamToRecord, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: qualitySettings.audioBitsPerSecond
        });

        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const myRecordingDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
            const totalDuration = Math.floor((Date.now() - startTime) / 1000);

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                if (wsRef.current) {
                    wsRef.current.send(JSON.stringify({
                        type: 'submit-recording',
                        audioData: base64data,
                        myDuration: myRecordingDuration,
                        totalDuration: totalDuration,
                        quality: qualitySettings.label,
                        createdBy: username
                    }));
                }
            };
            reader.readAsDataURL(audioBlob);
        };

        mediaRecorderRef.current.start();
        setRecordingState('recording');
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed > 0 ? elapsed : 0);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    }, [username]);

    const stopLocalRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setRecordingState('idle');
    }, []);

    useEffect(() => {
        if (!localStream) return;
        wsRef.current = new WebSocket(WEBSOCKET_URL);
        const ws = wsRef.current;

        const createPeerConnection = (peerId, stream) => {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pc.onicecandidate = (e) => ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate, id: peerId }));
            pc.ontrack = (e) => setRemoteStreams(prev => new Map(prev).set(peerId, e.streams[0]));
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            peerConnectionsRef.current.set(peerId, pc);
            return pc;
        };

        ws.onopen = () => ws.send(JSON.stringify({
            type: 'join',
            code: sessionCode,
            username,
            isHost,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }));

        ws.onmessage = async (message) => {
            const data = JSON.parse(message.data);
            const peerId = data.from || data.id;
            let pc = peerId ? peerConnectionsRef.current.get(peerId) : undefined;

            switch (data.type) {
                case 'room-state':
                    myClientIdRef.current = data.myId;
                    setHostId(data.hostId);
                    setHostConnected(true);

                    const participantsMap = new Map(Object.entries(data.participants || {}));
                    if (data.myId) participantsMap.delete(data.myId);
                    setParticipants(participantsMap);

                    if (data.recordings) {
                        const recordingsWithBlobs = data.recordings.map(rec => {
                            if (rec.audioData) {
                                const binaryString = atob(rec.audioData);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                const blob = new Blob([bytes], { type: 'audio/webm' });
                                return { ...rec, audioBlob: blob };
                            }
                            return rec;
                        });
                        setRecordings(recordingsWithBlobs);
                    }

                    if (data.messages) {
                        setMessages(data.messages);
                    }

                    for (const userId of data.users) {
                        const newPc = createPeerConnection(userId, localStream);
                        const offer = await newPc.createOffer();
                        await newPc.setLocalDescription(offer);
                        ws.send(JSON.stringify({ type: 'offer', offer, id: userId }));
                    }
                    if (data.recording.state === 'recording') startLocalRecording(data.recording.startTime);
                    break;

                case 'user-joined':
                    createPeerConnection(peerId, localStream);
                    if (data.username && peerId !== myClientIdRef.current) {
                        setParticipants(prev => new Map(prev).set(peerId, data.username));
                    }
                    break;

                case 'offer':
                    pc = pc || createPeerConnection(peerId, localStream);
                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: 'answer', answer, id: peerId }));
                    break;

                case 'answer':
                    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    break;

                case 'candidate':
                    if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    break;

                case 'user-left':
                    if (pc) pc.close();
                    peerConnectionsRef.current.delete(peerId);
                    setRemoteStreams(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(peerId);
                        return newMap;
                    });
                    if (peerId !== myClientIdRef.current) {
                        setParticipants(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(peerId);
                            return newMap;
                        });
                    }
                    break;

                case 'host-disconnected':
                    setHostConnected(false);
                    break;

                case 'host-reconnected':
                    setHostConnected(true);
                    break;

                case 'kicked':
                    ws.close();
                    onKicked();
                    break;

                case 'recording-started':
                    startLocalRecording(data.startTime);
                    break;

                case 'recording-stopped':
                    stopLocalRecording();
                    break;

                case 'new-recording':
                    if (data.recording) {
                        const binaryString = atob(data.recording.audioData);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: 'audio/webm' });
                        setRecordings(prev => {
                            const exists = prev.some(r => r.id === data.recording.id);
                            if (!exists) return [{ ...data.recording, audioBlob: blob }, ...prev];
                            return prev;
                        });
                    }
                    break;

                case 'chat':
                    setMessages(prev => [...prev, {
                        username: data.username,
                        message: data.message,
                        timestamp: data.timestamp
                    }]);
                    break;

                case 'update-recording':
                    setRecordings(prev => prev.map(rec =>
                        rec.id === data.recordingId ? { ...rec, name: data.newName } : rec
                    ));
                    break;

                case 'delete-recording':
                    setRecordings(prev => prev.filter(rec => rec.id !== data.recordingId));
                    break;
            }
        };

        pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 30000);

        return () => {
            ws.close();
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
        };
    }, [localStream, sessionCode, username, isHost, onKicked]);

    useEffect(() => {
        const context = mixedAudioContextRef.current;
        if (!context || !mixedDestinationNodeRef.current) return;
        sourceNodesRef.current.forEach(node => node.disconnect());
        sourceNodesRef.current.clear();
        if (localStream) {
            const localSource = context.createMediaStreamSource(localStream);
            localSource.connect(mixedDestinationNodeRef.current);
            sourceNodesRef.current.set('local', localSource);
        }
        remoteStreams.forEach((stream, id) => {
            const remoteSource = context.createMediaStreamSource(stream);
            remoteSource.connect(mixedDestinationNodeRef.current);
            sourceNodesRef.current.set(id, remoteSource);
        });
    }, [localStream, remoteStreams]);

    const handleDownload = async (recording, format) => {
        if (!recording.audioBlob) return;
        let blob = recording.audioBlob;
        let filename = `${recording.name || recording.id}.${format}`;
        if (format !== 'webm') blob = await convertToFormat(recording.audioBlob, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSendMessage = (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'chat', message }));
        } else {
            console.warn("WebSocket is not open. Cannot send message.");
        }
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}?room=${sessionCode}`;
        navigator.clipboard.writeText(link);
        setCopyLinkText('COPIED');
        setTimeout(() => setCopyLinkText('COPY LINK'), 2000);
    };

    const startEditing = (rec) => {
        setEditingNameId(rec.id);
        setTempName(rec.name || `Recording ${rec.id}`);
    };

    const saveName = (id) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'rename-recording', recordingId: id, newName: tempName }));
        }
        setEditingNameId(null);
    };

    const deleteRecording = (id) => {
        if (confirm('Are you sure you want to delete this recording?')) {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'delete-recording', recordingId: id }));
            }
        }
    };

    const kickUser = (userId) => {
        if (confirm('Kick this user?')) {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'kick-user', userId }));
            }
        }
    };

    if (!hostConnected && !isHost) {
        return (
            <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>
                <h2>Waiting for host...</h2>
                <p>The host has disconnected. Please wait for them to rejoin.</p>
            </div>
        );
    }

    return (
        <div className="jam-room-container">
            <div className="card-header">
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SESSION CODE</div>
                    <div className="session-code-container" onClick={handleCopyLink} style={{ cursor: 'pointer' }}>
                        <span className="session-code">{copyLinkText === 'COPIED' ? 'COPIED!' : sessionCode}</span>
                    </div>
                </div>
                <button onClick={onLeave} className="btn-danger">LEAVE</button>
            </div>

            <RecordingControls
                recordingState={recordingState}
                recordingTime={recordingTime}
                audioQuality={audioQuality}
                setAudioQuality={setAudioQuality}
                onStartRecording={() => wsRef.current && wsRef.current.send(JSON.stringify({ type: 'start-recording' }))}
                onStopRecording={() => wsRef.current && wsRef.current.send(JSON.stringify({ type: 'stop-recording' }))}
            />

            <div className="card">
                <h3>PARTICIPANTS ({participants.size + 1})</h3>
                <div className="participant-item">
                    <div className="participant-avatar">{username.substring(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>
                            {username} (You)
                            {isHost && <span className="host-badge">HOST</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span className={`status-dot ${hostConnected ? 'connected' : 'disconnected'}`}></span>
                            Local Audio
                        </div>
                    </div>
                </div>
                {Array.from(participants.entries()).map(([id, name]) => {
                    const stream = remoteStreams.get(id);
                    const isThisUserHost = id === hostId;

                    return (
                        <div key={id} className="participant-item">
                            <div className="participant-avatar">{name.substring(0, 2).toUpperCase()}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>
                                    {name}
                                    {isThisUserHost && <span className="host-badge">HOST</span>}
                                </div>
                                {stream && <ParticipantAudio stream={stream} />}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span className={`status-dot ${stream ? 'connected' : 'disconnected'}`}></span>
                                    {stream ? 'Connected' : 'Connecting...'}
                                </div>
                            </div>
                            {isHost && !isThisUserHost && (
                                <div className="admin-controls">
                                    <button
                                        className="btn-danger btn-small"
                                        onClick={() => wsRef.current && wsRef.current.send(JSON.stringify({ type: 'kick-user', targetId: id }))}
                                    >
                                        KICK
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="card">
                <h3>RECORDINGS ({recordings.length})</h3>
                {recordings.length === 0 ? (
                    <div className="empty-state">
                        <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-2c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z" />
                        </svg>
                        <div>NO RECORDINGS</div>
                    </div>
                ) : (
                    recordings.map(rec => {
                        const url = rec.audioBlob ? URL.createObjectURL(rec.audioBlob) : null;
                        return (
                            <div key={rec.id} className="recording-item">
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{ fontWeight: 600, flex: 1 }}>
                                            {editingNameId === rec.id ? (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type="text"
                                                        value={tempName}
                                                        onChange={(e) => setTempName(e.target.value)}
                                                        className="input-field-small"
                                                    />
                                                    <button onClick={() => saveName(rec.id)} className="btn-success btn-small">SAVE</button>
                                                    <button onClick={() => setEditingNameId(null)} className="btn-danger btn-small">CANCEL</button>
                                                </div>
                                            ) : (
                                                <>
                                                    {rec.name || `rec-${new Date(rec.timestamp || Date.now()).toLocaleTimeString().replace(/:/g, '')}`}
                                                    <button className="btn-icon" onClick={() => startEditing(rec)}>EDIT</button>
                                                    <button className="btn-icon" style={{ color: 'var(--danger-color)' }} onClick={() => {
                                                        if (confirm('DELETE?') && wsRef.current) wsRef.current.send(JSON.stringify({ type: 'delete-recording', id: rec.id }));
                                                    }}>DELETE</button>
                                                </>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, '0')}
                                        </div>
                                    </div>
                                    {url && <audio controls src={url} style={{ width: '100%', height: '30px', marginBottom: '0.5rem' }}></audio>}
                                    {url && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleDownload(rec, 'webm')} className="btn-primary btn-small">WEBM</button>
                                            <button onClick={() => handleDownload(rec, 'wav')} className="btn-secondary btn-small">WAV (24-bit)</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Chat
                messages={messages}
                onSendMessage={(msg) => wsRef.current && wsRef.current.send(JSON.stringify({ type: 'chat', message: msg }))}
            />
        </div>
    );
};

export default JamRoom;
