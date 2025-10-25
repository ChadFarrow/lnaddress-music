# User Authentication with Breez SDK Integration

This document describes the user authentication system that allows users to store their Breez SDK 12-word phrases securely and login without needing to re-enter their mnemonic.

## 🎯 Overview

The authentication system provides:
- **User Registration/Login**: Username and password-based authentication
- **Secure Wallet Storage**: Encrypted storage of 12-word mnemonic phrases
- **Auto-Connect**: Automatic Breez wallet connection on login
- **Session Management**: JWT-based sessions with secure cookies

## 🏗️ Architecture

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Encrypted wallet storage
CREATE TABLE user_wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  encrypted_mnemonic TEXT NOT NULL,
  encryption_iv VARCHAR(32) NOT NULL,
  encryption_tag VARCHAR(32) NOT NULL,
  network VARCHAR(20) DEFAULT 'mainnet' CHECK (network IN ('mainnet', 'regtest')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Security Features

- **Password Hashing**: PBKDF2 with 100,000 iterations
- **Mnemonic Encryption**: AES-256-GCM encryption
- **Session Security**: JWT tokens with httpOnly cookies
- **Input Validation**: Comprehensive validation for all inputs

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Wallet Management
- `POST /api/auth/wallet` - Store/update wallet mnemonic
- `GET /api/auth/wallet` - Get user's wallet info
- `POST /api/auth/wallet/mnemonic` - Get decrypted mnemonic for Breez connection

## 🎨 Frontend Components

### Core Components
- `AuthModal` - Main authentication modal with login/register
- `LoginForm` - Login form component
- `RegisterForm` - Registration form component
- `WalletSetup` - Wallet setup component for new users
- `BreezAuthConnect` - Breez connection component with user authentication

### Context & Hooks
- `AuthContext` - Global authentication state management
- `useBreezAuth` - Hook for Breez integration with user accounts

## 🔧 Setup Instructions

### 1. Environment Configuration

Add to your `.env.local` file:
```bash
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### 2. Database Initialization

The database tables will be created automatically when the app starts. The `initializeDatabase()` function in `lib/db.ts` handles this.

### 3. Dependencies

Required packages (already installed):
```bash
npm install jsonwebtoken @types/jsonwebtoken bcrypt @types/bcrypt
```

## 📱 User Flow

### New User Registration
1. User clicks "Register" 
2. Enters username and password
3. Account is created with hashed password
4. User is prompted to set up Lightning wallet
5. Can either import existing 12-word phrase or create new one
6. Mnemonic is encrypted and stored securely
7. User is logged in and wallet is ready

### Returning User Login
1. User enters username and password
2. Password is verified against stored hash
3. User is prompted for wallet password
4. Mnemonic is decrypted and passed to Breez SDK
5. Wallet connects automatically
6. User can use Lightning payments

## 🔒 Security Considerations

### Demo Environment
This is designed for demo purposes. For production use, consider:

- **Stronger Password Requirements**: Implement more complex password policies
- **Rate Limiting**: Add rate limiting to prevent brute force attacks
- **Audit Logging**: Log all authentication attempts
- **Multi-Factor Authentication**: Add 2FA for additional security
- **Key Rotation**: Implement JWT key rotation
- **Secure Storage**: Use hardware security modules for key storage

### Encryption Details
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Salt**: Username-based salt (consider random salt for production)
- **IV**: Random 16-byte initialization vector
- **Tag**: Authentication tag for integrity verification

## 🧪 Testing

### Demo Page
Visit `/auth-demo` to test the complete authentication flow:

1. **Register** a new account
2. **Setup** a Lightning wallet (import or create)
3. **Login** and connect your wallet
4. **Test** the complete flow

### Test Scenarios
- ✅ User registration with validation
- ✅ User login with password verification
- ✅ Wallet setup (import/create)
- ✅ Encrypted mnemonic storage
- ✅ Decrypted mnemonic retrieval
- ✅ Breez SDK integration
- ✅ Session management
- ✅ Logout functionality

## 🔧 Customization

### Password Requirements
Modify `validatePassword()` in `lib/encryption-service.ts`:
```typescript
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  // Customize password requirements here
}
```

### Username Requirements
Modify `validateUsername()` in `lib/encryption-service.ts`:
```typescript
export function validateUsername(username: string): { valid: boolean; errors: string[] } {
  // Customize username requirements here
}
```

### Session Duration
Modify `JWT_EXPIRES_IN` in `lib/session-service.ts`:
```typescript
const JWT_EXPIRES_IN = '24h'; // Change to your preferred duration
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and configured
2. **JWT Secret**: Make sure `JWT_SECRET` is set in environment variables
3. **Breez API Key**: Ensure `NEXT_PUBLIC_BREEZ_API_KEY` is configured
4. **CORS Issues**: Check that cookies are being sent with requests

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## 📚 File Structure

```
lib/
├── db.ts                    # Database functions and schema
├── encryption-service.ts    # Password hashing and mnemonic encryption
└── session-service.ts      # JWT token management

app/api/auth/
├── register/route.ts       # User registration endpoint
├── login/route.ts          # User login endpoint
├── logout/route.ts         # User logout endpoint
├── me/route.ts            # Current user info endpoint
└── wallet/
    ├── route.ts           # Wallet management endpoints
    └── mnemonic/route.ts  # Mnemonic decryption endpoint

contexts/
└── AuthContext.tsx        # Global authentication state

hooks/
└── useBreezAuth.ts        # Breez integration with user accounts

components/
├── AuthModal.tsx          # Main authentication modal
├── LoginForm.tsx          # Login form component
├── RegisterForm.tsx       # Registration form component
├── WalletSetup.tsx        # Wallet setup component
└── BreezAuthConnect.tsx   # Breez connection component
```

## 🎉 Success!

Your authentication system is now ready! Users can:
- Register with username/password
- Store their Breez wallet securely
- Login quickly without re-entering 12-word phrases
- Use Lightning payments seamlessly

The system is designed to be simple for demo purposes while maintaining security best practices for encrypted storage and session management.
