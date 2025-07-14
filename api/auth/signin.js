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

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      res.status(401).json({ error: error.message })
      return
    }

    // Get user profile with plan details
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        tokens_used_today,
        last_usage_date,
        subscription_plans (
          name,
          token_limit,
          price_per_month
        )
      `)
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      res.status(500).json({ error: 'Failed to fetch user profile' })
      return
    }

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        tokens_used_today: userProfile.tokens_used_today,
        daily_token_limit: userProfile.subscription_plans.token_limit,
        plan_name: userProfile.subscription_plans.name,
        last_usage_date: userProfile.last_usage_date
      }
    })

  } catch (error) {
    console.error('Signin error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}