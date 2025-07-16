// api/auth/verify-email.js
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
    const { token, email } = req.body

    if (!token || !email) {
      res.status(400).json({ error: 'Token and email are required' })
      return
    }

    // Verify the email token
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    })

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    // Now create the user record since email is verified
    await createUserRecord(data.user)

    res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: true
      }
    })

  } catch (error) {
    console.error('Email verification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function createUserRecord(user) {
  // Check if user record already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existingUser) {
    // User already exists, just return
    return
  }

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