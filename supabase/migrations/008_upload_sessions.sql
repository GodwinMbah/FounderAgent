-- Upload sessions for multi-step wizard state persistence
-- Replaces in-memory Map with DB-backed temporary storage

CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  parsed_preview_json JSONB DEFAULT '{}',
  mapping_overrides_json JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_upload_sessions_company ON upload_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);

-- RLS: users can only access their own company's sessions
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_sessions_select" ON upload_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "upload_sessions_insert" ON upload_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "upload_sessions_update" ON upload_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "upload_sessions_delete" ON upload_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

-- Add pipeline stage tracking columns to uploads (first-class fields for progress polling)
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS total_rows INT,
  ADD COLUMN IF NOT EXISTS processed_rows INT,
  ADD COLUMN IF NOT EXISTS failed_rows INT,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_progress INT CHECK (pipeline_progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Index for polling uploads by stage
CREATE INDEX IF NOT EXISTS idx_uploads_pipeline_stage ON uploads(pipeline_stage) WHERE pipeline_stage IS NOT NULL;
