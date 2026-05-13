CREATE DATABASE IF NOT EXISTS wardrobe CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE wardrobe;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  external_id VARCHAR(191) NULL,
  email VARCHAR(191) NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  avatar_url TEXT NULL,
  onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_external_id (external_id)
);

CREATE TABLE IF NOT EXISTS wardrobes (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(64) NOT NULL,
  season ENUM('spring','summer','autumn','winter','all_season') NOT NULL DEFAULT 'all_season',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_wardrobes_user_id (user_id),
  CONSTRAINT fk_wardrobes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS taxonomy_groups (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  key_name VARCHAR(64) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_taxonomy_groups_user_key (user_id, key_name),
  KEY idx_taxonomy_groups_user_id (user_id),
  CONSTRAINT fk_taxonomy_groups_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  group_id CHAR(36) NOT NULL,
  key_name VARCHAR(64) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  parent_id CHAR(36) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_taxonomy_terms_user_group_key (user_id, group_id, key_name),
  KEY idx_taxonomy_terms_user_id (user_id),
  KEY idx_taxonomy_terms_group_id (group_id),
  KEY idx_taxonomy_terms_parent_id (parent_id),
  CONSTRAINT fk_taxonomy_terms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_taxonomy_terms_group FOREIGN KEY (group_id) REFERENCES taxonomy_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_taxonomy_terms_parent FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  wardrobe_id CHAR(36) NULL,
  type VARCHAR(64) NOT NULL,
  subtype VARCHAR(64) NULL,
  name VARCHAR(191) NULL,
  brand VARCHAR(191) NULL,
  notes TEXT NULL,
  purchase_date DATE NULL,
  purchase_price DECIMAL(10,2) NULL,
  favorite TINYINT(1) NOT NULL DEFAULT 0,
  image_path TEXT NOT NULL,
  thumbnail_path TEXT NULL,
  medium_path TEXT NULL,
  tags JSON NOT NULL,
  colors JSON NOT NULL,
  primary_color VARCHAR(64) NULL,
  status ENUM('processing','ready','error','archived') NOT NULL DEFAULT 'processing',
  ai_processed TINYINT(1) NOT NULL DEFAULT 0,
  ai_confidence DECIMAL(5,4) NULL,
  ai_description TEXT NULL,
  wear_count INT NOT NULL DEFAULT 0,
  last_worn_at DATETIME(3) NULL,
  last_suggested_at DATETIME(3) NULL,
  suggestion_count INT NOT NULL DEFAULT 0,
  acceptance_count INT NOT NULL DEFAULT 0,
  wears_since_wash INT NOT NULL DEFAULT 0,
  last_washed_at DATETIME(3) NULL,
  wash_interval INT NULL,
  needs_wash TINYINT(1) NOT NULL DEFAULT 0,
  effective_wash_interval INT NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME(3) NULL,
  archive_reason VARCHAR(191) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_items_user_id (user_id),
  KEY idx_items_wardrobe_id (wardrobe_id),
  KEY idx_items_type (type),
  KEY idx_items_status (status),
  CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_wardrobe FOREIGN KEY (wardrobe_id) REFERENCES wardrobes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS item_images (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  image_path TEXT NOT NULL,
  thumbnail_path TEXT NULL,
  medium_path TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_item_images_item_id (item_id),
  CONSTRAINT fk_item_images_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_taxonomy (
  item_id CHAR(36) NOT NULL,
  term_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (item_id, term_id),
  KEY idx_item_taxonomy_term_id (term_id),
  CONSTRAINT fk_item_taxonomy_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_taxonomy_term FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wash_history (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  washed_at DATETIME(3) NOT NULL,
  method VARCHAR(64) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_wash_history_item_id (item_id),
  CONSTRAINT fk_wash_history_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS outfits (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  occasion VARCHAR(64) NOT NULL,
  scheduled_for DATETIME(3) NOT NULL,
  status ENUM('pending','sent','viewed','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  source ENUM('scheduled','on_demand','manual','pairing') NOT NULL DEFAULT 'on_demand',
  reasoning TEXT NULL,
  style_notes TEXT NULL,
  highlights JSON NULL,
  weather JSON NULL,
  feedback JSON NULL,
  is_lookbook TINYINT(1) NOT NULL DEFAULT 0,
  cloned_from_outfit_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_outfits_user_id (user_id),
  KEY idx_outfits_scheduled_for (scheduled_for),
  CONSTRAINT fk_outfits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_outfits_cloned_from FOREIGN KEY (cloned_from_outfit_id) REFERENCES outfits(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS outfit_items (
  outfit_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  layer_type VARCHAR(64) NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, item_id),
  KEY idx_outfit_items_item_id (item_id),
  CONSTRAINT fk_outfit_items_outfit FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
  CONSTRAINT fk_outfit_items_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_type ENUM('item','outfit') NOT NULL,
  target_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_favorites_user_target (user_id, target_type, target_id),
  KEY idx_favorites_user_id (user_id),
  KEY idx_favorites_target (target_type, target_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS likes (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_type ENUM('item','outfit') NOT NULL,
  target_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_likes_user_target (user_id, target_type, target_id),
  KEY idx_likes_user_id (user_id),
  KEY idx_likes_target (target_type, target_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shares (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_type ENUM('item','outfit') NOT NULL,
  target_id CHAR(36) NOT NULL,
  share_code VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_shares_code (share_code),
  KEY idx_shares_user_id (user_id),
  CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memberships (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  tier ENUM('free','pro','premium') NOT NULL DEFAULT 'free',
  status ENUM('active','expired','canceled') NOT NULL DEFAULT 'active',
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_memberships_user_id (user_id),
  KEY idx_memberships_user_id (user_id),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fitting_photos (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  label VARCHAR(64) NULL,
  photo_type ENUM('full_body','half_body') NOT NULL DEFAULT 'full_body',
  image_path TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_fitting_photos_user_id (user_id),
  CONSTRAINT fk_fitting_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fitting_results (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  photo_id CHAR(36) NOT NULL,
  item_ids JSON NOT NULL,
  recommendation TEXT NULL,
  prompt TEXT NULL,
  preprocessed_image_path TEXT NULL,
  result_image_path TEXT NULL,
  weather JSON NULL,
  status ENUM('pending','generating','ready','error') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_fitting_results_user_id (user_id),
  KEY idx_fitting_results_photo_id (photo_id),
  CONSTRAINT fk_fitting_results_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fitting_results_photo FOREIGN KEY (photo_id) REFERENCES fitting_photos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recharge_records (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
  channel VARCHAR(32) NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  external_order_no VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_recharge_records_user_id (user_id),
  CONSTRAINT fk_recharge_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
