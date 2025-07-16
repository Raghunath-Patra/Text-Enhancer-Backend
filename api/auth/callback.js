// api/auth/callback.js - Enhanced with debugging
import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {
  console.log('Callback endpoint called:', {
    method: req.method,
    query: req.query,
    url: req.url,
    headers: req.headers
  })

  if (req.method === 'OPTIONS') {
    res.status(200).json({})
    return
  }

  try {
    let token_hash, type, access_token, refresh_token

    if (req.method === 'GET') {
      // Extract from URL parameters (Supabase email verification redirect)
      token_hash = req.query.token_hash
      type = req.query.type
      access_token = req.query.access_token
      refresh_token = req.query.refresh_token
      
      console.log('GET parameters:', { token_hash, type, access_token, refresh_token })
    }

    // Handle different verification types
    if (type === 'signup' && token_hash) {
      console.log('Processing signup verification with token_hash')
      
      // For email verification during signup
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'email'
      })

      if (error) {
        console.error('Email verification error:', error)
        return res.status(400).send(generateErrorPage(error.message))
      }

      console.log('Email verification successful:', data.user?.id)

      // Create user record if verification successful
      if (data.user) {
        try {
          await createUserRecord(data.user)
          console.log('User record created successfully')
        } catch (createError) {
          console.error('Error creating user record:', createError)
          // Continue anyway - user is verified, we can fix the record later
        }
      }

      return res.status(200).send(generateSuccessPage())
      
    } else if (type === 'recovery' && token_hash) {
      console.log('Processing password recovery')
      // Handle password recovery
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery'
      })

      if (error) {
        console.error('Password recovery error:', error)
        return res.status(400).send(generateErrorPage(error.message))
      }

      // Redirect to password reset form (you'd need to create this)
      return res.redirect(`https://your-frontend-domain.com/reset-password?access_token=${data.session.access_token}`)
      
    } else if (access_token && refresh_token) {
      console.log('Processing direct token callback')
      // Handle direct token callback (some Supabase flows)
      return res.status(200).send(generateSuccessPage())
      
    } else {
      console.error('Invalid callback parameters:', req.query)
      return res.status(400).send(generateErrorPage('Invalid verification link or missing parameters'))
    }

  } catch (error) {
    console.error('Callback processing error:', error)
    return res.status(500).send(generateErrorPage('An unexpected error occurred during verification'))
  }
}

async function createUserRecord(user) {
  console.log('Creating user record for:', user.id)
  
  // Check if user record already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existingUser) {
    console.log('User record already exists')
    return
  }

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
    console.error('Failed to create user profile:', userError)
    throw new Error('Failed to create user profile')
  }
  
  console.log('User record created successfully')
}

function generateSuccessPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Verification</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
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
        <p>Please return to the app and sign in with your credentials.</p>
        <button onclick="window.close()" class="btn">Close Window</button>
      </div>
      
      <script>
        // Auto-close after 10 seconds
        setTimeout(() => {
          window.close();
        }, 10000);
      </script>
    </body>
    </html>
  `
}

function generateErrorPage(errorMessage) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Verification Error</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
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
          background: #6b7280;
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
        .btn:hover { background: #4b5563; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error">✗</div>
        <h1>Verification Failed</h1>
        <p>${errorMessage}</p>
        <p>Please try signing up again or contact support if the problem persists.</p>
        <button onclick="window.close()" class="btn">Close Window</button>
      </div>
    </body>
    </html>
  `
}