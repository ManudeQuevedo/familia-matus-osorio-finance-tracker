-- If family_members is empty or used wrong profile IDs, force membership for your
-- auth users (UUIDs must match auth.users.id === profiles.id).
-- Family UUID must match the one used in family_group_migration / finance RLS.

INSERT INTO public.family_group (id, name)
VALUES (
  'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid,
  'Familia Matus Osorio'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_members (user_id, family_id)
VALUES
  (
    '1889611f-9728-4fcc-a59a-56f969131c38'::uuid,
    'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid
  ),
  (
    '48e6690d-0c6b-4d02-8ed8-ee6597a1ff63'::uuid,
    'b2c9f84e-3a1d-42f9-9c71-84e6fb5b2a91'::uuid
  )
ON CONFLICT (user_id, family_id) DO NOTHING;

-- Verify (run as admin in SQL editor):
-- SELECT * FROM family_members WHERE user_id IN (
--   '1889611f-9728-4fcc-a59a-56f969131c38',
--   '48e6690d-0c6b-4d02-8ed8-ee6597a1ff63'
-- );
