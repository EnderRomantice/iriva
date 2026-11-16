-- Auto-named spaces read "<name>的家庭" (was "<name>的空间"). Only the generated suffix changes.
UPDATE iriva.households SET name = left(name, char_length(name) - 3) || '的家庭' WHERE name LIKE '%的空间';
UPDATE iriva.organizations SET name = left(name, char_length(name) - 3) || '的家庭' WHERE name LIKE '%的空间';
