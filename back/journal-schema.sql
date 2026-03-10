CREATE TABLE IF NOT EXISTS journal_entries (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  template_type ENUM('notes', 'weekly', 'goals') NOT NULL,
  topic VARCHAR(255) NOT NULL,
  content LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_journal_entries_user_template (user_id, template_type),
  CONSTRAINT fk_journal_entries_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_entry_items (
  id INT NOT NULL AUTO_INCREMENT,
  entry_id INT NOT NULL,
  item_text VARCHAR(500) NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_journal_entry_items_entry (entry_id, sort_order),
  CONSTRAINT fk_journal_entry_items_entry
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
    ON DELETE CASCADE
);
