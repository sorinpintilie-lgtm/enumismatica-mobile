
const admin = require('firebase-admin');
const serviceAccount = require('../e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://enumismatica-573d3.firebaseio.com'
});

const db = admin.firestore();

// Clean up duplicate tokens for all users
db.collection('users').get()
  .then(users => {
    const promises = [];
    users.forEach(userDoc => {
      const userId = userDoc.id;
      const devicesRef = db.collection('users').doc(userId).collection('devices');
      promises.push(
        devicesRef.get()
          .then(devices => {
            const tokensMap = new Map();
            const duplicateDocs = [];
            
            devices.forEach(deviceDoc => {
              const device = deviceDoc.data();
              if (device.expoPushToken) {
                if (tokensMap.has(device.expoPushToken)) {
                  // Found duplicate token
                  duplicateDocs.push(deviceDoc.ref);
                  console.log(`User ${userId} has duplicate token: ${device.expoPushToken}`);
                } else {
                  tokensMap.set(device.expoPushToken, deviceDoc.ref);
                }
              }
            });
            
            // Delete duplicate device documents
            const deletePromises = duplicateDocs.map(docRef => {
              return docRef.delete()
                .then(() => console.log(`Deleted duplicate device document for user ${userId}`))
                .catch(error => console.error(`Failed to delete duplicate for user ${userId}:`, error));
            });
            
            return Promise.all(deletePromises);
          })
      );
    });
    return Promise.all(promises);
  })
  .then(() => console.log('Cleanup completed'))
  .catch(error => console.error('Error during cleanup:', error))
  .finally(() => admin.app().delete());
