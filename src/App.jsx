import React, { useState } from 'react';
import Home from './components/Home';
import JamRoom from './components/JamRoom';

const App = () => {
    const [sessionCode, setSessionCode] = useState(null);
    const [username, setUsername] = useState(null);
    const [isHost, setIsHost] = useState(false);

    const handleCreate = (name) => {
        setUsername(name);
        setSessionCode(Math.floor(100000 + Math.random() * 900000).toString());
        setIsHost(true);
    };

    const handleJoin = (code, name) => {
        setUsername(name);
        setSessionCode(code);
        setIsHost(false);
    };

    const handleLeave = () => {
        setSessionCode(null);
        setUsername(null);
        setIsHost(false);
    };

    const handleKicked = () => {
        alert("You have been kicked from the session.");
        handleLeave();
    };

    return (
        <div className="container">
            <header className="header">
                <h1>Jam Session</h1>
                <p>Real-time Collaboration</p>
            </header>
            <main className="main">
                {!sessionCode ? (
                    <Home onJoin={handleJoin} onCreate={handleCreate} />
                ) : (
                    <JamRoom
                        sessionCode={sessionCode}
                        username={username}
                        isHost={isHost}
                        onLeave={handleLeave}
                        onKicked={handleKicked}
                    />
                )}
            </main>
        </div>
    );
};

export default App;
