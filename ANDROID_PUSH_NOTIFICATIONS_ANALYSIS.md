# Android Push Notifications Analysis

## Current Implementation

### 1. Client-Side Flow

#### App Initialization (App.tsx)
- Line 346: `setupNotificationListeners()` is called on app mount
- This sets up listeners for incoming push notifications

#### Notification Service (services/notificationService.ts)

**Notification Channel Setup (lines 17-27):**
```typescript
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#e7b73c',
    sound: 'default',
  }).catch(() => {
    // ignore channel errors
  });
}
```

**Permission Request (lines 40-54):**
```typescript
if (Platform.OS === 'android') {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') {
      return false;
    }
  }
  return true;
}
```

**Push Token Retrieval (lines 64-91):**
```typescript
const projectId = Constants.expoConfig?.extra?.eas?.projectId
  ?? Constants.easConfig?.projectId;

const token = await Notifications.getExpoPushTokenAsync({
  projectId,
});
```

#### Push Token Service (services/pushTokenService.ts)

**Device Registration (lines 11-53):**
```typescript
const deviceDocId = `${Platform.OS}-${expoPushToken.substring(0, 20)}`;
const deviceRef = doc(db, 'users', userId, 'devices', deviceDocId);

const payload: DeviceRegistration = {
  expoPushToken,
  platform: Platform.OS,
  updatedAt: serverTimestamp(),
};

await setDoc(deviceRef, payload, { merge: true });
```

#### Auth Context (context/AuthContext.tsx)

**Token Registration on Login (lines 50-54, 66-70, 79-83):**
```typescript
if (currentUser?.uid) {
  console.log('[AuthContext] Registering push token for user:', currentUser.uid);
  registerPushTokenForUser(currentUser.uid).catch((error) => {
    console.error('[AuthContext] Failed to register push token:', error);
  });
}
```

### 2. Server-Side Flow (Firebase Cloud Functions)

#### Notification Trigger (functions/src/index.ts)

**Function Trigger (lines 94-98):**
```typescript
export const sendNotificationPush = onDocumentCreated(
  {
    region: "europe-west1",
    document: "users/{userId}/notifications/{notificationId}",
  },
  async (event) => {
    // Process notification
  }
);
```

**Device Fetch (lines 175-180):**
```typescript
const devicesSnap = await admin
  .firestore()
  .collection("users")
  .doc(params.userId)
  .collection("devices")
  .get();
```

**Push Send (lines 56-88):**
```typescript
async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<void> {
  const chunks = chunkArray(messages, 100);

  await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      // Handle response
    })
  );
}
```

### 3. Notification Creation (shared/chatService.ts)

**Create Notification (lines 563-615):**
```typescript
const notificationData: any = {
  userId,
  type,
  senderId,
  senderName,
  message,
  read: false,
  pushed: false,  // IMPORTANT: Set to false
  createdAt: new Date(),
};

const docRef = await addDoc(notificationsRef, {
  ...notificationData,
  createdAt: serverTimestamp(),
});
```

## Potential Issues

### Issue 1: Notification Channel ID Mismatch
**Severity: HIGH**

The notification channel is created with ID `'default'`, but when sending push notifications from the Firebase Cloud Function, there's no `channelId` specified in the payload. This could cause Android to not display the notification properly.

**Fix:** Add `channelId` to the Expo push message payload.

### Issue 2: Notification Channel Creation Timing
**Severity: MEDIUM**

The notification channel is created at module initialization time (when the service is first imported), which happens before the app is fully initialized. This could cause issues if the channel creation fails silently.

**Fix:** Move channel creation to a more controlled location and add better error handling.

### Issue 3: Missing Android-Specific Fields in Push Payload
**Severity: HIGH**

The Firebase Cloud Function sends push notifications with a basic payload:
```typescript
{
  to: device.expoPushToken,
  title,
  body,
  data: { ... },
}
```

For Android, Expo recommends including additional fields:
- `channelId`: The notification channel ID
- `sound`: Sound to play
- `priority`: Notification priority

**Fix:** Add Android-specific fields to the push payload.

### Issue 4: Firebase Cloud Function Not Deployed
**Severity: HIGH**

If the Firebase Cloud Function is not deployed or has deployment errors, notifications won't be sent.

**Fix:** Verify deployment and check Firebase logs for errors.

### Issue 5: Expo Push Token Not Being Retrieved
**Severity: HIGH**

If the Expo push token is not being retrieved properly (due to permissions, project ID issues, or network problems), the device won't be registered.

**Fix:** Add better error handling and logging for token retrieval.

### Issue 6: Device Document Not Being Created
**Severity: MEDIUM**

If the device document is not being created in Firestore (due to permission issues, network problems, or Firestore errors), the Firebase Cloud Function won't find any devices to send to.

**Fix:** Add better error handling and logging for device registration.

### Issue 7: Notification Already Marked as Pushed
**Severity: LOW**

If the notification is somehow marked as `pushed: true` before the Cloud Function processes it, the Cloud Function will skip it.

**Fix:** This is unlikely, but worth checking.

## Recommended Fixes

### Fix 1: Add Channel ID to Push Payload
Update the Firebase Cloud Function to include `channelId` in the push payload for Android devices.

### Fix 2: Improve Notification Channel Setup
Move notification channel creation to a more controlled location and add better error handling.

### Fix 3: Add Android-Specific Fields to Push Payload
Add `sound`, `priority`, and other Android-specific fields to the push payload.

### Fix 4: Add Better Logging
Add comprehensive logging throughout the push notification flow to help debug issues.

### Fix 5: Verify Firebase Cloud Function Deployment
Check Firebase logs to ensure the Cloud Function is deployed and working correctly.

## Testing Checklist

- [ ] Verify notification channel is created correctly
- [ ] Verify push token is retrieved successfully
- [ ] Verify device document is created in Firestore
- [ ] Verify notification document is created in Firestore
- [ ] Verify Firebase Cloud Function is triggered
- [ ] Verify Firebase Cloud Function fetches devices
- [ ] Verify Firebase Cloud Function sends push to Expo
- [ ] Verify Expo receives and processes the push
- [ ] Verify Android device receives and displays the notification
