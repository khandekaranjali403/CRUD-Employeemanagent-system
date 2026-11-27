CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(80) NOT NULL,
  department VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  location VARCHAR(80) NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employees_owner_email (owner_id, email),
  KEY ix_employees_owner_created (owner_id, created_at),
  CONSTRAINT fk_employees_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
