-- Auto-named spaces read "<name>的家庭" (was "<name>的空间"). Only the generated suffix changes.
UPDATE households SET name = substr(name, 1, length(name) - 3) || '的家庭' WHERE name LIKE '%的空间';
UPDATE organizations SET name = substr(name, 1, length(name) - 3) || '的家庭' WHERE name LIKE '%的空间';
