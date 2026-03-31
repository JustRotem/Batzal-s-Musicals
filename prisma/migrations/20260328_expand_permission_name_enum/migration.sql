-- Expand PermissionName enum with view/profile permissions used by the
-- permission bundle layer. Existing role behavior is preserved in code.
ALTER TYPE "PermissionName" ADD VALUE IF NOT EXISTS 'musical_view';
ALTER TYPE "PermissionName" ADD VALUE IF NOT EXISTS 'clip_view';
ALTER TYPE "PermissionName" ADD VALUE IF NOT EXISTS 'user_view';
ALTER TYPE "PermissionName" ADD VALUE IF NOT EXISTS 'profile_edit';
