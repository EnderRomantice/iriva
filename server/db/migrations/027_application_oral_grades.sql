ALTER TABLE member_applications ADD COLUMN oral_grade TEXT NOT NULL DEFAULT '' CHECK(oral_grade IN ('','D','C','B','A','A+'));
ALTER TABLE member_applications ADD COLUMN oral_transcript TEXT NOT NULL DEFAULT '';
ALTER TABLE member_applications ADD COLUMN ai_audio_consent INTEGER NOT NULL DEFAULT 0 CHECK(ai_audio_consent IN (0,1));
-- Preserve historical numerical scores; the grade is the new display and review value.
UPDATE member_applications SET oral_grade=CASE WHEN oral_score>=90 THEN 'A+' WHEN oral_score>=80 THEN 'A' WHEN oral_score>=70 THEN 'B' WHEN oral_score>=60 THEN 'C' ELSE 'D' END WHERE oral_score IS NOT NULL;
