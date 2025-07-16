// api/auth/signup.js
import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).json({})
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // Create user with Supabase Auth with email confirmation
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Redirect to your callback endpoint, not frontend
        emailRedirectTo: `${process.env.VERCEL_URL || 'https://enhance-backend.vercel.app'}/api/auth/callback`
      }
    })

    if (authError) {
      res.status(400).json({ error: authError.message })
      return
    }

    // Check if user needs email confirmation
    if (authData.user && !authData.user.email_confirmed_at) {
      res.status(201).json({
        message: 'Please check your email and click the confirmation link to complete registration.',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed: false
        }
      })
      return
    }

    // If email is already confirmed (or confirmation disabled), create user record
    await createUserRecord(authData.user)

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        email_confirmed: true
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function createUserRecord(user) {
  // Get the free plan ID
  const { data: freePlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'free')
    .single()

  if (planError) {
    throw new Error('Failed to get free plan')
  }

  // Create user record in users table
  const { error: userError } = await supabase
    .from('users')
    .insert([{
      id: user.id,
      email: user.email,
      plan_id: freePlan.id,
      tokens_used_today: 0,
      last_usage_date: new Date().toISOString().split('T')[0]
    }])

  if (userError) {
    throw new Error('Failed to create user profile')
  }
}