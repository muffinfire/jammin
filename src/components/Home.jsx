import React, { useState } from 'react';

const Home = ({ onJoin, onCreate }) => {
    const [joinCode, setJoinCode] = useState('');
    const [username, setUsername] = useState('');

    const handleJoinSubmit = (e) => {
        e.preventDefault();
        if (joinCode.trim() && username.trim()) {
            onJoin(joinCode.trim(), username.trim());
        }
    };

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (username.trim()) {
            onCreate(username.trim());
        }
    };

    return (
        <div>
            <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                    <label>Your Name</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ENTER NAME"
                        required
                    />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={!username.trim()}>
                    Create New Session
                </button>
            </form>

            <div className="divider">OR</div>

            <form onSubmit={handleJoinSubmit}>
                <div className="form-group">
                    <label>Your Name</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ENTER NAME"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Session Code</label>
                    <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="ENTER 6-DIGIT CODE"
                        required
                    />
                </div>
                <button type="submit" className="btn-secondary" style={{ width: '100%' }} disabled={!joinCode.trim() || !username.trim()}>
                    Join Session
                </button>
            </form>
        </div>
    );
};

export default Home;
