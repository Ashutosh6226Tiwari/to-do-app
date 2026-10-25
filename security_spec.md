# FocusFlow Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **User Profile Ownership & Role Immutability (`/users/{uid}`)**:
   - Only `request.auth.uid == uid` can create or update `/users/{uid}`.
   - On creation, `role` MUST be `"user"` (users cannot self-assign `"admin"`).
   - On update, `role` MUST remain identical to `resource.data.role` (`incoming().role == existing().role`).
   - `xp` can never decrease (`incoming().xp >= existing().xp`) and can increase by at most `500` XP in a single write (`incoming().xp - existing().xp <= 500`), except during one-time initial document creation where `xp >= 0 && xp <= 50000`.
2. **Unique & Immutable Usernames (`/usernames/{usernameLower}`)**:
   - A username document can only be created if it does not already exist (`!exists(...)`) and `incoming().uid == request.auth.uid`.
   - Once created, a username cannot be overwritten or deleted (`allow update, delete: if false`).
3. **Friend Request & Friendship Privacy (`/friendRequests/{id}`, `/friendships/{id}`)**:
   - `friendRequests/{id}` can only be read (`get`, `list`) by `fromUid` or `toUid`.
   - `friendRequests/{id}` can only be created by `fromUid == request.auth.uid` with `status == 'pending'`.
   - `friendRequests/{id}` can only be updated by `toUid` (to `'accepted'` or `'declined'`) or deleted by `fromUid` or `toUid`.
   - `friendships/{id}` can only be read, created, or deleted if `request.auth.uid in resource.data.members` (or `request.auth.uid in incoming().members` on create) and `members.size() == 2`.
4. **Study Room Membership & Capacity (`/rooms/{code}`, `/rooms/{code}/members/{memberUid}`)**:
   - `rooms/{code}` enforces `maxMembers == 10` and `memberUids.size() <= 10`.
   - `rooms/{code}` and `/rooms/{code}/members/{memberUid}` are readable by authenticated room members (and authenticated users looking up a 6-character room code to join when `memberUids.size() < 10`).
   - Only `hostUid` can start/pause/reset the room timer (`startedAt`, `durationSec`, `mode`, `status`), while members can join/leave `memberUids` and update their own `/rooms/{code}/members/{memberUid}` status document.
5. **Admin-Only Audio Tracks (`/tracks/{id}`)**:
   - Any signed-in user can read `/tracks/{id}`.
   - Only admins (`get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'`) can create, update, or delete documents in `/tracks/{id}`.
6. **Private App State & Sessions (`/users/{uid}/private/{docId}`, `/users/{uid}/sessions/{sessionId}`)**:
   - Strictly readable and writable only by the owner (`request.auth.uid == uid`).

## 2. The "Dirty Dozen" Payloads (Rejected with `PERMISSION_DENIED`)
1. **Self-Privilege Escalation on Profile Create**: `POST /users/alice` with `{ role: "admin", ... }` -> Denied (`role == 'user'` required on create).
2. **Self-Privilege Escalation on Profile Update**: `PATCH /users/alice` with `{ role: "admin" }` -> Denied (`incoming().role == existing().role`).
3. **Excessive XP Injection (+10,000 XP in one write)**: `PATCH /users/alice` with `{ xp: existing.xp + 10000 }` -> Denied (`incoming().xp - existing().xp <= 500`).
4. **Negative XP Mutation**: `PATCH /users/alice` with `{ xp: existing.xp - 50 }` -> Denied (`incoming().xp >= existing().xp`).
5. **Cross-User Profile Overwrite**: `PATCH /users/bob` by `auth.uid = "alice"` -> Denied (`request.auth.uid == uid`).
6. **Username Hijacking / Overwrite**: `PUT /usernames/maya_lin` by `auth.uid = "mallory"` when `/usernames/maya_lin` already exists -> Denied (`allow update: if false`).
7. **Spoofed Username Claim**: `POST /usernames/bob_smith` by `auth.uid = "alice"` with `{ uid: "bob" }` -> Denied (`incoming().uid == request.auth.uid`).
8. **Unauthorized Friendship Snooping**: `GET /friendships/alice_bob` by `auth.uid = "mallory"` -> Denied (`request.auth.uid in resource.data.members`).
9. **Unauthorized Friend Request Spoofing**: `POST /friendRequests/req1` by `auth.uid = "mallory"` with `{ fromUid: "alice", toUid: "bob", status: "pending" }` -> Denied (`incoming().fromUid == request.auth.uid`).
10. **Room Capacity Overflow (>10 members)**: `PATCH /rooms/FLOW42` with 11 UIDs in `memberUids` -> Denied (`incoming().memberUids.size() <= 10`).
11. **Non-Admin Track Creation**: `POST /tracks/track1` by `auth.uid = "alice"` (where `users/alice.role == "user"`) -> Denied (`isAdmin()` required).
12. **Cross-User Private AppState Read**: `GET /users/alice/private/appState` by `auth.uid = "mallory"` -> Denied (`request.auth.uid == uid`).
