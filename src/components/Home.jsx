import React, { useState, useEffect } from 'react';

const Home = ({ onJoin, onCreate }) => {
    const [joinCode, setJoinCode] = useState('');
    const [username, setUsername] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const room = params.get('room');
        if (room) {
            setJoinCode(room);
        }
    }, []);

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
        <div className="home-container">


            <div className="form-group">
                <label>YOUR NAME</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ENTER NAME"
                    className="input-field"
                />
            </div>

            <div className="actions-container">
                <div className="action-box">
                    <h3>JOIN SESSION</h3>
                    <form onSubmit={handleJoinSubmit}>
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="SESSION CODE"
                            className="input-field"
                        />
                        <button type="submit" className="btn-secondary" disabled={!joinCode.trim() || !username.trim()}>
                            JOIN
                        </button>
                    </form>
                </div>

                <div className="divider-vertical">OR</div>

                <div className="action-box">
                    <h3>NEW SESSION</h3>
                    <button onClick={handleCreateSubmit} className="btn-primary" disabled={!username.trim()}>
                        CREATE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;
