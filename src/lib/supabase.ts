import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ctpmfjcpwabvrtmuaiyw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cG1mamNwd2FidnJ0bXVhaXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODM3MjYsImV4cCI6MjEwNjI1OTcyNn0.hj_KyEKoPgxuixUW82sWn1IxFMiDfy-u9gPqLAdWD5A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
