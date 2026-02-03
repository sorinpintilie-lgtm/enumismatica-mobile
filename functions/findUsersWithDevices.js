
const admin = require('firebase-admin');
const serviceAccount = require('../e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://enumismatica-573d3.firebaseio.com'
});

const db = admin.firestore();

async function findUsersWithDevices() {
  try {
    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} users total`);
    
    const usersWithDevices = [];
    
    for (const userDoc of usersSnap.docs) {
      const devicesSnap = await userDoc.ref.collection('devices').get();
      if (!devicesSnap.empty) {
        const deviceCount = devicesSnap.size;
        const activeTokens = [];
        devicesSnap.forEach(doc => {
          const device = doc.data();
          if (device.expoPushToken) {
            activeTokens.push(device.expoPushToken);
          }
        });
        
        usersWithDevices.push({
          userId: userDoc.id,
          deviceCount,
          activeTokens
        });
      }
    }
    
    console.log(`Found ${usersWithDevices.length} users with devices`);
    
    usersWithDevices.forEach(user => {
      console.log(`\nUser ${user.userId} has ${user.deviceCount} device(s)`);
      console.log(`Active tokens: ${user.activeTokens.join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error finding users with devices:', error);
  } finally {
    await admin.app().delete();
  }
}

findUsersWithDevices();
