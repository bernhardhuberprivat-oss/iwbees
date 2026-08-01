CREATE TABLE IF NOT EXISTS annual_harvest (
  user_id INTEGER NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  kg NUMERIC,
  PRIMARY KEY (user_id, year)
);
