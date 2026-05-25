-- ============================================================
-- 6. FIX RLS INFINITE RECURSION ON company_members
-- ============================================================
-- The SELECT policy on company_members was calling
-- get_user_company_ids(), which itself queries company_members,
-- causing infinite recursion.
--
-- Fix: Use a direct self-reference (user_id = auth.uid())
-- instead of the helper function.
-- ============================================================

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Members can view company members" ON company_members;

-- Create non-recursive SELECT policy: users can see their own memberships
CREATE POLICY "Members can view company members" ON company_members
  FOR SELECT USING (
    user_id = auth.uid() AND is_active = true
  );

-- The ALL (manage) policy uses a subquery on company_members.
-- After the SELECT policy fix above, this subquery can correctly
-- evaluate because the SELECT policy allows users to see their
-- own rows (which is what the subquery needs).
DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;
CREATE POLICY "Owners and admins can manage members" ON company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.is_active = true
    )
  );
