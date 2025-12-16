/**
 * Script to reset all user passcodes in Firebase
 * Run with: node scripts/reset-all-passcodes.js
 * 
 * Make sure to set FIREBASE_DATABASE_URL in your environment or .env.local
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
// You need to download your service account key from Firebase Console
// and set GOOGLE_APPLICATION_CREDENTIALS environment variable
// OR you can use the database URL directly

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL;

if (!databaseURL) {
    console.error('Error: Firebase Database URL not found in environment variables');
    console.log('Please set NEXT_PUBLIC_FIREBASE_DATABASE_URL or FIREBASE_DATABASE_URL');
    process.exit(1);
}

// Initialize with just the database URL (limited access)
admin.initializeApp({
    databaseURL: databaseURL
});

const db = admin.database();

async function resetAllPasscodes() {
    console.log('🔄 Starting passcode reset for all users...');
    console.log('Database URL:', databaseURL);

    try {
        // Get all users
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();

        if (!users) {
            console.log('❌ No users found in database');
            return;
        }

        const userIds = Object.keys(users);
        console.log(`📊 Found ${userIds.length} users`);

        let resetCount = 0;

        for (const userId of userIds) {
            const user = users[userId];
            const updates = {};
            let needsUpdate = false;

            // Check if user has passcode data
            if (user.passcode) {
                updates[`users/${userId}/passcode`] = null;
                needsUpdate = true;
                console.log(`  - Removing passcode for user: ${user.username || userId}`);
            }

            // Reset passcode attempts
            if (user.passcodeAttempts) {
                updates[`users/${userId}/passcodeAttempts`] = null;
                needsUpdate = true;
            }

            if (user.totalPasscodeAttempts) {
                updates[`users/${userId}/totalPasscodeAttempts`] = null;
                needsUpdate = true;
            }

            if (user.lockoutUntil) {
                updates[`users/${userId}/lockoutUntil`] = null;
                needsUpdate = true;
            }

            if (user.lastFailedAttempt) {
                updates[`users/${userId}/lastFailedAttempt`] = null;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await db.ref().update(updates);
                resetCount++;
            }
        }

        console.log(`\n✅ Successfully reset passcodes for ${resetCount} users`);
        console.log('All users will need to set up a new PIN on their next login.');

    } catch (error) {
        console.error('❌ Error resetting passcodes:', error);
    } finally {
        process.exit(0);
    }
}

resetAllPasscodes();
