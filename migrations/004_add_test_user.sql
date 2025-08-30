INSERT INTO users (id, neon_user_id, email, display_name, household_size, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'test-user-123', 'test@example.com', 'Test User', 4, NOW(), NOW())
ON CONFLICT (neon_user_id) DO NOTHING;
