import React, { useState, useRef, useEffect } from 'react';

const Chat = ({ messages, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Auto-scroll removed as requested
    // const scrollToBottom = () => {
    //   if (messagesEndRef.current) {
    //     messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    //   }
    // };
    // useEffect(scrollToBottom, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    return (
        <div className="card chat-container">
            <h3>Chat</h3>
            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className="chat-message">
                        <span className="chat-username">{msg.username}:</span>
                        <span>{msg.message}</span>
                        <span className="chat-timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary btn-small">Send</button>
            </form>
        </div>
    );
};

export default Chat;
