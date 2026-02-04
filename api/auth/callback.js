// api/auth/callback.js - FIXED VERSION
import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {
  // Handle both GET (from email redirect) and POST methods
  if (req.method === 'OPTIONS') {
    res.status(200).json({})
    return
  }

  try {
    console.log('Callback received:', {
      method: req.method,
      query: req.query,
      url: req.url
    })

    let token_hash, type

    if (req.method === 'GET') {
      // Extract from URL parameters (Supabase email verification redirect)
      // Supabase sends 'token' not 'token_hash' in the URL
      token_hash = req.query.token || req.query.token_hash
      type = req.query.type || 'signup'
      
      console.log('Extracted params:', { token_hash, type })
    }

    if (!token_hash) {
      console.error('No token found in request')
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
          <meta charset="UTF-8">
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
            .error { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
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
            <div class="error">✗</div>
            <h1>Invalid Verification Link</h1>
            <p>This verification link is invalid or has expired.</p>
            <p>Please request a new verification email from the app.</p>
          </div>
        </body>
        </html>
      `)
    }

    // Verify the token with Supabase
    // Use verifyOtp for email confirmation tokens
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type || 'signup'
    })

    console.log('Verification result:', {
      success: !error,
      error: error?.message,
      userId: data?.user?.id
    })

    if (error) {
      console.error('Email verification error:', error)
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification</title>
          <meta charset="UTF-8">
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
            .error { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
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
            <div class="error">✗</div>
            <h1>Verification Failed</h1>
            <p>${error.message}</p>
            <p>The link may have expired. Please request a new verification email from the app.</p>
          </div>
        </body>
        </html>
      `)
    }

    // Create user record if verification successful
    if (data.user) {
      console.log('Creating user record for:', data.user.id)
      try {
        await createUserRecord(data.user)
        console.log('User record created successfully')
      } catch (createError) {
        console.error('Error creating user record:', createError)
        // Continue anyway - user is verified in auth, record can be created on first login
      }
    }

    // Success - redirect to success page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification</title>
        <meta charset="UTF-8">
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
          <p>Your account has been created and verified. You can now sign in to use the Text Enhancement API.</p>
          <p><strong>Next step:</strong> Return to the app and sign in with your email and password.</p>
          <p style="font-size: 14px; color: #9ca3af; margin-top: 32px;">You can close this window now.</p>
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
        <meta charset="UTF-8">
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
          .error { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
          h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; }
          p { color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Verification Error</h1>
          <p>An unexpected error occurred during verification.</p>
          <p>Error: ${error.message}</p>
          <p>Please contact support or try signing up again.</p>
        </div>
      </body>
      </html>
    `)
  }
}

async function createUserRecord(user) {
  console.log('Checking if user record exists for:', user.id)
  
  // Check if user record already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle() // Use maybeSingle instead of single to avoid error if not found

  if (checkError) {
    console.error('Error checking existing user:', checkError)
    // Don't throw, continue to create
  }

  if (existingUser) {
    console.log('User record already exists')
    return
  }

  console.log('Getting free plan ID')
  
  // Get the free plan ID
  const { data: freePlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'free')
    .single()

  if (planError) {
    console.error('Failed to get free plan:', planError)
    throw new Error('Failed to get free plan: ' + planError.message)
  }

  console.log('Creating user record with plan:', freePlan.id)

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
    console.error('Failed to create user profile:', userError)
    throw new Error('Failed to create user profile: ' + userError.message)
  }

  console.log('User record created successfully')
}