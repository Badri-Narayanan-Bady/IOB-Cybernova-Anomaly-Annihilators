import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://nbcnavnwhyfymnkswgxm.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iY25hdm53aHlmeW1ua3N3Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDE1NTQsImV4cCI6MjA2MDM3NzU1NH0.B93Uhs9Z1K_0QUCNmuJKGMpMfIvJPT21GgZjKCltbAM"
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iY25hdm53aHlmeW1ua3N3Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgwMTU1NCwiZXhwIjoyMDYwMzc3NTU0fQ.8W__LRt5EHT_zw0AfuqjHRXMTog8iZ-yvYT5Sl65OCM"

// Create a Supabase client with the anon key for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a Supabase client with the service role key for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to get the current user
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Helper function to get user profile data
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from("users").select("*").eq("user_id", userId).single()

  if (error) throw error
  return data
}
