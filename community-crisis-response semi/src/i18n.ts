import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// For demonstration, we'll start with English and Hindi.
// More languages can be added here.
const resources = {
  en: {
    translation: {
      "login": "Secure Login",
      "emergency_only": "Emergency Only",
      "quick_sos": "Quick SOS",
      "sos_sent": "SOS Sent Successfully",
      "join_network": "Join the Network",
      "select_role": "Select your role to continue.",
      "citizen": "Citizen",
      "volunteer": "Volunteer",
      "citizen_desc": "Report emergencies and get help.",
      "volunteer_desc": "Respond to alerts and save lives.",
      "weather": "Weather",
      "wind": "Wind",
      "loading_weather": "Loading weather...",
      "weather_unavailable": "Weather data unavailable"
    }
  },
  hi: {
    translation: {
      "login": "सुरक्षित लॉगिन",
      "emergency_only": "केवल आपातकालीन",
      "quick_sos": "त्वरित एसओएस",
      "sos_sent": "एसओएस सफलतापूर्वक भेजा गया",
      "join_network": "नेटवर्क में शामिल हों",
      "select_role": "जारी रखने के लिए अपनी भूमिका चुनें।",
      "citizen": "नागरिक",
      "volunteer": "स्वयंसेवक",
      "citizen_desc": "आपात स्थितियों की रिपोर्ट करें और सहायता प्राप्त करें।",
      "volunteer_desc": "अलर्ट का जवाब दें और जीवन बचाएं।",
      "weather": "मौसम",
      "wind": "हवा",
      "loading_weather": "मौसम लोड हो रहा है...",
      "weather_unavailable": "मौसम डेटा अनुपलब्ध"
    }
  },
  ta: {
    translation: {
      "login": "பாதுகாப்பான உள்நுழைவு",
      "emergency_only": "அவசரநிலை மட்டும்",
      "quick_sos": "விரைவான SOS",
      "sos_sent": "SOS வெற்றிகரமாக அனுப்பப்பட்டது",
      "join_network": "நெட்வொர்க்கில் சேரவும்",
      "select_role": "தொடர உங்கள் பாத்திரத்தைத் தேர்ந்தெடுக்கவும்.",
      "citizen": "குடிமகன்",
      "volunteer": "தன்னார்வலர்",
      "citizen_desc": "அவசரநிலைகளைப் புகாரளித்து உதவி பெறவும்.",
      "volunteer_desc": "எச்சரிக்கைகளுக்குப் பதிலளித்து உயிர்களைக் காப்பாற்றவும்.",
      "weather": "வானிலை",
      "wind": "காற்று",
      "loading_weather": "வானிலை ஏற்றப்படுகிறது...",
      "weather_unavailable": "வானிலை தரவு கிடைக்கவில்லை"
    }
  },
  bn: {
    translation: {
      "login": "নিরাপদ লগইন",
      "emergency_only": "শুধুমাত্র জরুরি অবস্থা",
      "quick_sos": "দ্রুত এসওএস",
      "sos_sent": "এসওএস সফলভাবে পাঠানো হয়েছে",
      "join_network": "নেটওয়ার্কে যোগ দিন",
      "select_role": "চালিয়ে যেতে আপনার ভূমিকা নির্বাচন করুন।",
      "citizen": "নাগরিক",
      "volunteer": "স্বেচ্ছাসেবক",
      "citizen_desc": "জরুরি অবস্থার রিপোর্ট করুন এবং সাহায্য পান।",
      "volunteer_desc": "সতর্কবার্তার জবাব দিন এবং জীবন বাঁচান।",
      "weather": "আবহাওয়া",
      "wind": "বাতাস",
      "loading_weather": "আবহাওয়া লোড হচ্ছে...",
      "weather_unavailable": "আবহাওয়ার তথ্য উপলব্ধ নেই"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
