import React from 'react';

const QUALITY_PRESETS = {
    low: { audioBitsPerSecond: 32000, label: 'Low (32 kbps)' },
    medium: { audioBitsPerSecond: 64000, label: 'Medium (64 kbps)' },
    high: { audioBitsPerSecond: 128000, label: 'High (128 kbps)' },
    ultra: { audioBitsPerSecond: 256000, label: 'Ultra (256 kbps)' }
};

const RecordingControls = ({
    recordingState,
    recordingTime,
    audioQuality,
    setAudioQuality,
    onStartRecording,
    onStopRecording
}) => {
    const formatTime = (time) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;

    return (
        <div className="recording-controls">
            <div style={{ marginBottom: '1rem' }}>
                <label>Recording Quality</label>
                <select
                    value={audioQuality}
                    onChange={(e) => setAudioQuality(e.target.value)}
                    disabled={recordingState === 'recording'}
                    style={{ maxWidth: '300px', margin: '0 auto', display: 'block' }}
                >
                    {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                        <option key={key} value={key}>{preset.label}</option>
                    ))}
                </select>
            </div>

            {recordingState === 'recording' ? (
                <button onClick={onStopRecording} className="btn-danger">
                    <span className="recording-indicator"></span>
                    Stop Recording
                </button>
            ) : (
                <button onClick={onStartRecording} className="btn-success">
                    Start Recording
                </button>
            )}
            <div className="timer">{formatTime(recordingTime)}</div>
        </div>
    );
};

export { QUALITY_PRESETS };
export default RecordingControls;
