-- =====================================================================
-- Fertiliser Traceability System - Database Schema
-- Enhancing Accountability in Fertiliser Distribution Through Digital
-- Traceability: A Case Study of Kenya's National Fertiliser Subsidy Programme
--
-- NOTE: All tables for the FULL project are created here, even ones that
-- Week 2 and Week 3 modules will use. Designing the whole schema up front
-- avoids painful database changes (migrations) mid-project.
-- =====================================================================

-- Create the database and switch to it.
CREATE DATABASE IF NOT EXISTS fertiliser_traceability
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fertiliser_traceability;

-- Drop tables in reverse-dependency order so re-running this file is safe.
-- (Child tables that hold foreign keys are dropped before their parents.)
DROP TABLE IF EXISTS recall_records;
DROP TABLE IF EXISTS custody_log;
DROP TABLE IF EXISTS distribution_records;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS stock_holdings;
DROP TABLE IF EXISTS qr_codes;
DROP TABLE IF EXISTS fertiliser_stock;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- USERS
-- One row per system user. The `role` column drives what each user is
-- allowed to do (enforced in the backend by role-checking middleware).
-- These four roles come directly from your conceptual framework.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL UNIQUE,
  -- We NEVER store raw passwords. This holds a bcrypt hash.
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('national_supplier',
                     'depot_manager',
                     'cooperative_official',
                     'system_administrator') NOT NULL,
  depot_scope   VARCHAR(80)   NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  token_version INT           NOT NULL DEFAULT 0,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMP NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- PASSWORD_RESET_TOKENS
-- Stores one-time self-service password reset tokens. The raw token is
-- never persisted; only its SHA-256 hash is stored for verification.
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT       NOT NULL,
  token_hash CHAR(64)  NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- FERTILISER_STOCK
-- The core record. Every physical batch of fertiliser becomes one row.
-- `current_holder_id` tells us WHO currently holds the stock, so we can
-- show "where is this batch now" without scanning the whole custody log.
-- `status` tracks the lifecycle of the batch through the supply chain.
-- ---------------------------------------------------------------------
CREATE TABLE fertiliser_stock (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  batch_number          VARCHAR(80)  NOT NULL UNIQUE,
  fertiliser_type       VARCHAR(120) NOT NULL,
  quantity              INT          NOT NULL,        -- number of bags
  manufacture_date      DATE         NOT NULL,
  expiry_date           DATE         NOT NULL,
  source                VARCHAR(160) NOT NULL,        -- e.g. national supplier name
  destination           VARCHAR(160) NOT NULL,        -- intended next point
  responsible_personnel VARCHAR(160) NOT NULL,
  -- The lifecycle status. Starts at 'registered' when first created.
  status                ENUM('registered',
                            'in_transit',
                            'received',
                            'expired',
                            'recalled') NOT NULL DEFAULT 'registered',
  -- Who physically holds the stock right now (FK to users).
  current_holder_id     INT          NULL,
  -- Who created the record (the registering supplier).
  created_by            INT          NOT NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_archived           BOOLEAN      NOT NULL DEFAULT FALSE,
  archived_at           TIMESTAMP    NULL,
  archived_by           INT          NULL,

  CONSTRAINT fk_stock_holder
    FOREIGN KEY (current_holder_id) REFERENCES users(id),
  CONSTRAINT fk_stock_creator
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_stock_archiver
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- QR_CODES
-- One QR code per stock batch. `qr_payload` is the unique string encoded
-- inside the QR image (what a scanner reads). `qr_image_path` points to
-- the saved PNG on disk so the frontend can display/download it.
-- ---------------------------------------------------------------------
CREATE TABLE qr_codes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  stock_id      INT          NOT NULL,
  qr_payload    VARCHAR(255) NOT NULL UNIQUE,   -- the unique identifier encoded
  qr_image_path VARCHAR(255) NOT NULL,          -- file location of the PNG
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_qr_stock
    FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- STOCK_HOLDINGS
-- Tracks how many bags of each batch each user physically holds. This is
-- what allows partial dispatch: a supplier can send 20 bags and keep 80.
-- The original batch quantity remains in fertiliser_stock.quantity.
-- ---------------------------------------------------------------------
CREATE TABLE stock_holdings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  stock_id   INT       NOT NULL,
  user_id    INT       NOT NULL,
  quantity   INT       NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_stock_holding_user UNIQUE (stock_id, user_id),
  CONSTRAINT fk_holding_stock FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id),
  CONSTRAINT fk_holding_user  FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- TRANSFERS  (used in Week 2: scan-based transfer verification)
-- One row per dispatch/receive movement of a batch between two users.
-- ---------------------------------------------------------------------
CREATE TABLE transfers (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  stock_id           INT          NOT NULL,
  from_user_id       INT          NOT NULL,
  to_user_id         INT          NULL,        -- may be null until received
  quantity           INT          NOT NULL,    -- number of bags moved
  dispatched_at      TIMESTAMP    NULL,
  received_at        TIMESTAMP    NULL,
  delivery_condition VARCHAR(160) NULL,        -- e.g. 'good', 'damaged'
  status             ENUM('dispatched','received','rejected')
                       NOT NULL DEFAULT 'dispatched',

  CONSTRAINT fk_transfer_stock FOREIGN KEY (stock_id)     REFERENCES fertiliser_stock(id),
  CONSTRAINT fk_transfer_from  FOREIGN KEY (from_user_id) REFERENCES users(id),
  CONSTRAINT fk_transfer_to    FOREIGN KEY (to_user_id)   REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- DISTRIBUTION_RECORDS
-- Cooperative officials issue stock onward without registering farmers.
-- This records final-mile issue/distribution evidence while staying within
-- the project scope, which excludes farmer registration and payments.
-- ---------------------------------------------------------------------
CREATE TABLE distribution_records (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  stock_id             INT          NOT NULL,
  cooperative_user_id  INT          NOT NULL,
  recipient_name       VARCHAR(160) NOT NULL,
  recipient_identifier VARCHAR(120) NULL,
  location             VARCHAR(160) NULL,
  quantity             INT          NOT NULL,
  notes                VARCHAR(255) NULL,
  issued_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_distribution_stock FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id),
  CONSTRAINT fk_distribution_user  FOREIGN KEY (cooperative_user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- CUSTODY_LOG  (append-only chain-of-custody)
-- Write ONE row on every meaningful event (register, dispatch, receive,
-- recall...). We never UPDATE or DELETE rows here - this gives a tamper-
-- evident audit trail, which is the whole point of "accountability".
-- ---------------------------------------------------------------------
CREATE TABLE custody_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  stock_id   INT          NOT NULL,
  user_id    INT          NOT NULL,      -- who performed the action
  action     VARCHAR(60)  NOT NULL,      -- 'registered','dispatched',...
  notes      VARCHAR(255) NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_custody_stock FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id),
  CONSTRAINT fk_custody_user  FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- RECALL_RECORDS  (used in Week 3: expiry & recall management)
-- ---------------------------------------------------------------------
CREATE TABLE recall_records (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  stock_id          INT          NOT NULL,
  reason            VARCHAR(255) NOT NULL,
  flagged_by        INT          NOT NULL,
  flagged_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status            ENUM('pending','in_review','resolved','rejected')
                    NOT NULL DEFAULT 'pending',
  status_notes      VARCHAR(255) NULL,
  status_updated_by INT          NULL,
  status_updated_at TIMESTAMP    NULL,

  CONSTRAINT fk_recall_stock       FOREIGN KEY (stock_id)          REFERENCES fertiliser_stock(id),
  CONSTRAINT fk_recall_user        FOREIGN KEY (flagged_by)        REFERENCES users(id),
  CONSTRAINT fk_recall_status_user FOREIGN KEY (status_updated_by) REFERENCES users(id)
);

-- Helpful indexes for the queries we will run most often.
CREATE INDEX idx_stock_status        ON fertiliser_stock(status);
CREATE INDEX idx_stock_holder        ON fertiliser_stock(current_holder_id);
CREATE INDEX idx_stock_archived      ON fertiliser_stock(is_archived);
CREATE INDEX idx_users_depot_scope   ON users(role, depot_scope);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_holdings_user       ON stock_holdings(user_id);
CREATE INDEX idx_holdings_stock      ON stock_holdings(stock_id);
CREATE INDEX idx_custody_stock       ON custody_log(stock_id);
CREATE INDEX idx_recall_status       ON recall_records(status);
CREATE INDEX idx_transfers_stock     ON transfers(stock_id);
CREATE INDEX idx_distributions_stock ON distribution_records(stock_id);
CREATE INDEX idx_distributions_user  ON distribution_records(cooperative_user_id);
