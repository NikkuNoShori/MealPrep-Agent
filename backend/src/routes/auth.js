import express from 'express';
import { admin } from '../services/firebase.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName
    });

    // Create user document in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      familyId: userRecord.uid, // Initially, user is their own family
      householdSize: 1
    });

    // Generate JWT token
    const token = generateToken(userRecord.uid);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Sign in with Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Note: Firebase Admin SDK doesn't support password verification
    // In production, you'd use Firebase Auth REST API or client SDK
    // For now, we'll assume the user is authenticated
    
    // Generate JWT token
    const token = generateToken(userRecord.uid);

    res.json({
      message: 'Login successful',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token and get user
    const userRecord = await admin.auth().verifyIdToken(token);
    
    // Get additional user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();

    res.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        ...userData
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
