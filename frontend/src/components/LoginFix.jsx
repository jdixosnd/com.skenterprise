// Temporary login component that bypasses Django auth
import { useState } from 'react';
import '../styles/LoginPage.css';

const LoginFix = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    // Create user object
    const userData = {
      username: username || 'demo',
      role: 'User', // Single unified role
    };

    // Save to localStorage
    localStorage.setItem('user', JSON.stringify(userData));

    // Call parent callback
    onLogin(userData);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Textile Inventory System</h1>
          <p>Demo Mode - Enter to Access All Features</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username (optional)</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
          </div>

          <button type="submit" className="btn-login">
            Enter System
          </button>

          <div className="demo-credentials">
            <small>Demo Mode: Access to all features (Inward Log, Program Entry, Billing)</small>
            <br />
            <small>For full authentication, use Django Admin: <a href="http://localhost:8000/admin/" target="_blank" rel="noopener noreferrer">Admin Panel</a></small>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginFix;
