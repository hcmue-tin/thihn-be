-- Add session-based contest isolation for soft reset history.
-- Safe to run on MySQL 8+.

ALTER TABLE `answers`
  ADD COLUMN IF NOT EXISTS `session_id` INT NOT NULL DEFAULT 1 AFTER `exam_set_id`;

ALTER TABLE `contest_state`
  ADD COLUMN IF NOT EXISTS `current_session_id` INT NOT NULL DEFAULT 1 AFTER `current_question_id`;

-- Drop old unique key on (contestant_id, question_id) if present.
SET @old_unique_idx := (
  SELECT s.index_name
  FROM information_schema.statistics s
  WHERE s.table_schema = DATABASE()
    AND s.table_name = 'answers'
    AND s.non_unique = 0
  GROUP BY s.index_name
  HAVING COUNT(*) = 2
     AND SUM(CASE WHEN s.column_name = 'contestant_id' THEN 1 ELSE 0 END) = 1
     AND SUM(CASE WHEN s.column_name = 'question_id' THEN 1 ELSE 0 END) = 1
  LIMIT 1
);

SET @drop_old_unique_sql := IF(
  @old_unique_idx IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `answers` DROP INDEX `', @old_unique_idx, '`')
);
PREPARE stmt FROM @drop_old_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure index on session_id exists.
SET @session_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics s
  WHERE s.table_schema = DATABASE()
    AND s.table_name = 'answers'
    AND s.index_name = 'IDX_answers_session_id'
);

SET @add_session_idx_sql := IF(
  @session_idx_exists = 0,
  'ALTER TABLE `answers` ADD INDEX `IDX_answers_session_id` (`session_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @add_session_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure unique key on (contestant_id, question_id, session_id) exists.
SET @new_unique_exists := (
  SELECT COUNT(*)
  FROM (
    SELECT s.index_name
    FROM information_schema.statistics s
    WHERE s.table_schema = DATABASE()
      AND s.table_name = 'answers'
      AND s.non_unique = 0
    GROUP BY s.index_name
    HAVING COUNT(*) = 3
       AND SUM(CASE WHEN s.column_name = 'contestant_id' THEN 1 ELSE 0 END) = 1
       AND SUM(CASE WHEN s.column_name = 'question_id' THEN 1 ELSE 0 END) = 1
       AND SUM(CASE WHEN s.column_name = 'session_id' THEN 1 ELSE 0 END) = 1
  ) t
);

SET @add_new_unique_sql := IF(
  @new_unique_exists = 0,
  'ALTER TABLE `answers` ADD UNIQUE KEY `UQ_answers_contestant_question_session` (`contestant_id`, `question_id`, `session_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @add_new_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
