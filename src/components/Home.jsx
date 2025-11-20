import React, { useState, useEffect } from 'react';

const Home = ({ onJoin, onCreate }) => {
    const [joinCode, setJoinCode] = useState('');
    const [username, setUsername] = useState('');
    const [mode, setMode] = useState('create'); // 'create' or 'join'

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const room = params.get('room');
        if (room) {
            setJoinCode(room);
            setMode('join');
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        if (mode === 'create') {
            onCreate(username.trim());
        } else {
            if (joinCode.trim()) {
                onJoin(joinCode.trim(), username.trim());
            }
        }
    };

    return (
        <div className="home-container">
            <h1 className="home-title">JAM SESSION</h1>

            <form onSubmit={handleSubmit} className="home-form">
                <div className="form-row">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your Name"
                        className="input-field"
                        required
                    />
                </div>

                <div className="form-mode-toggle" data-mode={mode}>
                    <button
                        type="button"
                        className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
                        onClick={() => setMode('create')}
                    >
                        NEW SESSION
                    </button>
                    <button
                        type="button"
                        className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
                        onClick={() => setMode('join')}
                    >
                        JOIN SESSION
                    </button>
                </div>

                {mode === 'join' && (
                    <div className="form-row">
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="Session Code"
                            className="input-field"
                            required
                        />
                    </div>
                )}

                <button
                    type="submit"
                    className="btn-primary btn-large"
                    disabled={!username.trim() || (mode === 'join' && !joinCode.trim())}
                >
                    {mode === 'create' ? 'CREATE' : 'JOIN'}
                </button>
            </form>
        </div>
    );
};

export default Home;
