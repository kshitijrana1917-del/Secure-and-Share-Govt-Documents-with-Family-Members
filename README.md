# GovSecure | Secure and Share Government Documents with Family Members

**GovSecure** is a professional-grade, secured document storage and sharing platform designed for Indian government document management. It features high-security identity linkage through Aadhaar verification and provides a modern, responsive interface for secure document handling and family member sharing.

## 🚀 Key Features

-   **Aadhaar-Based Identity Verification**: Secure identity verification system for government document storage and access control
-   **Email-Based OTP Authentication**: Two-factor authentication using OTP for enhanced security
-   **Secure Document Upload & Storage**: Upload, store, and manage sensitive government documents safely
-   **Document Sharing with Family Members**: Share encrypted documents with family members via secure email-based access links
-   **PDF & Image Preview**: Preview documents instantly within the platform
-   **Comprehensive Audit Trail**: Detailed logging of all actions (Uploads, Shares, Downloads, Deletions, Access attempts)
-   **Real-time Notifications**: WebSocket-based real-time notifications for document sharing and access
-   **OCR Capability**: Extract text from scanned documents using Tesseract.js
-   **Document Watermarking**: Add watermarks to PDFs for security and traceability
-   **Admin Dashboard**: Administrative tools for user management and system monitoring
-   **Modern UI/UX**: Responsive design optimized for desktop and mobile devices

## 📱 Mobile & Desktop Viewing

The platform is fully responsive and adjusts its layout for the best experience on any device:

-   **Desktop**: Full-featured dashboard with sidebar navigation for maximum workspace efficiency
-   **Mobile**: Adaptive responsive design, mobile-optimized cards and forms

## 🛠️ Technology Stack

### Backend
- **Node.js/Express.js**: RESTful API server
- **SQLite3**: Database for document and user management
- **Socket.io**: Real-time notifications and WebSocket support
- **JWT**: Secure authentication with JSON Web Tokens
- **Helmet**: Security headers and XSS protection
- **Express Rate Limiting**: API rate limiting for DDoS protection
- **Multer**: File upload handling
- **Nodemailer**: Email sending for OTP and sharing notifications
- **AWS SDK**: Cloud storage integration for documents
- **Tesseract.js**: Optical Character Recognition (OCR) for document scanning
- **PDF-lib**: PDF manipulation and watermarking
- **Twilio**: SMS/Phone integration (optional)
- **Winston & Pino**: Logging and monitoring

### Frontend
- **React.js**: Modern UI framework
- **Vite**: Fast build tool for development
- **ESLint**: Code quality and linting

### Development Tools
- **Jest**: Unit testing framework
- **Supertest**: HTTP assertion library for API testing
- **Socket.io Client**: Real-time client for testing

## 📋 API Routes & Features

### Authentication Routes (`/api/auth`)
- User registration with Aadhaar verification
- Email-based OTP authentication
- Login/Logout functionality
- Password management
- Session management

### Document Routes (`/api/documents`)
- Upload government documents (PDFs, Images)
- List user documents with filters
- Download documents
- Delete documents
- Get document metadata
- Preview documents (images and PDFs)
- Apply watermarks to PDFs

### Sharing Routes (`/api/share`)
- Share documents with family members via email
- Generate secure access links
- Manage access permissions
- Revoke document access
- Track shared document access

### Admin Routes (`/api/admin`)
- User management
- System monitoring
- Document verification
- Audit log access
- System statistics

### Logging Routes (`/api/logs`)
- Access audit trails
- View document activity logs
- Download log reports

## 🛠️ Local Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/kshitijrana1917-del/Secure-and-Share-Govt-Documents-with-Family-Members.git
    cd Secure-and-Share-Govt-Documents-with-Family-Members
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```
    
    *(Optional: Complete `node_modules` is included in the repository)*

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3000
    JWT_SECRET=your_high_security_secret_key_here
    JWT_EXPIRY=7d
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_app_password
    AWS_ACCESS_KEY_ID=your_aws_access_key
    AWS_SECRET_ACCESS_KEY=your_aws_secret_key
    AWS_REGION=us-east-1
    AWS_S3_BUCKET=your_s3_bucket_name
    TWILIO_ACCOUNT_SID=your_twilio_sid
    TWILIO_AUTH_TOKEN=your_twilio_token
    TWILIO_PHONE=+1234567890
    NODE_ENV=development
    ```

4.  **Start the Server**:
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`

5.  **Run Tests**:
    ```bash
    npm test
    ```

## 📦 Project Structure

```
├── routes/                  # API route definitions
│   ├── authRoutes.js       # Authentication endpoints
│   ├── documentRoutes.js   # Document management endpoints
│   ├── shareRoutes.js      # Document sharing endpoints
│   ├── adminRoutes.js      # Admin management endpoints
│   └── logRoutes.js        # Audit logging endpoints
├── middleware/             # Custom middleware
│   └── auth.js            # JWT authentication middleware
├── utils/                  # Utility functions
│   ├── logger.js          # Logging configuration
│   ├── emailService.js    # Email sending service
│   ├── messageService.js  # Message/notification service
│   └── storageService.js  # File storage service
├── public/                 # Static frontend files
│   ├── index.html         # Main HTML entry point
│   ├── dashboard.html     # User dashboard
│   ├── verify.html        # Verification page
│   ├── aadhaar-verify.html # Aadhaar verification page
│   ├── css/               # Stylesheets
│   └── js/                # Frontend JavaScript
├── client/                 # React frontend (Vite)
│   ├── src/
│   ├── public/
│   └── vite.config.js
├── database.js            # Database initialization
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
└── __tests__/             # Test files
```

## 🚀 Running the Application

### Development Mode
```bash
npm start
```

### With Docker
```bash
docker-compose up
```

### Testing
```bash
npm test
```

## 🔐 Security Features

✅ Aadhaar-based identity verification
✅ Email OTP authentication
✅ JWT token-based authorization
✅ CORS protection
✅ Helmet security headers
✅ Rate limiting on API endpoints
✅ XSS and CSRF protection
✅ Secure password hashing
✅ Encrypted document transmission
✅ Audit logging of all sensitive operations
✅ Role-based access control (Admin/User/Viewer)

## 📊 Database Schema

The application uses SQLite with the following main tables:
- **users**: User accounts and Aadhaar information
- **documents**: Document metadata and storage references
- **shares**: Document sharing permissions and access logs
- **audit_logs**: Comprehensive activity tracking
- **notifications**: Real-time notification queue

## 🐳 Docker Deployment

A `Dockerfile` and `docker-compose.yml` are included for containerized deployment.

```bash
# Build and run with Docker
docker-compose up --build
```

## ☁️ Deployment Guide

### Option 1: Render (Recommended)

1. Connect your GitHub repository to [Render](https://render.com)
2. Create a new **Web Service**
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add environment variables in the **Environment** tab

### Option 2: Railway

1. Connect your GitHub repository to [Railway](https://railway.app)
2. Create new project and link this repository
3. Add environment variables
4. Auto-deploy on push

### Option 3: VPS (Ubuntu/Nginx)

1. SSH into your VPS
2. Install Node.js v16+: `curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - && sudo apt-get install -y nodejs`
3. Clone and install: `npm install`
4. Use **PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name gov-secure
   pm2 startup
   pm2 save
   ```
5. Configure Nginx as reverse proxy to localhost:3000

### Option 4: AWS/Azure

1. Use EC2 (AWS) or App Service (Azure)
2. Follow VPS setup steps
3. Configure load balancer if needed

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| JWT_SECRET | Secret for JWT signing | your_secret_key |
| JWT_EXPIRY | Token expiration time | 7d |
| EMAIL_USER | Email for sending OTP | your_email@gmail.com |
| EMAIL_PASS | Email app password | xxxx xxxx xxxx xxxx |
| AWS_ACCESS_KEY_ID | AWS access key | AKIAIOSFODNN7EXAMPLE |
| AWS_SECRET_ACCESS_KEY | AWS secret key | wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY |
| AWS_REGION | AWS region | us-east-1 |
| AWS_S3_BUCKET | S3 bucket name | govt-secure-docs |
| NODE_ENV | Environment | development/production |

## 🧪 Testing

The project includes Jest tests for:
- Authentication flows
- Document upload/download
- Sharing functionality
- Admin operations
- API security

Run tests with: `npm test`

## 📈 Future Enhancements

- [ ] Mobile app (React Native)
- [ ] Biometric authentication (fingerprint/face)
- [ ] Advanced encryption (RSA/AES)
- [ ] Document signing capabilities
- [ ] Blockchain audit trail
- [ ] Machine learning-based document classification
- [ ] Multi-language support
- [ ] Dark mode theme

## 🐛 Known Issues & Limitations

- Rate limiting disabled in development mode (can be re-enabled)
- AWS SDK v2 in use (consider upgrading to v3)
- Some dependencies may have vulnerabilities (check with `npm audit`)

## 📞 Support & Contact

For issues, bugs, or feature requests, please create an issue in the GitHub repository.

**Repository**: https://github.com/kshitijrana1917-del/Secure-and-Share-Govt-Documents-with-Family-Members

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

**Last Updated**: May 18, 2026
**Status**: Active Development
**Maintainer**: kshitijrana1917
