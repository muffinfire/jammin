import React, { useState, useRef, useEffect } from 'react';

const Chat = ({ messages, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesContainerRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            container.scrollTop = container.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    // Generate a consistent color for each username
    const getUserColor = (username) => {
        const colors = [
            '#3b82f6', // blue
            '#10b981', // green
            '#f59e0b', // amber
            '#ef4444', // red
            '#8b5cf6', // purple
            '#ec4899', // pink
            '#14b8a6', // teal
            '#f97316', // orange
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="card chat-card">
            <h3>CHAT</h3>
            <div className="chat-messages" ref={messagesContainerRef}>
                {messages.length === 0 ? (
                    <div className="chat-empty">No messages yet</div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className="chat-message">
                            <span className="chat-username" style={{ color: getUserColor(msg.username) }}>
                                {msg.username}
                            </span>
                            <span className="chat-text">{msg.message}</span>
                        </div>
                    ))
                )}
                <div />
            </div>
            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="chat-input"
                />
                <button type="submit" className="btn-primary">SEND</button>
            </form>
        </div>
    );
};

export default Chat;
