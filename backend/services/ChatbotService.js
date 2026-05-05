const config = require('../config');

const SYSTEM_PROMPT = `
You are the CommuneX assistant for a campus marketplace and service exchange app.
Know these exact platform rules:
- Users must log in before using the main website features.
- Marketplace users can post products, browse listings, save items, contact sellers, and use secure escrow transactions.
- Location supports manual entry and live browser location, with OpenStreetMap tracking on product details when coordinates are available.
- Pricing is token based: 2 free product uploads, then 1 product upload costs 1 token worth INR 5.
- Plans: Starter INR 20 for 5 uploads, Popular INR 45 for 12 uploads, Pro INR 80 for 25 uploads.
- Tokens can later be used across services such as product listing, service listing, and chat features.
- Recommendations are based on saved items, searches, viewed categories, and popular marketplace activity.
- Admin accounts can review users, listings, services, transactions, and platform metrics.
Answer general knowledge questions directly when the user asks them.
For CommuneX questions, guide users to the correct page or action.
Do not invent CommuneX sections that do not exist.
Keep answers brief, helpful, and conversational.
`;

class ChatbotService {
  constructor() {
    this.intents = [
      {
        patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good evening'],
        response: 'Hello! Welcome to CommuneX. I can help you navigate the platform. What would you like to do?',
        suggestions: ['Browse marketplace', 'Find services', 'Community posts', 'How to sell'],
      },
      {
        patterns: ['who are you', 'what are you', 'your name', 'about you'],
        response:
          'I am the CommuneX Assistant, your AI helper for the campus marketplace. I can answer general questions and help you use listings, services, chats, payments, tokens, recommendations, locations, and admin tools.',
        suggestions: ['Marketplace help', 'Tokens and pricing', 'Location tracking', 'Recommendations'],
      },
      {
        patterns: ['sell', 'list item', 'post item', 'create listing', 'how to sell'],
        response:
          'To sell an item on CommuneX:\n1. Go to the Marketplace section\n2. Click "Create Listing"\n3. Add photos, title, description, category, and price\n4. Submit your listing\n\nYour listing will be visible to all campus members immediately.',
        suggestions: ['Marketplace', 'Pricing tips', 'Categories'],
      },
      {
        patterns: ['buy', 'purchase', 'find item', 'search item', 'browse'],
        response:
          'To find items on CommuneX:\n1. Visit the Marketplace\n2. Use the search bar or browse by category\n3. Filter by price, condition, or category\n4. Click on any listing to see details\n5. Contact the seller through chat to negotiate or arrange a meetup.',
        suggestions: ['Marketplace', 'Categories', 'Filters'],
      },
      {
        patterns: ['service', 'tutor', 'freelance', 'coding help', 'hire'],
        response:
          'CommuneX Services lets you find or offer campus services:\n- Tutoring & academic help\n- Freelancing & coding projects\n- Room rentals & mess info\n- Photography, design, and more\n\nBrowse the Services section to find what you need.',
        suggestions: ['Browse services', 'Offer a service', 'Service categories'],
      },
      {
        patterns: ['community', 'post', 'announcement', 'lost', 'found', 'discussion'],
        response:
          'The Community section is your campus bulletin board:\n- Announcements: Important campus updates\n- Lost & Found: Report or find lost items\n- Discussions: Start or join conversations\n- Campus Updates: Share news and events',
        suggestions: ['Create post', 'Lost & Found', 'Discussions'],
      },
      {
        patterns: ['chat', 'message', 'contact seller', 'talk'],
        response:
          'You can chat with any user on CommuneX:\n1. Visit a listing or service page\n2. Click "Chat with Seller/Provider"\n3. Send messages in real-time\n4. Negotiate prices and arrange meetups',
        suggestions: ['My chats', 'Marketplace'],
      },
      {
        patterns: ['payment', 'pay', 'escrow', 'transaction', 'money', 'wallet'],
        response:
          'CommuneX uses a secure escrow payment system:\n1. Buyer initiates payment\n2. Amount is held in escrow\n3. Both parties confirm the transaction\n4. Payment is released to the seller\n\nThis protects both buyers and sellers.',
        suggestions: ['My transactions', 'Wallet', 'How escrow works'],
      },
      {
        patterns: ['account', 'profile', 'settings', 'edit profile'],
        response:
          'Manage your account from the Dashboard:\n- Edit your profile information\n- View your listings and services\n- Check transaction history\n- Manage favorites and settings',
        suggestions: ['Dashboard', 'Edit profile', 'My listings'],
      },
      {
        patterns: ['help', 'support', 'how to', 'guide', 'faq'],
        response:
          'I can help you with:\n- Buying & selling items\n- Finding or offering services\n- Community posts\n- Chat & messaging\n- Payments & transactions\n- Account management\n\nWhat would you like to know more about?',
        suggestions: ['Marketplace help', 'Services help', 'Payment help', 'Account help'],
      },
      {
        patterns: ['category', 'categories', 'what can i sell', 'types'],
        response:
          'CommuneX Marketplace Categories:\n- Books & Study Materials\n- Electronics & Gadgets\n- Furniture\n- Clothing & Accessories\n- Stationery\n- Sports Equipment\n- Vehicles\n- Accessories\n- Other Items',
        suggestions: ['Browse by category', 'Create listing'],
      },
      {
        patterns: ['safe', 'security', 'trust', 'scam', 'fraud'],
        response:
          'CommuneX prioritizes your safety:\n- Only verified college students can join\n- Escrow payments protect transactions\n- User ratings help build trust\n- Report suspicious users or listings\n- Meet in public campus areas for exchanges',
        suggestions: ['Report user', 'Safety tips', 'Escrow info'],
      },
    ];

    this.defaultResponse = {
      response:
        "I'm not sure I understand. Could you rephrase that? I can help with marketplace, services, community, payments, and account-related questions.",
      suggestions: ['Marketplace', 'Services', 'Community', 'Help'],
    };
  }

  async getGroqResponse(userMessage) {
    const keys = config.groq.apiKeys || [];
    if (!keys.length || typeof fetch !== 'function') return null;

    for (const key of keys) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.groq.model,
            temperature: 0.45,
            max_tokens: 550,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
          }),
        });

        if (!response.ok) continue;
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } catch (_) {
        continue;
      }
    }

    return null;
  }

  async getResponse(userMessage) {
    try {
      const groqMessage = await this.getGroqResponse(userMessage);
      if (groqMessage) {
        return {
          message: groqMessage,
          suggestions: ['Marketplace', 'Transactions', 'Recommendations', 'Dashboard'],
          confidence: 0.95,
          provider: 'groq',
        };
      }
    } catch (error) {
      console.error('Groq chatbot fallback:', error.message);
    }

    const message = userMessage.toLowerCase().trim();

    for (const intent of this.intents) {
      for (const pattern of intent.patterns) {
        if (message.includes(pattern)) {
          return {
            message: intent.response,
            suggestions: intent.suggestions || [],
            confidence: 0.85,
          };
        }
      }
    }

    // Fuzzy keyword match
    const words = message.split(/\s+/);
    for (const intent of this.intents) {
      for (const pattern of intent.patterns) {
        for (const word of words) {
          if (word.length > 3 && pattern.includes(word)) {
            return {
              message: intent.response,
              suggestions: intent.suggestions || [],
              confidence: 0.6,
            };
          }
        }
      }
    }

    return {
      message: this.defaultResponse.response,
      suggestions: this.defaultResponse.suggestions,
      confidence: 0.2,
    };
  }
}

module.exports = new ChatbotService();
