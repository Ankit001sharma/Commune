/**
 * AI Chatbot Service
 * Rule-based + keyword-matching chatbot for platform navigation assistance.
 */

class ChatbotService {
  constructor() {
    this.intents = [
      {
        patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good evening'],
        response: 'Hello! Welcome to CommuneX. I can help you navigate the platform. What would you like to do?',
        suggestions: ['Browse marketplace', 'Find services', 'Community posts', 'How to sell'],
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

  getResponse(userMessage) {
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
