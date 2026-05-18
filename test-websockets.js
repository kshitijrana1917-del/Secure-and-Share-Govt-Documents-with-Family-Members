require('dotenv').config();
const { io } = require('socket.io-client');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const db = new sqlite3.Database('./database.sqlite');

async function runTest() {
    console.log("🚀 Starting Real-Time WebSocket Integration Test...\n");

    const userA = { email: 'usera@test.com', name: 'User A', aadhaar_last4: '3333' };
    const userB = { email: 'userb@test.com', name: 'User B', aadhaar_last4: '6666' };

    await new Promise(r => db.serialize(() => {
        db.run(`INSERT OR IGNORE INTO users (email, name, role, aadhaar_verified, aadhaar_last4) VALUES (?, ?, 'citizen', 1, ?)`, [userA.email, userA.name, userA.aadhaar_last4]);
        db.run(`INSERT OR IGNORE INTO users (email, name, role, aadhaar_verified, aadhaar_last4) VALUES (?, ?, 'citizen', 1, ?)`, [userB.email, userB.name, userB.aadhaar_last4]);
        r();
    }));

    const idA = await new Promise(r => db.get("SELECT id FROM users WHERE email=?", [userA.email], (err, row) => r(row.id)));
    const idB = await new Promise(r => db.get("SELECT id FROM users WHERE email=?", [userB.email], (err, row) => r(row.id)));
    
    // Create an aadhaar_hash in db for user B to share
    const bHash = require('crypto').createHash('sha256').update('444455556666').digest('hex');
    await new Promise(r => db.run("UPDATE users SET aadhaar_hash = ? WHERE id = ?", [bHash, idB], r));

    console.log(`✅ Mock Users Created: User A (ID: ${idA}), User B (ID: ${idB})`);

    const tokenA = jwt.sign({ id: idA, email: userA.email, role: 'citizen' }, JWT_SECRET, { expiresIn: '1h' });
    const tokenB = jwt.sign({ id: idB, email: userB.email, role: 'citizen' }, JWT_SECRET, { expiresIn: '1h' });

    console.log("🔌 User B is opening a WebSocket connection to the server...");
    const socketB = io('http://localhost:3000');
    
    socketB.on('connect', () => {
        socketB.emit('join', userB.email);
        console.log("✅ User B connected and joined room:", userB.email);
        
        // Listen for the share event
        socketB.on('document_shared', (data) => {
            console.log("\n🎉 BOOM! Real-Time WebSocket Event Received by User B:");
            console.log("-----------------------------------------------------");
            console.log(data);
            console.log("-----------------------------------------------------\n");
            console.log("✅ Test Passed Successfully! The Cloud-Ready architecture is working.");
            process.exit(0);
        });

        // Trigger the actions as User A
        performUserAActions();
    });

    async function performUserAActions() {
        console.log("\n📤 User A is creating a mock file and uploading it to the Vault...");
        
        const testFilePath = path.join(__dirname, 'test_mock_file.pdf');
        fs.writeFileSync(testFilePath, 'This is a mock PDF file content.');
        
        const formData = new FormData();
        formData.append('document', fs.createReadStream(testFilePath), { contentType: 'application/pdf', filename: 'test_mock_file.pdf' });
        formData.append('documentName', 'Secret Contract');
        formData.append('category', 'Contracts');

        try {
            const uploadRes = await axios.post('http://localhost:3000/api/documents/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${tokenA}`,
                    ...formData.getHeaders()
                }
            });
            
            const docId = uploadRes.data.documentId;
            console.log(`✅ Upload complete! Document ID: ${docId}`);
            
            console.log(`\n🤝 User A is sharing Document #${docId} with User B (Aadhaar: 444455556666)...`);
            
            const shareRes = await axios.post('http://localhost:3000/api/shares/share', {
                documentId: docId,
                recipientAadhaar: '444455556666',
                expiryHours: 24,
                permissions: 'view'
            }, {
                headers: {
                    'Authorization': `Bearer ${tokenA}`
                }
            });
            
            console.log(`✅ Share API Response:`, shareRes.data.message);
            console.log(`⏳ Waiting for WebSocket to emit event to User B...`);
            
        } catch (err) {
            console.error("Error during actions:", err.response ? err.response.data : err.message);
            process.exit(1);
        }
    }
}

runTest().catch(console.error);
