import React, { useCallback, useEffect, useState } from 'react';
import './App.css';

// Open-Meteo API doesn't require an API key
const BASE_URL = "https://api.open-meteo.com/v1/forecast";

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [location, setLocation] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [units, setUnits] = useState('celsius'); // celsius or fahrenheit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [coordinates, setCoordinates] = useState(null);

  // Fetch weather data based on current location (on initial mount)
  useEffect(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ latitude, longitude });
          fetchWeatherData(latitude, longitude);
          fetchLocationName(latitude, longitude);
        },
        error => {
          setError("Unable to access location. Please search for a city.");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []); // Only run once on initial mount

  // Re-fetch data when units change or coordinates change
  useEffect(() => {
    if (coordinates) {
      fetchWeatherData(coordinates.latitude, coordinates.longitude);
    }
  }, [units, coordinates]); // Runs when either units or coordinates change

  const fetchWeatherData = useCallback(async (lat, lon) => {
    try {
      setLoading(true);
      const tempUnit = units === 'celsius' ? 'celsius' : 'fahrenheit';
      const response = await fetch(
        `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum&temperature_unit=${tempUnit}&wind_speed_unit=ms&forecast_days=7`
      );
  
      if (!response.ok) {
        throw new Error('Weather data not available');
      }
  
      const data = await response.json();
  
      // Process current weather data
      const currentWeather = {
        dt: new Date().getTime() / 1000,
        main: {
          temp: data.current.temperature_2m,
          feels_like: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          pressure: data.current.pressure_msl
        },
        weather: [
          {
            description: getWeatherDescription(data.current.weather_code),
            icon: getWeatherIcon(data.current.weather_code)
          }
        ],
        wind: {
          speed: data.current.wind_speed_10m
        },
        coord: {
          lat: lat,
          lon: lon
        }
      };
  
      setWeatherData(currentWeather);
  
      // Process forecast data
      const dailyForecast = data.daily.time.map((time, index) => {
        const [year, month, day] = time.split('-');
        const dateUTC = new Date(Date.UTC(year, month - 1, day));
        
        // Add one day to fix the offset issue
        dateUTC.setUTCDate(dateUTC.getUTCDate() + 1);
        return {
          dt: dateUTC.getTime() / 1000,
          main: {
            temp: data.daily.temperature_2m_max[index],
            mintemp: data.daily.temperature_2m_min[index],
            feels_like: data.daily.apparent_temperature_max[index]
          },
          weather: [
            {
              description: getWeatherDescription(data.daily.weather_code[index]),
              icon: getWeatherIcon(data.daily.weather_code[index])
            }
          ]
        };
      });
  
      setForecastData(dailyForecast);
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  }, [units]);

  // Get location name from coordinates using OpenCage Geocoding API
  const fetchLocationName = async (lat, lon) => {
    try {
      // Replace with your actual API key
      const API_KEY = "YOUR_OPENCAGE_API_KEY"; // You need to get a real API key
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const city = result.components.city || result.components.town || result.components.village || result.components.county;
          const country = result.components.country;
          setLocation(`${city}, ${country}`);
        } else {
          setLocation(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
        }
      } else {
        // Fallback to coordinates if geocoding fails
        setLocation(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      }
    } catch (error) {
      setLocation(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
    }
  };

  // searchCity function using Nominatim
  const searchCity = async (city) => {
    setLoading(true);
    try {
      // Using Nominatim API (doesn't require API key but has usage limits)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('City not found');
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        setCoordinates({ latitude: lat, longitude: lon });
        setLocation(result.display_name);
        fetchWeatherData(lat, lon);
      } else {
        throw new Error('City not found');
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchLocation.trim()) {
      searchCity(searchLocation);
      setSearchLocation('');
    }
  };

  // Toggle temperature units
  const toggleUnits = () => {
    setUnits((prevUnits) => (prevUnits === 'celsius' ? 'fahrenheit' : 'celsius'));
    // No need to call fetchWeatherData here, the useEffect will handle it
  };

  // Format date
  const formatDate = (dt) => {
    const date = new Date(dt * 1000);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get weather icon based on WMO code
  const getWeatherIcon = (code) => {
    // Map WMO weather codes to icons
    if (code < 3) return "01d"; // Clear
    if (code < 20) return "02d"; // Partly cloudy
    if (code < 30) return "03d"; // Cloudy
    if (code < 50) return "09d"; // Rain
    if (code < 60) return "13d"; // Snow
    if (code < 70) return "50d"; // Fog
    if (code < 90) return "11d"; // Thunderstorm
    return "01d"; // Default
  };

  // Get weather description based on WMO code
  const getWeatherDescription = (code) => {
    if (code === 0) return "Clear sky";
    if (code === 1) return "Mainly clear";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code <= 19) return "Fog";
    if (code <= 29) return "Drizzle";
    if (code <= 39) return "Rain";
    if (code <= 49) return "Snow";
    if (code <= 59) return "Freezing rain";
    if (code <= 69) return "Snow fall";
    if (code <= 79) return "Rain showers";
    if (code <= 89) return "Snow showers";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
  };

  // Get weather icon URL
  const getIconUrl = (icon) => `http://openweathermap.org/img/wn/${icon}@2x.png`;

  return (
    <div className="app">
      <div className="container">
        <h1>Weather App</h1>
        
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            placeholder="Enter city name"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
          />
          <button type="submit">Search</button>
          <button type="button" onClick={toggleUnits} className="units-toggle">
            {units === 'celsius' ? '°C' : '°F'}
          </button>
        </form>
        
        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}
        
        {/* Loading State */}
        {loading && <div className="loading">Loading...</div>}
        
        {/* Current Weather */}
        {weatherData && (
          <div className="current-weather">
            <h2>{location || "Current Location"}</h2>
            <div className="date">{formatDate(weatherData.dt)}</div>
            <div className="weather-info">
              <img 
                src={getIconUrl(weatherData.weather[0].icon)} 
                alt={weatherData.weather[0].description} 
                className="weather-icon"
              />
              <div className="temperature">
                {Math.round(weatherData.main.temp)}°{units === 'celsius' ? 'C' : 'F'}
              </div>
            </div>
            <div className="weather-description">
              {weatherData.weather[0].description}
            </div>
            <div className="weather-details">
              <div className="detail">
                <span className="label">Feels like:</span>
                <span className="value">
                  {Math.round(weatherData.main.feels_like)}°{units === 'celsius' ? 'C' : 'F'}
                </span>
              </div>
              <div className="detail">
                <span className="label">Humidity:</span>
                <span className="value">{weatherData.main.humidity}%</span>
              </div>
              <div className="detail">
                <span className="label">Wind Speed:</span>
                <span className="value">{weatherData.wind.speed} m/s</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Forecast */}
        {forecastData && (
          <div className="forecast">
            <h3>7-Day Forecast</h3>
            <div className="forecast-container">
              {forecastData.map((day, index) => (
                <div key={index} className="forecast-day">
                  <div className="forecast-date">{formatDate(day.dt)}</div>
                  <img 
                    src={getIconUrl(day.weather[0].icon)} 
                    alt={day.weather[0].description} 
                    className="forecast-icon"
                  />
                  <div className="forecast-temp">
                    {Math.round(day.main.temp)}°{units === 'celsius' ? 'C' : 'F'} - 
                    {Math.round(day.main.mintemp)}°{units === 'celsius' ? 'C' : 'F'}
                  </div>
                  <div className="forecast-desc">{day.weather[0].description}</div>
                  
                  
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;