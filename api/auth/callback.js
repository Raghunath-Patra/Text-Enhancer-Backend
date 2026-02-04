// api/auth/callback.js
import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {
  // Handle both GET (from email redirect) and POST methods
  if (req.method === 'OPTIONS') {
    res.status(200).json({})
    return
  }

  try {
    let token_hash, type

    if (req.method === 'GET') {
      // Extract from URL parameters (Supabase email verification redirect)
      token_hash = req.query.token
      type = req.query.type
    }

    if (!token_hash || !type) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .error { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Invalid Verification Link</h1>
            <p>This verification link is invalid or has expired.</p>
            <a href="/">Return to App</a>
          </div>
        </body>
        </html>
      `)
    }

    // Verify the token with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'signup'
    })

    if (error) {
      console.error('Email verification error:', error)
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .error { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Verification Failed</h1>
            <p>${error.message}</p>
            <a href="/">Return to App</a>
          </div>
        </body>
        </html>
      `)
    }

    // Create user record if verification successful
    if (data.user) {
      try {
        await createUserRecord(data.user)
      } catch (createError) {
        console.error('Error creating user record:', createError)
        // Continue anyway - user is verified, we can fix the record later
      }
    }

    // Redirect to success page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
          }
          .success { color: #10b981; font-size: 48px; margin-bottom: 20px; }
          h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; }
          p { color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
          .btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
          }
          .btn:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Email Verified Successfully!</h1>
          <p>Your account has been created and verified. You can now use the Text Enhancement API.</p>
          <p>You can close this window and return to the app to sign in.</p>
        </div>
      </body>
      </html>
    `)

  } catch (error) {
    console.error('Callback error:', error)
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
          .error { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Verification Error</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <a href="/">Return to App</a>
        </div>
      </body>
      </html>
    `)
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