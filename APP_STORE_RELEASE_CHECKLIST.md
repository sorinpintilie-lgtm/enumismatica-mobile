# App Store release checklist (eNumismatica)

This project already has the core mobile build identifiers configured in [`app.config.js`](app.config.js):

- iOS bundle identifier: `ro.enumismatica.mobile`
- Android package: `ro.enumismatica.mobile`
- EAS project ID configured
- iOS build number initialized to `1`

## Important clarification about "company name" and "developed by"

For Apple App Store, the **publisher/company name shown publicly is not taken from Expo config**. It comes from your **Apple Developer account legal entity** and App Store Connect setup.

- Public seller/company should be: **RECORD TRUST SRL**
- Developer attribution text inside app/marketing can mention: **Developed by sky.ro**

In this repository, these values were added under `expo.extra` in [`app.config.js`](app.config.js) for internal reference, but App Store display name is controlled by Apple account data.

## What is already configured in code/build

Check these files:

- [`app.config.js`](app.config.js)
- [`eas.json`](eas.json)
- [`GoogleService-Info.plist`](GoogleService-Info.plist)

Configured:

1. Bundle ID + Firebase iOS `BUNDLE_ID` match (`ro.enumismatica.mobile`)
2. EAS production profile exists
3. iOS build number is set (`buildNumber: "1"`)
4. Non-exempt encryption flag set to false (`ITSAppUsesNonExemptEncryption: false`)

## Still required before App Store submission

## 1) Apple Developer / App Store Connect account-level

1. Apple Developer account must be **Organization** type (not Individual)
2. Legal entity should be exactly **RECORD TRUST SRL**
3. Agreements, tax, and banking must be fully completed in App Store Connect

## 2) App Store Connect app metadata

Fill in these mandatory fields:

1. App name (display name in store)
2. Subtitle
3. Primary category (+ optional secondary)
4. Privacy policy URL
5. Support URL
6. Marketing URL (optional but recommended)
7. App description
8. Keywords
9. Copyright line (example: `© 2026 RECORD TRUST SRL`)
10. Age rating questionnaire

## 3) Compliance and legal

1. App Privacy nutrition labels (data collection + tracking declarations)
2. Export compliance answers (encryption)
3. Content rights declarations (if user-generated/listed content exists)

## 4) Assets required

1. App icon (already in project, but verify final quality)
2. iPhone screenshots for required sizes
3. iPad screenshots (required if iPad supported; currently `supportsTablet: true`)
4. Optional preview videos

## 5) Technical release steps

1. Increment `expo.version` for app version release (for example `1.0.1`)
2. Increment `ios.buildNumber` for each new iOS upload (`2`, `3`, ...)
3. Build production binary:
   - `npm run build:production`
4. Submit build:
   - `npm run submit`
5. In App Store Connect, select uploaded build in the new version and complete submission

## Optional but recommended project improvements

1. Add `ios.usesAppleSignIn` only if Sign in with Apple is implemented/required
2. Keep a release checklist for every submission
3. Add CI validation for version/build number bump before production builds

## Suggested final wording for brand attribution

- Legal publisher/company: **RECORD TRUST SRL**
- Product/engineering attribution: **Developed by sky.ro**

This split is correct and common: legal seller in store listing, implementation credit in app/about/website.
