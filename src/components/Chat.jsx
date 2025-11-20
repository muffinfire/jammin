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
        <div className="card chat-card">
            <h3>CHAT</h3>
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">No messages yet</div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className="chat-message">
                            <span className="chat-username">{msg.username}</span>
                            <span className="chat-text">{msg.message}</span>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
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
