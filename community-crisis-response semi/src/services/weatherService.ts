import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const fetchWeather = async (latitude?: number, longitude?: number, city?: string) => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('OpenWeather API key not found');
    return null;
  }

  try {
    let url;
    if (city) {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    } else if (latitude !== undefined && longitude !== undefined) {
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    } else {
      return null;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.cod !== 200) {
      console.error('OpenWeather API error:', data.message);
      return null;
    }

    return {
      temp: Math.round(data.main.temp),
      wind: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      condition: data.weather[0].description,
      alert: null, // OpenWeather free tier does not provide alerts
      isDefault: false
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
};
