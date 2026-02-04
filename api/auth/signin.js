// api/auth/signin.js - FIXED to handle missing user records
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

    console.log('Sign in attempt for:', email)

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Sign in error:', error)
      res.status(401).json({ error: error.message })
      return
    }

    console.log('Auth successful for user:', data.user.id)

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
      .maybeSingle() // Use maybeSingle to avoid error if not found

    // If user profile doesn't exist, create it
    if (!userProfile || profileError) {
      console.log('User profile not found, creating one')
      
      try {
        await createUserRecord(data.user)
        
        // Fetch the newly created profile
        const { data: newProfile, error: newProfileError } = await supabase
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

        if (newProfileError) {
          console.error('Failed to fetch new profile:', newProfileError)
          res.status(500).json({ error: 'Failed to create user profile' })
          return
        }

        res.status(200).json({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: {
            id: data.user.id,
            email: data.user.email,
            tokens_used_today: newProfile.tokens_used_today,
            daily_token_limit: newProfile.subscription_plans.token_limit,
            plan_name: newProfile.subscription_plans.name,
            last_usage_date: newProfile.last_usage_date
          }
        })
        return
      } catch (createError) {
        console.error('Error creating user profile:', createError)
        res.status(500).json({ error: 'Failed to create user profile' })
        return
      }
    }

    // Normal flow - user profile exists
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
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}

async function createUserRecord(user) {
  console.log('Creating user record for:', user.id)
  
  // Get the free plan ID
  const { data: freePlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'free')
    .single()

  if (planError) {
    console.error('Failed to get free plan:', planError)
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
    console.error('Failed to create user record:', userError)
    throw new Error('Failed to create user profile')
  }

  console.log('User record created successfully')
}