# KPI Pulse Backend Database Schema

This backend uses MongoDB through Mongoose. Auth and KPI screens should route through `/api/auth` and `/api/kpis`.

## Collections

### user

Required fields:
- `name`: string, 2-120 chars
- `email`: unique lowercase email
- `password`: bcrypt hash, minimum source password length 6
- `role`: `manager` or `staff`
- `department`: string, required

Optional/system fields:
- `bio`: string
- `isActive`: boolean
- `createdAt`, `updatedAt`: timestamps

### kpi

Required fields:
- `name`: string, 3-120 chars
- `description`: string
- `category`: string
- `weight`: number, 0-100
- `assignedTo`: `user._id`, must be active staff
- `createdBy`: `user._id`, manager who owns the KPI
- `target`: number, minimum 0
- `unit`: string
- `dueDate`: date

Controlled fields:
- `priority`: `low`, `medium`, `high`
- `status`: `pending`, `in-progress`, `submitted`, `approved`, `rejected`
- `progress`: number, 0-100
- `currentValue`: number
- `evidenceUrl`: stored file URL only; raw base64 is rejected by the API
- `evidenceMimeType`: PDF, image (JPG/PNG/WEBP), or common Office documents (DOC/DOCX/XLS/XLSX/PPT/PPTX)
- `evidenceSize`: max 5MB
- `isDeleted`, `deletedAt`, `deletedBy`: archival soft-delete fields
- `createdAt`, `updatedAt`: timestamps

### kpiHistory

Immutable audit events for KPI lifecycle changes.

Required fields:
- `kpi_id`: KPI reference
- `staffId`: assigned staff reference
- `actorId`: user who made the change
- `actorRole`: `manager` or `staff`
- `action`: `created`, `submitted`, `approved`, `rejected`, `soft-deleted`
- `name`, `status`, `target`: snapshot fields at change time

Optional snapshot fields:
- `value`
- `progress`
- `evidenceUrl`
- `evidenceName`
- `rejectionReason`
- `comment`
- `recordedAt`
 
### evidence

Stores individual evidence metadata records. Files themselves are referenced by URL or GridFS id; the service currently stores metadata and a path/URL.

Required/important fields:
- `kpi`: reference to `kpi._id`
- `uploadedBy`: reference to `user._id`
- `name`: original filename
- `url`: stored path or public URL
- `mimeType`: file MIME type
- `size`: file size in bytes
- `storage`: one of `url`, `gridfs`, or `external`
- `createdAt`: timestamp

## Server-side Rules

- Staff can only read and submit KPIs assigned to them.
- Managers can only list, review, and archive KPIs they created.
- Managers can only assign KPIs to active staff in the same department when both users have departments.
- Submitted KPIs can be approved or rejected by the owning manager only.
- Approved KPIs cannot be resubmitted.
- Deletes are soft deletes; KPI records are archived and audit history is retained.
