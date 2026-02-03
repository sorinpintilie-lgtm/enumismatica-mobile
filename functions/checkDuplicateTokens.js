
const admin = require('firebase-admin');
const serviceAccount = require('../e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://enumismatica-573d3.firebaseio.com'
});

const db = admin.firestore();

// Get all users' devices
db.collection('users').get()
  .then(users => {
    const promises = [];
    users.forEach(userDoc => {
      const userId = userDoc.id;
      const devicesRef = db.collection('users').doc(userId).collection('devices');
      promises.push(
        devicesRef.get()
          .then(devices => {
            const tokens = [];
            devices.forEach(deviceDoc => {
              const device = deviceDoc.data();
              if (device.expoPushToken) {
                tokens.push(device.expoPushToken);
              }
            });
            const uniqueTokens = new Set(tokens);
            if (tokens.length > uniqueTokens.size) {
              console.log(`User ${userId} has duplicates: ${tokens.length} total, ${uniqueTokens.size} unique`);
              console.log('Tokens:', tokens);
            }
          })
      );
    });
    return Promise.all(promises);
  })
  .then(() => console.log('Check completed'))
  .catch(error => console.error('Error:', error))
  .finally(() => admin.app().delete());
