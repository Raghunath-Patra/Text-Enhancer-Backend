import { supabase } from '../lib/supabase.js'
import { openai } from '../lib/openai.js'
import { authenticateUser } from '../lib/auth.js'

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
    // Authenticate user
    const { user, error: authError } = await authenticateUser(req)
    
    if (authError || !user) {
      res.status(401).json({ error: authError || 'Unauthorized' })
      return
    }

    const { text, enhancement_type = 'general' } = req.body

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'Text is required' })
      return
    }

    if (text.length > 5000) {
      res.status(400).json({ error: 'Text too long (max 5000 characters)' })
      return
    }

    // Get user's current usage and plan
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        tokens_used_today,
        last_usage_date,
        subscription_plans (
          token_limit,
          name
        )
      `)
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('User fetch error:', userError)
      res.status(500).json({ error: 'Failed to fetch user data' })
      return
    }

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const dailyLimit = userData.subscription_plans.token_limit
    
    // Check if it's a new day - reset tokens if needed
    let currentTokensUsed = userData.tokens_used_today
    
    if (userData.last_usage_date !== today) {
      // It's a new day, reset tokens
      currentTokensUsed = 0
      
      const { error: resetError } = await supabase
        .from('users')
        .update({ 
          tokens_used_today: 0,
          last_usage_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (resetError) {
        console.error('Token reset error:', resetError)
      }
    }

    // Check if user has exceeded daily limit
    if (currentTokensUsed >= dailyLimit) {
      res.status(429).json({ 
        error: 'Daily token limit exceeded. Try again tomorrow!',
        tokens_used_today: currentTokensUsed,
        daily_limit: dailyLimit,
        plan: userData.subscription_plans.name,
        resets_at: `${today}T23:59:59Z` // End of today
      })
      return
    }

    // Prepare enhancement prompt based on type
    const prompts = {
      general: `Enhance and improve the following text while maintaining its original meaning. Make it more clear, engaging, and well-structured:\n\n${text}`,
      professional: `Rewrite the following text in a professional and business-appropriate tone:\n\n${text}`,
      casual: `Rewrite the following text in a casual and friendly tone:\n\n${text}`,
      concise: `Make the following text more concise while keeping all important information:\n\n${text}`,
      detailed: `Expand and add more detail to the following text:\n\n${text}`
    }

    const prompt = prompts[enhancement_type] || prompts.general

    // Calculate max tokens for this request (leave some buffer for daily limit)
    const remainingDailyTokens = dailyLimit - currentTokensUsed
    const maxTokensForRequest = Math.min(1500, remainingDailyTokens)

    if (maxTokensForRequest < 50) {
      res.status(429).json({ 
        error: 'Not enough tokens remaining for this request. Try again tomorrow!',
        tokens_remaining: remainingDailyTokens
      })
      return
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that enhances text quality. Always respond with improved text only, without explanations or meta-commentary.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokensForRequest,
      temperature: 0.7
    })

    const enhancedText = completion.choices[0].message.content.trim()
    const tokensUsed = completion.usage.total_tokens
    const newTokensUsed = currentTokensUsed + tokensUsed

    // Update user's daily token usage
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        tokens_used_today: newTokensUsed,
        last_usage_date: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Token update error:', updateError)
      // Don't fail the request, just log the error
    }

    // Calculate remaining daily tokens
    const remainingTokens = dailyLimit - newTokensUsed

    res.status(200).json({
      enhanced_text: enhancedText,
      original_text: text,
      enhancement_type,
      tokens_used_this_request: tokensUsed,
      tokens_used_today: newTokensUsed,
      tokens_remaining_today: Math.max(0, remainingTokens),
      daily_limit: dailyLimit,
      resets_at: `${today}T23:59:59Z`
    })

  } catch (error) {
    console.error('Enhancement error:', error)
    
    if (error.code === 'insufficient_quota') {
      res.status(503).json({ error: 'OpenAI API quota exceeded. Please try again later.' })
    } else if (error.code === 'rate_limit_exceeded') {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}