ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS role VARCHAR(12) NOT NULL DEFAULT 'user';

UPDATE app_users
SET role = 'user'
WHERE role IS NULL OR role = '';

ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_allowed CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS app_users_role_email
  ON app_users (role, LOWER(email));
