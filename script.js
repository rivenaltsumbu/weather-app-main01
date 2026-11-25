
// ============================================
// WEATHER NOW - APPLICATION MÉTÉO
// ============================================

// SÉLECTION DES ÉLÉMENTS HTML

const elements = {
  unitsTrigger: document.querySelector("#units-trigger"),
  unitsMenu: document.querySelector("#units-menu"),
  applyUnits: document.querySelector("#apply-units"),

  searchForm: document.querySelector("#search-form"),
  citySearch: document.querySelector("#city-search"),
  searchButton: document.querySelector(".search-button"),
  searchMessage: document.querySelector("#search-message"),

  location: document.querySelector("#location"),
  currentDate: document.querySelector("#current-date"),
  currentIcon: document.querySelector("#current-icon"),
  currentTemperature: document.querySelector("#current-temperature"),

  feelsLike: document.querySelector("#feels-like"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind"),
  precipitation: document.querySelector("#precipitation"),

  dailyForecast: document.querySelector("#daily-forecast"),
  daySelect: document.querySelector("#day-select"),
  hourlyForecast: document.querySelector("#hourly-forecast"),
};

// ============================================
// 1. GESTION DES UNITÉS DE MESURE
// ============================================

// Récupération des préférences sauvegardées

function getSavedUnits() {
  const defaults = {
    temperature: "celsius",
    wind: "kmh",
    precipitation: "mm",
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem("weatherUnits")
    );

    if (!saved || typeof saved !== "object") {
      return defaults;
    }

    return {
      temperature: ["celsius", "fahrenheit"].includes(saved.temperature)
        ? saved.temperature
        : defaults.temperature,

      wind: ["kmh", "mph"].includes(saved.wind)
        ? saved.wind
        : defaults.wind,

      precipitation: ["mm", "inch"].includes(saved.precipitation)
        ? saved.precipitation
        : defaults.precipitation,
    };
  } catch (error) {
    return defaults;
  }
}

const units = getSavedUnits();

// Afficher les unités sauvegardées dans les paramètres

function updateUnitInputs() {
  Object.entries(units).forEach(([name, value]) => {
    const input = document.querySelector(
      `input[name="${name}"][value="${value}"]`
    );

    if (input) {
      input.checked = true;
    }
  });
}

// Sauvegarder les unités

function saveUnits() {
  localStorage.setItem(
    "weatherUnits",
    JSON.stringify(units)
  );
}

// ============================================
// 2. DONNÉES MÉTÉOROLOGIQUES
// ============================================

let currentLocation = null;
let forecastData = null;
let requestId = 0;

// ============================================
// 3. TYPES DE MÉTÉO
// ============================================

const weatherTypes = [
  { test: code => code === 0, label: "Sunny", icon: "sunny" },

  {
    test: code => [1, 2].includes(code),
    label: "Partly cloudy",
    icon: "partly-cloudy",
  },

  { test: code => code === 3, label: "Overcast", icon: "overcast" },

  {
    test: code => [45, 48].includes(code),
    label: "Fog",
    icon: "fog",
  },

  {
    test: code => [51, 53, 55, 56, 57].includes(code),
    label: "Drizzle",
    icon: "drizzle",
  },

  {
    test: code => [61, 63, 65, 66, 67, 80, 81, 82].includes(code),
    label: "Rain",
    icon: "rain",
  },

  {
    test: code => [71, 73, 75, 77, 85, 86].includes(code),
    label: "Snow",
    icon: "snow",
  },

  {
    test: code => [95, 96, 99].includes(code),
    label: "Thunderstorms",
    icon: "storm",
  },
];

function getWeatherType(code) {
  return weatherTypes.find(type => type.test(code)) || {
    label: "Weather conditions",
    icon: "overcast",
  };
}

function iconPath(code) {
  return `./assets/images/icon-${getWeatherType(code).icon}.webp`;
}

// ============================================
// 4. FONCTIONS DE CONVERSION
// ============================================

// Celsius vers Fahrenheit

function celsiusToFahrenheit(value) {
  return (value * 9 / 5) + 32;
}

// Fahrenheit vers Celsius

function fahrenheitToCelsius(value) {
  return (value - 32) * 5 / 9;
}

// Kilomètres/heure vers miles/heure

function kmhToMph(value) {
  return value * 0.621371;
}

// Miles/heure vers kilomètres/heure

function mphToKmh(value) {
  return value / 0.621371;
}

// Millimètres vers pouces

function mmToInches(value) {
  return value / 25.4;
}

// Pouces vers millimètres

function inchesToMm(value) {
  return value * 25.4;
}

// ============================================
// 5. FORMATAGE DES VALEURS
// ============================================

function formatTemperature(value) {
  return `${Math.round(value)}°${
    units.temperature === "fahrenheit" ? "F" : "C"
  }`;
}

function formatWind(value) {
  return `${Math.round(value)} ${
    units.wind === "mph" ? "mph" : "km/h"
  }`;
}

function formatPrecipitation(value) {
  return `${Number(value).toFixed(1)} ${
    units.precipitation === "inch" ? "in" : "mm"
  }`;
}

function formatDate(dateString, options) {
  const date = new Date(`${dateString}T12:00:00Z`);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

function formatHour(dateTime) {
  const hour = Number(dateTime.slice(11, 13));

  return `${hour % 12 || 12} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

// ============================================
// 6. GÉOLOCALISATION AUTOMATIQUE
// ============================================

async function detectUserLocation() {
  elements.searchMessage.textContent =
    "Detecting your location...";

  if (!navigator.geolocation) {
    elements.searchMessage.textContent =
      "Geolocation is not supported by your browser.";

    return loadDefaultLocation();
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );

        if (!response.ok) {
          throw new Error("Location detection failed");
        }

        const data = await response.json();
        const address = data.address || {};

        const city =
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          "My location";

        const country = address.country || "";

        await loadWeather({
          name: `${city}${country ? ", " + country : ""}`,
          latitude,
          longitude,
        });

      } catch (error) {
        console.error(error);

        await loadWeather({
          name: "My current location",
          latitude,
          longitude,
        });
      }
    },

    error => {
      console.warn("Geolocation unavailable:", error.message);

      elements.searchMessage.textContent =
        "Location unavailable. Showing default city.";

      loadDefaultLocation();
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    }
  );
}

function loadDefaultLocation() {
  loadWeather({
    name: "Berlin, Germany",
    latitude: 52.52,
    longitude: 13.405,
  });
}

// ============================================
// 7. PRÉVISIONS QUOTIDIENNES
// ============================================

function makeForecastCard(day, index) {
  const card = document.createElement("article");
  card.className = "daily-card";

  const name = document.createElement("h3");

  name.textContent = index === 0
    ? "Today"
    : formatDate(day, { weekday: "short" });

  const icon = document.createElement("img");

  icon.src = iconPath(
    forecastData.daily.weather_code[index]
  );

  icon.alt = getWeatherType(
    forecastData.daily.weather_code[index]
  ).label;

  const temperatures = document.createElement("div");
  temperatures.className = "daily-temperatures";

  const high = document.createElement("span");

  high.textContent = formatTemperature(
    forecastData.daily.temperature_2m_max[index]
  );

  const low = document.createElement("span");

  low.textContent = formatTemperature(
    forecastData.daily.temperature_2m_min[index]
  );

  temperatures.append(high, low);
  card.append(name, icon, temperatures);

  return card;
}

// ============================================
// 8. PRÉVISIONS HORAIRES
// ============================================

function makeHourlyRow(time, index) {
  const row = document.createElement("div");
  row.className = "hourly-row";

  const details = document.createElement("div");
  details.className = "hourly-details";

  const icon = document.createElement("img");

  icon.src = iconPath(
    forecastData.hourly.weather_code[index]
  );

  icon.alt = "";

  const label = document.createElement("span");
  label.textContent = formatHour(time);

  details.append(icon, label);

  const temperature = document.createElement("span");

  temperature.textContent = formatTemperature(
    forecastData.hourly.temperature_2m[index]
  );

  row.append(details, temperature);

  return row;
}

function renderDailyForecast() {
  elements.dailyForecast.replaceChildren();
  elements.daySelect.replaceChildren();

  forecastData.daily.time.forEach((day, index) => {
    elements.dailyForecast.append(
      makeForecastCard(day, index)
    );

    const option = document.createElement("option");

    option.value = day;

    option.textContent = index === 0
      ? "Today"
      : formatDate(day, { weekday: "long" });

    elements.daySelect.append(option);
  });

  renderHourlyForecast();
}

function renderHourlyForecast() {
  const selectedDay =
    elements.daySelect.value ||
    forecastData.daily.time[0];

  const hours = forecastData.hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time.startsWith(selectedDay));

  const afternoonHours = hours.filter(({ time }) => {
    const hour = Number(time.slice(11, 13));

    return hour >= 15 && hour < 23;
  });

  const selectedHours = afternoonHours.length
    ? afternoonHours
    : hours.slice(0, 8);

  elements.hourlyForecast.replaceChildren();

  selectedHours.forEach(({ time, index }) => {
    elements.hourlyForecast.append(
      makeHourlyRow(time, index)
    );
  });
}

// ============================================
// 9. AFFICHAGE DE LA MÉTÉO ACTUELLE
// ============================================

function renderCurrentWeather(data, location) {
  elements.location.textContent = location.name;

  elements.currentDate.textContent = formatDate(
    data.current.time.slice(0, 10),
    {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  elements.currentTemperature.textContent =
    formatTemperature(data.current.temperature_2m);

  elements.currentIcon.src = iconPath(
    data.current.weather_code
  );

  elements.currentIcon.alt = getWeatherType(
    data.current.weather_code
  ).label;

  elements.feelsLike.textContent =
    formatTemperature(data.current.apparent_temperature);

  elements.humidity.textContent =
    `${Math.round(data.current.relative_humidity_2m)}%`;

  elements.wind.textContent =
    formatWind(data.current.wind_speed_10m);

  elements.precipitation.textContent =
    formatPrecipitation(data.current.precipitation);
}

// ============================================
// 10. CHARGEMENT DES DONNÉES MÉTÉO
// ============================================

async function loadWeather(location) {
  const thisRequest = ++requestId;

  // Copie des unités sélectionnées

  const selectedUnits = { ...units };

  setLoading(true);

  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,

    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",

    hourly: "temperature_2m,weather_code",

    daily:
      "weather_code,temperature_2m_max,temperature_2m_min",

    forecast_days: "7",
    timezone: "auto",

    // UNITÉS TRANSMISES À L'API

    temperature_unit: selectedUnits.temperature,
    wind_speed_unit: selectedUnits.wind,
    precipitation_unit: selectedUnits.precipitation,
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error("Weather service unavailable");
    }

    const data = await response.json();

    if (!data.current || !data.daily || !data.hourly) {
      throw new Error("Incomplete weather data");
    }

    if (thisRequest !== requestId) return;

    forecastData = data;
    currentLocation = location;

    // Affichage des données météo

    renderCurrentWeather(data, location);

    // Actualisation des prévisions

    renderDailyForecast();

    elements.searchMessage.textContent = "";

  } catch (error) {
    if (thisRequest !== requestId) return;

    console.error("Weather error:", error);

    elements.searchMessage.textContent =
      "We couldn't load the forecast. Check your connection.";

  } finally {
    if (thisRequest === requestId) {
      elements.searchButton.disabled = false;
      elements.searchButton.textContent = "Search";
    }
  }
}

function setLoading(isLoading) {
  elements.searchButton.disabled = isLoading;

  elements.searchButton.textContent =
    isLoading ? "Loading..." : "Search";

  if (isLoading) {
    elements.searchMessage.textContent =
      "Loading forecast...";
  }
}

// ============================================
// 11. RECHERCHE MANUELLE D'UNE VILLE
// ============================================

async function searchLocation(query) {
  const thisRequest = ++requestId;

  setLoading(true);

  try {
    const params = new URLSearchParams({
      name: query,
      count: "1",
      language: "en",
      format: "json",
    });

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`
    );

    if (!response.ok) {
      throw new Error("City search failed");
    }

    const data = await response.json();

    if (thisRequest !== requestId) return;

    const place = data.results && data.results[0];

    if (!place) {
      elements.searchMessage.textContent =
        "No matching city found.";

      return;
    }

    const nameParts = [
      place.name,
      place.admin1 !== place.name ? place.admin1 : null,
      place.country,
    ].filter(Boolean);

    await loadWeather({
      name: nameParts.join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
    });

  } catch (error) {
    if (thisRequest !== requestId) return;

    console.error(error);

    elements.searchMessage.textContent =
      "Unable to search for this city.";

  } finally {
    if (thisRequest === requestId) {
      elements.searchButton.disabled = false;
      elements.searchButton.textContent = "Search";
    }
  }
}

// ============================================
// 12. PARAMÈTRES DES UNITÉS
// ============================================

// Lecture des choix de l'utilisateur

function readSelectedUnits() {
  return {
    temperature: document.querySelector(
      'input[name="temperature"]:checked'
    ).value,

    wind: document.querySelector(
      'input[name="wind"]:checked'
    ).value,

    precipitation: document.querySelector(
      'input[name="precipitation"]:checked'
    ).value,
  };
}

// Ouvrir et fermer le menu

elements.unitsTrigger.addEventListener("click", () => {
  const isExpanded =
    elements.unitsTrigger.getAttribute("aria-expanded") === "true";

  elements.unitsTrigger.setAttribute(
    "aria-expanded",
    String(!isExpanded)
  );

  elements.unitsMenu.hidden = isExpanded;
});

// Appliquer les nouvelles unités

elements.applyUnits.addEventListener("click", () => {

  // Récupérer les nouveaux choix

  const selected = readSelectedUnits();

  // Vérifier si les unités ont changé

  const changed =
    selected.temperature !== units.temperature ||
    selected.wind !== units.wind ||
    selected.precipitation !== units.precipitation;

  // Mettre à jour les unités

  Object.assign(units, selected);

  // Sauvegarder les préférences

  saveUnits();

  // Fermer le menu

  elements.unitsMenu.hidden = true;

  elements.unitsTrigger.setAttribute(
    "aria-expanded",
    "false"
  );

  // Recharger la météo avec les nouvelles unités

  if (changed && currentLocation) {
    loadWeather(currentLocation);
  }
});

// ============================================
// 13. FERMETURE DU MENU
// ============================================

document.addEventListener("click", event => {
  if (!event.target.closest(".units-control")) {

    elements.unitsMenu.hidden = true;

    elements.unitsTrigger.setAttribute(
      "aria-expanded",
      "false"
    );
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {

    elements.unitsMenu.hidden = true;

    elements.unitsTrigger.setAttribute(
      "aria-expanded",
      "false"
    );

    elements.unitsTrigger.focus();
  }
});

// ============================================
// 14. ÉVÉNEMENT DE RECHERCHE
// ============================================

elements.searchForm.addEventListener("submit", event => {
  event.preventDefault();

  const query = elements.citySearch.value.trim();

  if (query) {
    searchLocation(query);
  }
});

// ============================================
// 15. CHANGEMENT DU JOUR
// ============================================

elements.daySelect.addEventListener(
  "change",
  renderHourlyForecast
);

// ============================================
// 16. DÉMARRAGE DE L'APPLICATION
// ============================================

// Restaurer les unités enregistrées

updateUnitInputs();

// Détecter automatiquement la localisation

detectUserLocation();
