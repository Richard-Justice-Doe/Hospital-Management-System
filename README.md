# Clinic Management System

Hospital staff portal and patient portal for day-to-day clinic work: folders, visits, vitals, consults, lab, pharmacy, billing, appointments, ward, theatre, claims, inventory, HR, audit, and backups.

The public address is a **hospital landing page**, not a blank form. It shows the municipal hospital header, a photo of the entrance, department cards (reception, OPD, nursing, laboratory, pharmacy, imaging, ward, theatre, maternity, specialist clinics, physiotherapy, accounts), posted hours, and a **Staff sign-in** card.

Staff sign in with **username or email**, plus the password. There is no authenticator code.

- Hospital landing / staff sign-in: http://localhost:5173/login
- Staff app (after sign-in): http://localhost:5173/
- Patient portal: http://localhost:5173/portal
- Hospital API: http://127.0.0.1:4000

Posted hours on the landing page: **OPD 7:00–17:00 · Pharmacy 8:00–20:00 · Laboratory 7:30–16:00**. Emergency is marked **24 hours**. NHIS and cash are accepted.

A longer operations guide is in `Clinic-Management-System-Guide.docx`.

## Run

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

That starts the Vite frontend and the Express API together. Open http://localhost:5173/login.

| Command | What it does |
| --- | --- |
| `npm run dev` | Website on port 5173 and API on port 4000 |
| `npm run dev:web` | Frontend only |
| `npm run dev:api` | API only |
| `npm run build` | Production frontend build |
| `npm start` | API only (no Vite watch) |
| `npm test` | Frontend unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

A session ends after **15 minutes** of no activity. **Five** failed sign-ins lock that desk for **one minute**.

## Languages and stack

| Layer | Language / tool | Used for |
| --- | --- | --- |
| App logic | **TypeScript** | Frontend and backend source |
| UI | **React 18**, **HTML** | Staff and portal screens |
| Styling | **Tailwind CSS**, **PostCSS**, **Autoprefixer** | Layout and hospital theme |
| Routing | **React Router 7** | Pages and role-based routes |
| Frontend build | **Vite 6** | Dev server, `/api` proxy to port 4000, production bundle |
| API | **Node.js**, **Express** | Auth, hospital file, backups, claims, reminders |
| Database | **SQLite** via **sql.js** | Shared hospital file at `backend/data/hospital.sqlite` |
| Passwords / PINs | **bcryptjs** | Hashed staff passwords and unique portal PINs |
| Sessions | **JSON Web Tokens** (`jsonwebtoken`) in **httpOnly cookies** (`cookie-parser`) | Staff and portal sessions |
| HTTP hardening | **helmet**, **cors** | Headers and cross-origin cookies |
| Email | **nodemailer** | Appointment reminders and shift notices (`SMTP_*` env vars) |
| SMS | Twilio or `SMS_URL` | Shift notices (`TWILIO_*` or `SMS_*` env vars) |
| TLS | Node **https** | Optional, if `SSL_KEY` and `SSL_CERT` are set |
| Tests | **Vitest**, **Testing Library**, **jsdom** | Frontend tests |
| Quality | **ESLint**, **typescript-eslint**, **Prettier** | Lint and format |
| Monorepo | **npm workspaces**, **concurrently**, **tsx** | `frontend/` + `backend/` in one `npm run dev` |

Currency in the catalogue is **Ghana cedis (GH₵)**.

### Database

SQLite file: `backend/data/hospital.sqlite`

| Table | Contents |
| --- | --- |
| `hospital` | Shared care state (JSON) and version for multi-desk saves |
| `staff_auth` | Email and password hash |
| `patient_pins` | Unique hashed portal PIN per patient |
| `backups` | Hospital file snapshots (every 6 hours, every 25 saves, or manual; last 30 kept) |
| `login_guard` | Failed-sign-in lockout |
| `settings` | JWT secret and other server settings |
| `outbound` | Email and SMS outbox (shift notices and reminders) |

## Staff logins

Sign in at http://localhost:5173/login. Passwords are case-sensitive.

### Admin, accounts, and support

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Admin | `admin` | `admin@clinic.local` | `Admin123!` |
| Matron | `matron` | `matron@clinic.local` | `Matron1!` |
| Cashier | `cashier` | `cashier@clinic.local` | `Cashier1!` |
| Accountant | `accountant` | `accountant@clinic.local` | `Accountant1!` |
| Claims officer | `claims` | `claims@clinic.local` | `Claims1!` |
| Storekeeper | `stores` | `stores@clinic.local` | `Stores1!` |
| Procurement | `procurement` | `procurement@clinic.local` | `Procure1!` |
| IT support | `it` | `it@clinic.local` | `ItDesk1!` |

### Department in-charge

In-charge password is `HeadPass1!` except ward and theatre heads.

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Records head | `records-head` | `records-head@clinic.local` | `HeadPass1!` |
| Consult head | `consult-head` | `consult-head@clinic.local` | `HeadPass1!` |
| Nursing head | `nursing-head` | `nursing-head@clinic.local` | `HeadPass1!` |
| Lab head | `lab-head` | `lab-head@clinic.local` | `HeadPass1!` |
| Pharmacy head | `pharmacy-head` | `pharmacy-head@clinic.local` | `HeadPass1!` |
| X-ray head | `xray-head` | `xray-head@clinic.local` | `HeadPass1!` |
| Physio head | `physio-head` | `physio-head@clinic.local` | `HeadPass1!` |
| Dental head | `dental-head` | `dental-head@clinic.local` | `HeadPass1!` |
| Eye head | `eye-head` | `eye-head@clinic.local` | `HeadPass1!` |
| ENT head | `ent-head` | `ent-head@clinic.local` | `HeadPass1!` |
| Maternity head | `maternity-head` | `maternity-head@clinic.local` | `HeadPass1!` |
| Ward head | `wardhead` | `wardhead@clinic.local` | `WardHead1!` |
| Theatre head | `theatrehead` | `theatrehead@clinic.local` | `Theatre1!` |

### Department staff

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Receptionist | `reception` | `reception@clinic.local` | `Reception1!` |
| Doctor | `doctor` | `doctor@clinic.local` | `DoctorPass1!` |
| Nurse | `nurse` | `nurse@clinic.local` | `NursePass1!` |
| Laboratory | `lab` | `lab@clinic.local` | `LabPass1!` |
| Pharmacist | `pharmacy` | `pharmacy@clinic.local` | `PharmaPass1!` |
| X-ray / imaging | `xray` | `xray@clinic.local` | `XrayPass1!` |
| Physiotherapy | `physio` | `physio@clinic.local` | `PhysioPass1!` |
| Dentist | `dental` | `dental@clinic.local` | `Dentist1!` |
| Eye doctor | `eye` | `eye@clinic.local` | `EyeDoc1!` |
| Eye nurse | `eyenurse` | `eyenurse@clinic.local` | `EyeNurse1!` |
| ENT doctor | `ent` | `ent@clinic.local` | `EntDoc1!` |
| ENT nurse | `entnurse` | `entnurse@clinic.local` | `EntNurse1!` |
| Midwife | `midwife` | `midwife@clinic.local` | `Midwife1!` |
| Ward nurse | `ward` | `ward@clinic.local` | `WardPass1!` |
| Theatre nurse | `theatre` | `theatre@clinic.local` | `Theatre1!` |

In-charge accounts only control **their own department** (roster, unpaid department bills). They no longer open every clinic page. Admin can grant extra pages, or hide default pages, per person on **Admin → Staff**. Admin hospital setup stays Admin-only.

The left menu is grouped as **My work**, **Desk tools**, and **Hospital setup**. Reception sees only reception work (folders, check-in, visits, appointments). A nurse sees nursing, a ward nurse sees the ward, lab sees the laboratory, and so on. Shared desk tools are **Find patient**, **Messages**, **My shifts**, and **Ask AI**. Admin can grant extra pages on **Admin → Staff**.

## Department shift schedule

Every staff member sees **Shifts** at http://localhost:5173/care/shifts. Admin can roster any department. An in-charge can roster only their own department.

Shift presets: morning 07:00–15:00, afternoon 15:00–23:00, night 19:00–07:00, day 08:00–16:00, or custom hours.

1. Pick a department.
2. Choose a worker in that department, date, and shift.
3. Save. The worker gets an in-app notice plus **email** and **SMS**.

Workers can open the same page to see **My shifts**. Cancel a shift to notify them again. In-charge and Admin can open the **Mail and SMS log** (server outbox).

Email and SMS are written to the hospital outbox even without a gateway. To send on the live network:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=clinic@yourhospital.org

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+233...
```

Or set `SMS_URL` and optional `SMS_TOKEN` / `SMS_FROM` for another SMS HTTP API. Ghana numbers such as `024 111 0101` are sent as `+233241110101`.

## Patient portal logins

Folder numbers run `A1/2026` to `A10000/2026`. A new year starts again at `A1/2027`.

Sign in at http://localhost:5173/portal with folder number and that patient’s PIN. Each PIN is unique. Patients see appointments, visit results, amount due, and messages.

| Folder | Patient | Insurance | PIN |
| --- | --- | --- | --- |
| `A1/2026` | Amara Owusu | NHIS | `582041` |
| `A2/2026` | Kwame Mensah | NHIS | `619573` |
| `A3/2026` | Lisa Chen | Private (Acacia Health) | `274860` |
| `A4/2026` | Omar Hassan | Private (Metropolitan) | `931046` |
| `A5/2026` | Nina Patel | NHIS | `408217` |

Admin can issue a new portal PIN from the patient record.

## Staff screens

| Page | Path | Who uses it |
| --- | --- | --- |
| Dashboard | `/care/dashboard` | Required for every staff account. Shows that person’s department (Reception, Nursing, Lab, Accounts, and so on), not a generic hospital page. Admin sees the hospital dashboard. Every other page also shows that page’s dashboard at the top. |
| Patient chart | `/care/chart` | All staff. Search folder; allergies, notes, FHIR export. |
| Appointments | `/care/appointments` | Reception, doctor, Admin. |
| AI assistant | `/care/assistant` | All staff. Also a floating button on other pages. |
| Reception | `/care/reception` | Reception desk only: new folder, check-in & bill, bill later, today’s visits, co-payer, duplicate merge. |
| Nursing | `/care/nursing` | Vitals and nursing procedures. |
| ED triage | `/care/triage` | ESI 1–5. |
| Ward / ADT | `/care/ward` | Admit, transfer, discharge, MAR. |
| Theatre | `/care/theatre` | Theatre board and notes. |
| Doctor | `/care/doctor` | Consult, orders, disposition. |
| Lab / X-ray / physio / pharmacy / clinics | `/care/lab` and matching paths | Department queues. Pharmacy has inventory. |
| Receive payment | `/care/billing` | Cashier only. Admin can open collections and remove a bill, but cannot take money. |
| Collections | `/care/billing` | Accountant. Day / month / year receipts. |
| Claims | `/care/claims` | NHIS / Ghana Card queue and private insurance queue. Eligibility, submit, remittance, deny. |
| Stores | `/care/stores` | Central consumable stock, issues to departments, goods received. |
| Procurement | `/care/procurement` | Purchase requests, mark ordered, receive into stores. |
| IT support | `/care/it` | Lock/unlock users, issue passwords, backups, and audit. Not full Admin. |
| Messages | `/care/messages` | Staff messages. |
| Shifts | `/care/shifts` | Roster and My shifts. |
| Admin | `/care/admin` | Admin only: overview, **user management** (roles and page permissions), services, patients, claims, inventory, HR, analytics/reports, audit, backups. |

Cash is collected only by the cashier. Admin can remove a bill but cannot take money. Clinical departments complete the work and send the patient to pay.

## Quick start

1. `npm run dev` and open http://localhost:5173/login
2. Sign in as `reception@clinic.local` / `Reception1!`
3. Open folder `A1/2026` or register a new patient, start a visit, bill or waive
4. Sign in as `nurse@clinic.local` / `NursePass1!` — save vitals, send to the doctor
5. Sign in as `doctor@clinic.local` / `DoctorPass1!` — consult and order work
6. Sign in as `cashier@clinic.local` / `Cashier1!` — receive payment and print or download the PDF receipt

## Project layout

```
frontend/              React + Vite staff app, hospital landing, and patient portal
frontend/public/hospital/  Landing-page photos
backend/               Express API, SQLite, auth, backups, email/SMS outbox
backend/data/          hospital.sqlite (created at runtime, gitignored)
Clinic-Management-System-Guide.docx  Full staff and operations guide
```
