-- Contact messages are inserted by the server (service role bypasses RLS), so the open public insert policy is not needed
-- and only lets anyone with the public anon key spam the table directly.
drop policy if exists "public contact insert" on contact_messages;

-- Length limits at the database level too.
alter table contact_messages drop constraint if exists contact_messages_len;
alter table contact_messages add constraint contact_messages_len
  check (char_length(name) <= 100 and char_length(email) <= 200 and char_length(message) <= 3000) not valid;

-- Only one admin level exists in practice (is_admin() treats every row the same), so make that explicit.
update admin_profiles set role = 'admin' where role <> 'admin';
alter table admin_profiles drop constraint if exists admin_profiles_role_check;
alter table admin_profiles add constraint admin_profiles_role_check check (role = 'admin');
