import 'dotenv/config';
import fs from 'fs';
import path from 'path';

export default {
  expo: {
    name: "eNumismatica",
    slug: "enumismatica",
    description: "Platformă românească pentru numismatică: monede de colecție, licitații și tranzacții sigure.",
    version: "1.2.8",
    orientation: "portrait",
    icon: "./assets/eNumismatica.ro_logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    jsEngine: "hermes",
    plugins: [
      "@react-native-firebase/app",
      "expo-apple-authentication",
      [
        "expo-notifications",
        {
          "icon": "./assets/eNumismatica.ro_logo.png",
          "color": "#e7b73c",
          "sounds": [],
          "mode": "production"
        }
      ],
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static",
            "deploymentTarget": "15.1",
            "forceStaticLinking": ["RNFBApp", "RNFBAuth", "RNFBFirestore"]
          }
        }
      ],
      "expo-iap"
    ],
    splash: {
      image: "./assets/eNumismatica_trapezoid_no_black_margins.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    ios: {
      supportsTablet: true,
      buildNumber: "0",
      statusBar: {
        style: "dark",
        backgroundColor: "#ffffff"
      },
      infoPlist: {
        UIStatusBarHidden: false,
        UIViewControllerBasedStatusBarAppearance: true,
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Camera access is used to photograph coins and identity documents for listings and verification (for example, front/back photos when adding an item).",
        NSPhotoLibraryUsageDescription: "Photo Library access is used to select existing coin and document photos to upload to listings and account verification.",
        NSPhotoLibraryAddUsageDescription: "Photo Library write access is used only when you choose to save generated or edited listing images to your device."
      },
      bundleIdentifier: "ro.recordtrust.enumismatica",
      googleServicesFile: "./GoogleService-Info.plist",
      entitlements: {
        "aps-environment": "production"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/eNumismatica.ro_logo.png",
        backgroundColor: "#00020d"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "ro.enumismatica.mobile",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "POST_NOTIFICATIONS",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ],
      intentFilters: [
        {
          "action": "VIEW",
          "data": {
            "scheme": "enumismatica"
          },
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      name: "eNumismatica",
      shortName: "eNumismatica",
      description: "Platformă românească pentru numismatică: monede de colecție, licitații și tranzacții sigure.",
      lang: "ro-RO",
      themeColor: "#00020d",
      backgroundColor: "#00020d"
    },
    scheme: "enumismatica",
    extra: {
      company: {
        legalName: "RECORD TRUST SRL",
      },
      developedBy: "sky.ro",
      eas: {
        projectId: "f4fa174b-8702-4031-b9b3-e72887532885",
        fcmV1CredentialPath: process.env.FCM_V1_CREDENTIAL_PATH || "./e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json",
      },
    },
  },
};
