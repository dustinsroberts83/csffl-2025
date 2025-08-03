// app/api/mfl/route.js
import { NextResponse } from 'next/server';

// MFL API base URL
const MFL_BASE_URL = 'https://api.myfantasyleague.com';

// Your MFL API client (if you have one registered)
const MFL_CLIENT_ID = process.env.MFL_CLIENT_ID || 'MFLCLIENTAGENT';

// Store session cookies for authenticated requests
let sessionCookies = {};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get all query parameters
    const params = {};
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    
    // Ensure we have required parameters
    if (!params.TYPE) {
      return NextResponse.json({ error: 'TYPE parameter is required' }, { status: 400 });
    }
    
    // Check if this request type requires a league ID
    const typesRequiringLeague = [
      'league', 'rosters', 'leagueStandings', 'transactions', 
      'projectedScores', 'playerScores', 'weeklyResults', 
      'schedule', 'playoffBrackets', 'freeAgents', 'salaries',
      'accounting', 'pool', 'survivorPool', 'draftResults',
      'auctionResults', 'myDraftList', 'messageBoard', 'tradeBait'
    ];
    
    if (typesRequiringLeague.includes(params.TYPE) && !params.L) {
      return NextResponse.json({ 
        error: 'League ID (L) parameter is required for this request type' 
      }, { status: 400 });
    }
    
    // Build MFL API URL
    const year = params.YEAR || '2025';
    const apiUrl = `${MFL_BASE_URL}/${year}/export`;
    
    // Add JSON format
    params.JSON = '1';
    
    // Build query string
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${apiUrl}?${queryString}`;
    
    console.log('Fetching from MFL:', fullUrl);
    
    // Prepare headers
    const headers = {
      'User-Agent': MFL_CLIENT_ID,
      'Accept': 'application/json',
    };
    
    // Add session cookie if we have one for this league
    const leagueId = params.L;
    if (leagueId && sessionCookies[leagueId]) {
      headers['Cookie'] = sessionCookies[leagueId];
    }
    
    // Make request to MFL API
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: headers,
    });
    
    // Get response text first to debug if needed
    const responseText = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse MFL response:', responseText);
      return NextResponse.json({ 
        error: 'Invalid response from MFL API',
        details: responseText.substring(0, 200) 
      }, { status: 500 });
    }
    
    // Check for MFL errors
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    
    // Store session cookie if present
    const setCookie = response.headers.get('set-cookie');
    if (setCookie && leagueId) {
      sessionCookies[leagueId] = setCookie;
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('MFL API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch from MFL API',
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, leagueId, year = '2025' } = body;
    
    if (!username || !password || !leagueId) {
      return NextResponse.json({ 
        error: 'Username, password, and leagueId are required' 
      }, { status: 400 });
    }
    
    // Login to MFL
    const loginUrl = `${MFL_BASE_URL}/${year}/login`;
    const loginParams = new URLSearchParams({
      USERNAME: username,
      PASSWORD: password,
      XML: '1'
    });
    
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': MFL_CLIENT_ID,
      },
      body: loginParams,
    });
    
    const setCookie = loginResponse.headers.get('set-cookie');
    
    if (setCookie) {
      // Store the session cookie for this league
      sessionCookies[leagueId] = setCookie;
      
      return NextResponse.json({ 
        success: true,
        message: 'Login successful' 
      });
    } else {
      return NextResponse.json({ 
        error: 'Login failed. Please check your credentials.' 
      }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ 
      error: 'Login failed',
      details: error.message 
    }, { status: 500 });
  }
}