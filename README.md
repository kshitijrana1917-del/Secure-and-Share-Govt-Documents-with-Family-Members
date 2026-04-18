# GovSecure | High-End Government Document Vault

**GovSecure** is a professional-grade, secured document storage platform designed with a modern "Dark SaaS" aesthetic. It features high-security identity linkage through Aadhaar and an immersive, responsive interface optimized for both desktop and mobile viewing.

## 🚀 Key Features

-   **High-End Design System**: Built with the **Geist** font family and a sophisticated dark/light mode engine inspired by Linear and Vercel.
-   **Identity Linkage (Aadhaar)**: Implements a "Security Onboarding" flow that blocks access until the user's identity is verified via Email-based OTP.
-   **Bento-Grid Dashboard**: A modern command center for managing encrypted documents, audit trails, and security health.
-   **Document Previewer**: Instant, glassmorphic previewing for both images and PDFs within the vault.
-   **Audit Trail**: Comprehensive logging of all sensitive actions (Uploads, Shares, Downloads, Deletions).
-   **Secure Delegation**: Share encrypted documents with others via email-based access links.

## 📱 Mobile & Desktop Viewing

The platform is fully responsive and adjusts its layout for the best experience on any device:

-   **Desktop**: Immersive split-screen login and a sidebar-driven dashboard for maximum workspace efficiency.
-   **Mobile**: Adaptive glassmorphic bottom navigation, responsive bento grids, and mobile-optimized document cards.

### Testing on Mobile Locally

To view the project on your mobile device while it's running on your computer:

1.  Ensure both your computer and phone are on the same Wi-Fi network.
2.  Find your computer's local IP address (e.g., `192.168.1.x`).
3.  Open the mobile browser and navigate to `http://YOUR_LOCAL_IP:3000`.

## 🛠️ Local Setup

1.  **Clone the repository**:
    ```bash
    git clone [repository-url]
    cd govt-secured-documents
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add the following:
    ```env
    PORT=3000
    JWT_SECRET=your_high_security_secret
    EMAIL_USER=your_email@example.com
    EMAIL_PASS=your_app_password
    ```

4.  **Start the Engine**:
    ```bash
    npm start
    ```

## ☁️ Deployment Guide

### Option 1: Render (Recommended for Node.js)

1.  Connect your GitHub repository to [Render](https://render.com).
2.  Create a new **Web Service**.
3.  Set the **Build Command** to `npm install`.
4.  Set the **Start Command** to `npm start`.
5.  Add your environment variables (`JWT_SECRET`, `EMAIL_USER`, etc.) in the **Environment** tab.

### Option 2: VPS (Ubuntu/Nginx)

1.  SSH into your VPS.
2.  Clone the repository and install Node.js/NPM.
3.  Use **PM2** to keep the process running:
    ```bash
    pm2 start server.js --name gov-secure
    ```
4.  Configure Nginx as a reverse proxy to forward traffic to port 3000.


