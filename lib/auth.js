import { supabase } from './supabase.js'

export async function authenticateUser(req) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'No token provided' }
    }

    const token = authHeader.substring(7)
    
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: 'Invalid token' }
    }

    return { user, error: null }
    
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

// Remove corsHeaders function since Vercel handles CORS via vercel.json