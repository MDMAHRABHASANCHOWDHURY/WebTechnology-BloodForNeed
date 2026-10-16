# Blood For Need

A Bangladesh-focused blood donation web project. Donors, volunteers, medical staff and administrators use one login page, then receive their own dashboard features.

## Technology

HTML5, CSS3, vanilla JavaScript, Bootstrap 5, Node.js, Express and MongoDB with Mongoose. HTML, CSS, JavaScript, backend files and images are stored directly in the main project folder.

## Run With VS Code F5

Node.js and MongoDB Community Server must be installed.

1. Extract the project and open the folder containing `server.js` and `.vscode` using **File → Open Folder** in VS Code.
2. Press **F5**. If asked to choose a configuration, select **Blood For Need — Start App**.
3. Wait for startup. Your default browser opens automatically when the server is ready.
4. Use **Shift + F5** to stop the app.

You do not need to enter terminal commands each time. The launcher installs missing packages on first use, checks MongoDB, starts its Windows service when permitted, and starts the web server. An available port is selected if port 3000 is already occupied. The URL printed in Debug Console is the one to use.

The `.vscode/launch.json` file is required for F5. Keep that folder when copying the project. No VS Code extension is required for Node.js debugging.

If Windows blocks service startup, open `services.msc` and start the existing **MongoDB** service once, then press F5. The launcher does not create a different database or replace existing records. Internet access is only needed if packages are missing.

The first application startup imports the healthcare-facility directory. Existing hospital records and accounts are preserved on later runs.

You can still start manually if needed:

```bash
npm install
npm start
```

Default MongoDB connection: `mongodb://127.0.0.1:27017/blood\_donation`.

## Local Administrator

The first startup creates username **admin** with local default password **admin123**. Existing accounts and changed passwords are preserved. Passwords are stored as bcrypt hashes.

Set `ADMIN\_PASSWORD` before the first startup if you want a different initial password. Administrator registration requires the configured invite code; the local default is `ADMIN-2026`.

## Demo Accounts

The updated server creates one active demo account per role on startup. Existing accounts are never overwritten.

|Role|Username|Password|
|-|-|-|
|Volunteer|`volunteer1`|`volunteer123`|
|Medical Staff|`staff1`|`staff123`|
|Administrator|`admin1`|`admin123`|

&#x20;Passwords are stored as bcrypt hashes.

## Features by Role

|Role|Features|
|-|-|
|Donor / Volunteer|Edit profile, upload photo, browse hospitals and all donation requests, pledge to eligible open requests, view own pledges, request a password change|
|Medical Staff|Shared profile/hospital/request features, create patient requests, search compatible donors, view pledge contacts and close own patient requests|
|Administrator|Shared profile/hospital/request features, approve/reject/suspend/reactivate accounts, create active accounts, manage facilities and addresses, approve/reject password changes|

All roles use the same login. Navigation changes after authentication. Role tools are in the top navigation; profiles stay hidden until My Profile is selected. API permissions are checked on the server; hiding a menu is not the access-control mechanism. Pending, rejected and suspended accounts cannot access protected features.

## Forms and Location Details

Hospital directory, available requests and patient facility lookup have explicit Search buttons. Visible interface text uses Title Case; code, stored values, URLs and email addresses retain their original form.

Registration and profiles support country-code selection, area, city corporation, eight divisions, all 64 districts and a four-digit postcode. District choices depend on the selected division. The postcode ranges supplied for this project provide range hints and validation; a district range does not establish that every number is a real post-office code.

Hospital results prioritize matching postcode, then matching area. The hospital table displays facility name, type and details. Area, district and postcode remain available for filtering/sorting. The Available Requests table includes open, fulfilled and cancelled requests. Donors and volunteers can pledge only to compatible open requests and must meet the application's 120-day donation interval rule.

Medical staff must independently confirm clinical eligibility and compatibility. The site is a coordination tool.

## Healthcare-Facility Data

`hospital-data.json` contains **37,928 active healthcare-facility records** derived from a DGHS registry export retrieved on **14 October 2026**. It includes hospitals, clinics, diagnostic centres, blood banks and clinical health centres. Administrative offices and education-only institutions are excluded.

Source: [DGHS Facility Registry](https://hrm.dghs.gov.bd/public/facility-registry/reports/organization-list?submit=Run&is_active=1).

The export has no postcode column. Unknown exact postcodes remain blank. Administrators can add verified postcodes and missing facilities. This is a dated registry snapshot, not a guarantee that every facility operating today is listed. No donation requests are fabricated: requests appear when medical staff create them.

Division/district reference: [Bangladesh National Portal](https://bangladesh.gov.bd/views/district-list).

The Bangladesh-themed donation images are AI-generated visuals, not photographs of documented real events.

## Main Files

|File|Purpose|
|-|-|
|`index.html`, `index.css`, `index.js`|Public home page|
|`login.\*`, `register.\*`|Authentication and registration|
|`user.\*`, `staff.\*`, `admin.\*`|Role dashboards|
|`common.css`, `common.js`|Shared layout, forms and interface functions|
|`locations.js`|Divisions, districts, country codes and postcode ranges|
|`server.js`|HTTP server, sessions, authorization and API routes|
|`database.js`|MongoDB models|
|`validation.js`|Backend validation|
|`hospital-data.json`|Registry-derived facility snapshot|
|`terms.html`, `terms.css`|Community guidelines|

Profile photos receive random filenames and are stored in the main folder. The HTTP server serves only approved frontend files and image names; it does not expose backend code or configuration files.

## Optional Configuration

Environment variables can override the defaults: `MONGO\_URI`, `PORT`, `SESSION\_SECRET`, `ADMIN\_PASSWORD`, `ADMIN\_INVITE\_CODE`, `AUTO\_ADMIN` and `NODE\_ENV`. A local run creates a session secret in MongoDB if none is configured and reuses it after restarting. Session expiry extends with activity; eight hours of inactivity requires logging in again. Stale form tokens refresh automatically once before retrying a protected write. Production use requires a configured session secret of at least 32 characters and HTTPS.

Do not commit passwords, database connection credentials, `.env`, `node\_modules` or uploaded personal photos to GitHub. Install dependencies from `package.json` and `package-lock.json`.

## Checks and Limitations

Functional checks covered authentication and roles, approval, profiles, photo validation, hospital import/search, request creation, pledges, postcode handling, password-change approval and interface controls. Full visual browser testing was not completed in the build environment.

Password changes require the current password and administrator approval. Email/SMS forgotten-password recovery is not implemented. Login lockout is held in memory and resets when the server restarts.

## Troubleshooting

* **MongoDB connection error:** start the MongoDB Windows service through `services.msc`, then press F5 again.
* **package.json not found:** run commands from the folder containing `package.json`; use `cd /d` when switching drives in Command Prompt.
* **Account cannot log in:** check credentials and whether administrator approval is still pending.
* **Hospital data is loading:** wait for the initial import and the server address to appear in Debug Console.

## Patient Contact In My Pledges

Donors and volunteers can view the patient name, supplied contact number and a call link for requests they have pledged to. The protected endpoint filters requests by the signed-in user's pledge ID. Public request lists continue to hide contact numbers. The supplied number may belong to the patient, their attendant or the hospital coordinator.

F5 opens `index.html?start=1` and signs out the browser's previous session, so startup shows the public homepage with Log In/Register controls. Ordinary page refreshes retain your session. This does not change any passwords or database records.

