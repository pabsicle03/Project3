// weather.js
document.addEventListener("DOMContentLoaded", async () => {
  const weatherContainer = document.getElementById("weatherSidebar");
  if (!weatherContainer) return;

  try {
    const response = await fetch("/api/weather");
    if (!response.ok) throw new Error("Weather API request failed");
    const data = await response.json();

    const { weather, main, name } = data;

    const html = `
      <div class="weather-current">
        <h4>${name} Weather</h4>
        <img src="https://openweathermap.org/img/wn/${weather[0].icon}@2x.png" alt="${weather[0].description}">
        <p>${weather[0].main}</p>
        <p>${Math.round(main.temp)}°F</p>
      </div>
    `;

    weatherContainer.innerHTML = html;
    // expose weather globally (temp + conditions)
    window.weatherData = data;

  } catch (err) {
    console.error("Weather fetch error:", err);
    weatherContainer.innerHTML = "<p>Unable to load weather data.</p>";

    window.weatherData = null; // still define it
  }
});