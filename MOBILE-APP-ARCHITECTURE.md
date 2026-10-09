# Hala Mobile App Architecture

Branch: `hala-mobile`
Base: `hala-v6`

## Goal
Convert Hala from the current web flow into one mobile app for iOS and Android while keeping the existing Hala backend and invitation/WhatsApp logic.

## Mobile stack
- React Native + Expo SDK 57
- Expo Router
- Secure session storage with Expo SecureStore
- Existing Netlify Functions remain the backend initially

## Roles

### admin
Full platform access:
- Users and roles
- All events
- All supervisors
- Packages and pricing
- Templates
- WhatsApp status and failures
- Payments and refunds/status
- System analytics
- Suspend/reactivate accounts

### supervisor
Operational access assigned by admin:
- Assigned events only
- Guest lists
- RSVP status
- QR check-in
- WhatsApp invitation/send status
- Customer support notes
- No access to global pricing, platform settings, or other supervisors' events unless assigned

### customer
Event owner:
- Create invitation
- Select occasion-specific fields
- Choose/edit template
- Add/import guests
- Send one test invitation
- Purchase package
- Send invitations
- See delivered/read/failed status
- RSVP dashboard
- QR/check-in summary
- Edit own event only

## Important security change
The current website stores an event owner token in localStorage. Mobile requires account authentication and server-side authorization.

Required data model:
- users
  - id
  - name
  - phone/email
  - password_hash or external auth identity
  - role: admin | supervisor | customer
  - status
  - created_at
- event_members
  - event_id
  - user_id
  - permission/role
- sessions or signed JWT session tokens

Every protected API endpoint must validate:
1. session
2. user role
3. event ownership/assignment

UI role hiding alone is not sufficient.

## Mobile navigation

Public:
- Splash
- Welcome
- Login
- Register
- Forgot password

Customer:
- Home
- My events
- Create event
- Templates
- Event editor
- Guests
- WhatsApp sending
- RSVP
- QR
- Payments
- Profile

Supervisor:
- Operations home
- Assigned events
- Guest/RSVP management
- QR scanner
- WhatsApp delivery status
- Customer notes

Admin:
- Executive dashboard
- Users
- Supervisors
- Events
- Templates
- Packages/pricing
- Payments
- WhatsApp monitoring
- Settings

## Migration sequence
1. Introduce real authentication and RBAC on the backend.
2. Keep existing event, guest, RSVP, QR and WhatsApp endpoints and add account authorization.
3. Build customer mobile flow first.
4. Build supervisor workspace and QR scanner.
5. Build admin mobile dashboard.
6. Add push notifications and deep links.
7. Add store production configuration for iOS and Android.
8. Run end-to-end tests before App Store / Google Play submission.

## Product rule
Occasion schemas remain separate. Wedding/engagement can require two names where appropriate; activity invitations do not inherit wedding fields. Mobile must consume the same occasion schema source as the website so web and app stay consistent.
