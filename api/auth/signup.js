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

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      res.status(400).json({ error: authError.message })
      return
    }

    // Get the free plan ID
    const { data: freePlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'free')
      .single()

    if (planError) {
      res.status(500).json({ error: 'Failed to get free plan' })
      return
    }

    // Create user record in users table
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email: authData.user.email,
        plan_id: freePlan.id,
        tokens_used_today: 0,
        last_usage_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      }])

    if (userError) {
      console.error('User creation error:', userError)
      res.status(500).json({ error: 'Failed to create user profile' })
      return
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}