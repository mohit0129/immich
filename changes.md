# Immich Full Changes & Feature Documentation

This document provides a comprehensive overview of all enhancements, features, bug fixes, and file modifications made to the Immich project across `server/`, `web/`, `mobile/`, and `open-api/`.

---

## Table of Contents
1. [Themed & Pattern-Based Memories (AI & Time-Based Collections)](#1-themed--pattern-based-memories)
2. [Notification System & Real-Time Sync](#2-notification-system--real-time-sync)
3. [People & Pets Album Sharing with Host Approval](#3-people--pets-album-sharing-with-host-approval)
4. [User Storage Quota Adjustments](#4-user-storage-quota-adjustments)
5. [Authorized Devices & Accurate Timestamps](#5-authorized-devices--accurate-timestamps)
6. [PIN Code Security: 4-Digit & 6-Digit Support](#6-pin-code-security-4-digit--6-digit-support)
7. [Interactive Map Enhancements](#7-interactive-map-enhancements)
8. [Timeline Scrubber & Virtual Scroll Optimization](#8-timeline-scrubber--virtual-scroll-optimization)
9. [Admin Panel Polish: Search Bar Clean-up](#9-admin-panel-polish-search-bar-clean-up)
10. [Mobile Stability & Type Cast Fixes](#10-mobile-stability--type-cast-fixes)
11. [Complete File Changes Index](#11-complete-file-changes-index)

---

## 1. Themed & Pattern-Based Memories

### Overview
Extended the memory system beyond "On This Day" and "Birthday" to support 12 rich memory categories while preserving 100% backwards compatibility with existing memories.

### Categories Implemented:
1. **Time-Based Lookbacks & Highlights**:
   - `thisWeekLastYear`: Matches photos taken during this exact calendar week in prior years.
   - `recentHighlights`: Curates the best shots from the past 14 days.
   - `seasonSummary`: End-of-season roundups (Summer, Winter, Spring, Autumn).
   - `milestoneAnniversary`: Milestone events matching 1, 5, 10-year timelines.
2. **Themed & Pattern-Based Collections**:
   - `peoplePetGrowth`: Tracks a child, person, or pet across years showing their growth.
   - `tripEvent`: Geographically clustered and time-bounded trips/vacations with location tags.
   - `visualPattern`: AI-curated themes based on shared color palettes, scenes, or recurring objects.
   - `holidayCelebration`: Cultural moments and celebrations (Christmas, New Year, Diwali, etc.).
3. **Automated Creations**:
   - `cinematicMoments`: 3D/motion photos animated from live photos or frame bursts.
   - `remixCollage`: Action bursts, photo-booth strips, and stylized collages.
   - `stylizedPhoto`: Standout edits, color pops, and dynamic visual styling.
4. **Collaborative Memories**:
   - `collaborative`: Joint moments generated from shared albums contributed by multiple members.

### Key Files Changed:
- `server/src/enum.ts`: Added enum definitions for `MemoryType`.
- `server/src/dtos/memory.dto.ts`: Added schema definitions for extended memory data (`title`, `subtitle`, `season`, `yearsSpan`, `patternType`, `holidayName`, `style`, `effect`, `albumName`, etc.).
- `server/src/services/memory.service.ts`: Implemented generation routines for each memory type, ensuring all memories are assigned a default `year: target.year` to guarantee client compatibility.
- `server/src/repositories/memory.repository.ts`: Added asset discovery queries for lookbacks, seasons, bursts, live photos, and location-clustered trips.
- `web/src/lib/components/memories/MemoryCard.svelte`: Added icons (`mdiMapMarker`, `mdiCalendarSync`, `mdiPartyPopper`, `mdiAccountGroup`, `mdiPalette`, `mdiFilmstrip`) and titles for each memory category.
- `web/src/routes/(user)/memories/[id]/[[photos=photos]]/[[assetId=id]]/MemoryViewer.svelte`: Added memory category badges and interactive viewers.

---

## 2. Notification System & Real-Time Sync

### Overview
Built a notification center in the web app and backend to handle both individual and broadcast notifications, separating general system alerts from activity/updates, with live unread counter synchronization.

### What Was Fixed / Added:
- **Live Unread Counter**: Fixed issue where the notification badge still displayed unread counts even after clicking "Mark as read". Unread queries now invalidate and synchronize cache states immediately.
- **Admin Broadcasting**: Added ability for server administrators to send notifications to individual users or broadcast to all users simultaneously.
- **Dedicated Notification Center**: Added `/notifications` and `/admin/notifications` routes.

### Key Files Changed:
- `server/src/controllers/notification-admin.controller.ts`: Added `getNotificationsAdmin`, `createNotification` (with `allUsers` flag), and `deleteNotificationAdmin`.
- `server/src/services/notification-admin.service.ts`: Implemented notification delivery to single users or all active users.
- `server/src/dtos/notification.dto.ts`: Added `allUsers` and `userIds` support.
- `web/src/lib/components/shared-components/navigation-bar/NavigationBar.svelte`: Added interactive notification bell button with unread count pill badge.
- `web/src/lib/components/shared-components/navigation-bar/NotificationPanel.svelte`: Added flyout panel with "Mark all as read" button and tabbed views.
- `web/src/lib/queries/notification.query.ts`: Implemented query mutations for single read and bulk read with cache invalidation.
- `web/src/routes/(user)/notifications/+page.svelte` & `+page.ts`: Full-screen notification history view.
- `web/src/routes/admin/notifications/+page.svelte` & `+page.ts`: Admin notification dashboard with modal to broadcast messages.
- `web/src/lib/modals/SendNotificationModal.svelte`: Modal for creating and dispatching notifications.

---

## 3. People & Pets Album Sharing with Host Approval

### Overview
Fixed `POST /api/shared-links 400 (Bad Request)` when attempting to share People & Pets albums, and introduced an approval workflow for shared links.

### What Was Fixed / Added:
- **400 Bad Request Fix**: When creating a shared link for people or individual photo selections without a pre-existing album, the backend previously failed validation if both `albumId` and `assetIds` were omitted or mismatched. The controller and service now properly distinguish individual link types and allow passing asset IDs directly.
- **Host Approval ("Require approval to view")**:
  - Added a switch to link creation/edit forms.
  - Links flagged with approval require visitors to submit their name before accessing photos, tagged via `[APPROVAL_REQUIRED]`.

### Key Files Changed:
- `server/src/controllers/shared-link.controller.ts`: Allowed creating individual links with explicit asset list validation.
- `server/src/services/shared-link.service.ts`: Corrected validation requirements for asset IDs and album IDs.
- `web/src/lib/components/SharedLinkFormFields.svelte`: Added "Require approval to view" toggle, "Never expire" option, and streamlined password field.
- `web/src/lib/modals/SharedLinkCreateModal.svelte`: Correctly sets `assetIds` when sharing from people and pets views and appends `[APPROVAL_REQUIRED]` metadata.
- `web/src/routes/(user)/people/[personId]/[[photos=photos]]/[[assetId=id]]/+page.svelte`: Wired album sharing button to pass person assets to the link modal.

---

## 4. User Storage Quota Adjustments

### Overview
Resolved runtime crash when clicking "Adjust Quota" in the admin user management panel:
`Uncaught (in promise) Error: No QueryClient was found in Svelte context. Did you forget to wrap your component with QueryClientProvider?`

### What Was Fixed / Added:
- Created and wrapped `AdjustQuotaModal.svelte` with `QueryClientProvider` context so TanStack Query operations succeed when opened from dynamic modal overlays.
- Connected the modal to backend `user-admin.service.ts` to persist quota adjustments cleanly.

### Key Files Changed:
- `web/src/lib/modals/AdjustQuotaModal.svelte`: Component wrapped with query client provider context for adjusting quota limits.
- `web/src/routes/admin/users/(list)/+layout.svelte`: Added quota adjustment button and modal trigger.
- `web/src/lib/services/user-admin.service.ts`: Added quota mutation handler.
- `server/src/services/user-admin.service.ts`: Enabled updating user quota limits without touching password or storage labels.

---

## 5. Authorized Devices & Accurate Timestamps

### Overview
In User Settings -> Authorized Devices, sessions only displayed the creation date (e.g. "Signed in 8 days ago") even when active 5 minutes ago, and lacked details like device brand, model, client version, and IP location.

### What Was Fixed / Added:
- Extracted and displayed device model, client OS, app version (`vX.Y.Z`), and IP geolocation from user-agent and session data.
- Added dynamic relative timestamps:
  - **Last Seen**: Relative `"Active X minutes ago"` (or `"Just now"` / `"X hours ago"`) alongside full localized timestamp.
  - **First Signed In**: Displayed separately with creation date.
- Added "Current Device" badge and session revocation button with confirmation.

### Key Files Changed:
- `web/src/lib/components/user-settings-page/DeviceCard.svelte`: Completely redesigned device card with relative timestamp calculation, icons for Android, iOS, Windows, macOS, Linux, Chrome, and location tag.
- `server/src/utils/request.ts`: Enhanced user-agent parser to extract device brand, OS, and client version.

---

## 6. PIN Code Security: 4-Digit & 6-Digit Support

### Overview
Immich previously only permitted 6-digit PIN codes (`^\d{6}$`). Added support for 4-digit PIN codes as an option for users who prefer quicker unlocking.

### What Was Fixed / Added:
- Updated server regex validation to accept both 4-digit and 6-digit PIN codes (`/^(?:\d{4}|\d{6})$/`).
- Updated web PIN setup form with a toggle between 4-digit and 6-digit PINs.
- Updated authentication PIN prompts to handle 4 or 6 digit input dynamically.

### Key Files Changed:
- `server/src/dtos/auth.dto.ts`: Updated regex on `pinCode` fields to `/^(?:\d{4}|\d{6})$/`.
- `server/src/dtos/user.dto.ts`: Updated regex for admin user creation and update DTOs.
- `web/src/lib/components/user-settings-page/PinCodeCreateForm.svelte`: Added radio/toggle for 4-digit or 6-digit length with dynamic input sizing.
- `web/src/routes/auth/pin-prompt/+page.svelte`: Added dynamic length handling for unlocking.

---

## 7. Interactive Map Enhancements

### Overview
Enhanced the interactive map view on web to improve navigation of dense photo concentrations.

### What Was Fixed / Added:
- **Cluster Count Badges**: Added `ClusterMapMarker.svelte` with animated zoom-on-click and photo count badges.
- **Photo Thumbnails as Map Markers**: Added `PhotoMapMarker.svelte` to render high-resolution thumbnails as pins on the map rather than generic icons.
- **Cluster Radius Tuning**: Adjusted cluster radius from 35px to 45px for cleaner distribution.

### Key Files Changed:
- `web/src/lib/components/shared-components/map/Map.svelte`: Integrated `ClusterMapMarker` and `PhotoMapMarker`.
- `web/src/lib/components/shared-components/map/ClusterMapMarker.svelte`: New component for cluster counts.
- `web/src/lib/components/shared-components/map/PhotoMapMarker.svelte`: New component for thumbnail pins.

---

## 8. Timeline Scrubber & Virtual Scroll Optimization

### Overview
Optimized timeline scrolling for large libraries with hundreds of thousands of assets.

### What Was Fixed / Added:
- **Granular Navigation**: Added day, month, and year navigation granularity options to the timeline scrubber.
- **Virtual Scroll Optimization**: Tuned window buffer sizes in `VirtualScrollManager` to prevent blank spaces during rapid scrolling.

### Key Files Changed:
- `web/src/lib/components/timeline/Scrubber.svelte`: Added `timeGranularity` (`day`, `month`, `year`) and smooth distance thresholds.
- `web/src/lib/components/timeline/Timeline.svelte`: Connected scrubber granularity to layout segments.
- `web/src/lib/managers/VirtualScrollManager/VirtualScrollManager.svelte.ts`: Reduced render stutter and improved item recycling.

---

## 9. Admin Panel Polish: Search Bar Clean-up

### Overview
Removed the redundant "Search your photos" search bar from the top navigation bar when viewing the admin panel.

### Key Files Changed:
- `web/src/lib/components/layouts/AdminPageLayout.svelte`: Hid the photos search bar when within `/admin/*` routes.

---

## 10. Mobile Stability & Type Cast Fixes

### Overview
Resolved a runtime crash in the Flutter mobile app when navigating to the **Photos** section:
`type 'Null' is not a subtype of type 'int' in type cast`

### What Was Fixed:
- When deserializing memory records from the server, `map['year'] as int` was being called. Since newly generated memory themes did not always populate `year`, this cast threw an exception.
- Made `year` parsing null-safe with a fallback: `(map['year'] as int?) ?? DateTime.now().year`.
- Rebuilt debug APK (`mobile/build/app/outputs/flutter-apk/app-debug.apk`) with zero errors.

### Key Files Changed:
- `mobile/lib/domain/models/memory.model.dart`: Replaced unsafe `as int` with safe null-coalescing.
- `mobile/lib/infrastructure/repositories/sync_stream.repository.dart`: Added wildcard case to enum switch mapping.

---

## 11. Complete File Changes Index

Below is the list of all files modified, added, or created:

| Directory | File | Type | Description |
|---|---|---|---|
| `server/src/` | `app.module.ts` | Modified | Registered notification controllers & providers |
| `server/src/` | `database.ts` | Modified | Updated database query schema bindings |
| `server/src/` | `enum.ts` | Modified | Added 12 new `MemoryType` enum values |
| `server/src/` | `types.ts` | Modified | Added notification and memory payload types |
| `server/src/controllers/` | `notification-admin.controller.ts` | Modified | Admin endpoints for all-user notifications |
| `server/src/controllers/` | `shared-link.controller.ts` | Modified | Individual asset list and approval link fixes |
| `server/src/controllers/` | `user-admin.controller.ts` | Modified | Added quota and status update handling |
| `server/src/dtos/` | `auth.dto.ts` | Modified | 4-digit and 6-digit PIN regex validation |
| `server/src/dtos/` | `memory.dto.ts` | Modified | Extended `MemoryDataDto` with custom metadata |
| `server/src/dtos/` | `notification.dto.ts` | Modified | Added broadcast and multiple user IDs |
| `server/src/dtos/` | `user.dto.ts` | Modified | Added 4-digit PIN regex to user administration |
| `server/src/repositories/` | `memory.repository.ts` | Modified | Queries for lookback, seasonal, and cluster memories |
| `server/src/repositories/` | `notification.repository.ts` | Modified | Added batch creation and admin queries |
| `server/src/services/` | `memory.service.ts` | Modified | Memory generation logic for all 12 categories |
| `server/src/services/` | `notification-admin.service.ts` | Modified | Admin broadcast and user notification handling |
| `server/src/services/` | `shared-link.service.ts` | Modified | Fixed 400 Bad Request on people/pets links |
| `server/src/services/` | `user-admin.service.ts` | Modified | Quota update without resetting other fields |
| `server/src/utils/` | `request.ts` | Modified | User-agent parsing for brand, OS, and client version |
| `open-api/` | `immich-openapi-specs.json` | Modified | OpenAPI 3.0 specification regenerated |
| `packages/sdk/src/` | `fetch-client.ts` | Modified | TypeScript client SDK regenerated |
| `mobile/lib/domain/models/` | `memory.model.dart` | Modified | Null-safe `year` parsing fix |
| `mobile/lib/infrastructure/repositories/` | `sync_stream.repository.dart` | Modified | Wildcard pattern match on `MemoryType` |
| `web/src/` | `app.css` | Modified | Custom styling for badges and notifications |
| `web/src/` | `vite.config.ts` | Modified | Configured proxy and client settings |
| `web/src/lib/components/` | `SharedLinkFormFields.svelte` | Modified | Approval switch, expiration, password UI |
| `web/src/lib/components/album-page/` | `AlbumViewer.svelte` | Modified | Album sharing approval support |
| `web/src/lib/components/layouts/` | `AdminPageLayout.svelte` | Modified | Removed photo search bar from admin views |
| `web/src/lib/components/memories/` | `MemoryCard.svelte` | Modified | Icons and titles for all memory themes |
| `web/src/lib/components/pages/` | `SharedLinkPage.svelte` | Modified | Host approval view before accessing link |
| `web/src/lib/components/shared-components/map/` | `ClusterMapMarker.svelte` | **Added** | Map cluster counter pin component |
| `web/src/lib/components/shared-components/map/` | `PhotoMapMarker.svelte` | **Added** | Thumbnail photo marker component |
| `web/src/lib/components/shared-components/map/` | `Map.svelte` | Modified | Clustered marker rendering integration |
| `web/src/lib/components/shared-components/navigation-bar/` | `NavigationBar.svelte` | Modified | Notification bell with unread counter |
| `web/src/lib/components/shared-components/navigation-bar/` | `NotificationPanel.svelte` | Modified | Flyout notification drawer |
| `web/src/lib/components/timeline/` | `Scrubber.svelte` | Modified | Granular day/month/year navigation |
| `web/src/lib/components/timeline/` | `Timeline.svelte` | Modified | Scrubber integration with virtual scrolling |
| `web/src/lib/components/user-settings-page/` | `DeviceCard.svelte` | Modified | Device OS, version, location, relative times |
| `web/src/lib/components/user-settings-page/` | `PinCodeCreateForm.svelte` | Modified | 4-digit / 6-digit PIN selection |
| `web/src/lib/managers/VirtualScrollManager/` | `VirtualScrollManager.svelte.ts` | Modified | Viewport calculation optimizations |
| `web/src/lib/modals/` | `AdjustQuotaModal.svelte` | **Added** | Quota modal with QueryClientProvider fix |
| `web/src/lib/modals/` | `SendNotificationModal.svelte` | **Added** | Admin broadcast notification modal |
| `web/src/lib/modals/` | `SharedLinkCreateModal.svelte` | Modified | People and pets shared link creation |
| `web/src/lib/queries/` | `notification.query.ts` | Modified | Notification list & unread count queries |
| `web/src/routes/(user)/notifications/` | `+page.svelte` & `+page.ts` | **Added** | User notification center |
| `web/src/routes/admin/notifications/` | `+page.svelte` & `+page.ts` | **Added** | Admin notification management dashboard |
| `web/src/routes/admin/users/(list)/` | `+layout.svelte` | Modified | Added Adjust Quota button to user cards |
| `web/src/routes/auth/pin-prompt/` | `+page.svelte` | Modified | Supports 4-digit and 6-digit PIN unlocking |
| `i18n/` | `en.json` (and all locales) | Modified | Added translations for all new features |
