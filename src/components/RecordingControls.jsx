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
            <div className="control-group">
                <label className="control-label">AUDIO QUALITY</label>
                <div className="select-wrapper">
                    <select
                        value={audioQuality}
                        onChange={(e) => setAudioQuality(e.target.value)}
                        disabled={recordingState === 'recording'}
                        className="quality-select"
                    >
                        {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                            <option key={key} value={key}>{preset.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="control-actions">
                {recordingState === 'recording' ? (
                    <button onClick={onStopRecording} className="btn-record stop">
                        <div className="stop-icon"></div>
                        STOP RECORDING
                    </button>
                ) : (
                    <button onClick={onStartRecording} className="btn-record start">
                        <div className="record-icon"></div>
                        START RECORDING
                    </button>
                )}
                <div className="timer-display">{formatTime(recordingTime)}</div>
            </div>
        </div>
    );
};

export { QUALITY_PRESETS };
export default RecordingControls;
